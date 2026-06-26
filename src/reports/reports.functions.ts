import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server'
import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { comments, media, reportConfirms, reports } from '../db/schema'
import { TYPES } from './reports'

function clientIp(): string {
  // CF-Connecting-IP en Workers; getRequestIP() en dev local
  return getRequestHeader('cf-connecting-ip') ?? getRequestIP() ?? ''
}

function clientUa(): string {
  return (getRequestHeader('user-agent') ?? '').slice(0, 250)
}

// ponytail: dato viejo en emergencia = peligroso. Filtramos a 48h (mvp.md).
// Excepción: desaparecidos (missing) y mascotas perdidas (lostpet) son registro
// de pie, no caducan a 48h — se ocultan cuando la fuente los marca encontrados
// (status='found'), no por antigüedad.
// TODO(albergue): los albergues sembrados deberían exentarse de este filtro.
const FRESH_MS = 48 * 60 * 60 * 1000
const STANDING_TYPES = ['missing', 'lostpet'] // exentos del corte de 48h
// Alertas de seguridad expiran en 12h — son eventos puntuales, no permanentes.
const SECURITY_TTL_MS = 12 * 60 * 60 * 1000

export type Bounds = { s: number; n: number; w: number; e: number }

// Columnas mínimas del pin: mismo payload para el bbox y el seed.
const pinCols = {
  id: reports.id,
  type: reports.type,
  title: reports.title,
  lat: reports.lat,
  lng: reports.lng,
  confirms: reports.confirms,
  createdAt: reports.createdAt,
}

// Reglas de visibilidad compartidas (status + frescura). missing/lostpet exentos
// del corte de 48h (registro de pie); las alertas de seguridad expiran en 12h.
function visibleFreshConds() {
  const cutoff = new Date(Date.now() - FRESH_MS)
  const securityCutoff = new Date(Date.now() - SECURITY_TTL_MS)
  return [
    eq(reports.status, 'visible'),
    or(inArray(reports.type, STANDING_TYPES), gte(reports.createdAt, cutoff)),
    or(ne(reports.type, 'security'), gte(reports.createdAt, securityCutoff)),
  ]
}

// Cache de borde (Cloudflare Cache API): la primera petición computa y guarda;
// el resto del borde responde sin tocar D1 hasta que expira el TTL. Esto colapsa
// los pans repetidos y el poll de todos los usuarios a ~1 lectura D1 por celda y
// TTL. ponytail: degrada a compute() si el runtime no expone caches (tests/SSR).
async function edgeCached<T>(
  key: string,
  ttlSec: number,
  compute: () => Promise<T>,
): Promise<T> {
  try {
    const cache = (globalThis as unknown as { caches?: { default?: Cache } })
      .caches?.default
    if (!cache) return await compute()
    const req = new Request(`https://edge.ayudave.com/${key}`)
    const hit = await cache.match(req)
    if (hit) return await hit.json()
    const data = await compute()
    await cache.put(
      req,
      new Response(JSON.stringify(data), {
        headers: {
          'content-type': 'application/json',
          'cache-control': `max-age=${ttlSec}`,
        },
      }),
    )
    return data
  } catch {
    return await compute()
  }
}

// Pins por viewport: payload mínimo, índice (lat,lng) hace el BETWEEN barato.
export const fetchReportsInBounds = createServerFn({ method: 'GET' })
  .validator(
    (b: Bounds): Bounds => ({
      s: Number(b.s),
      n: Number(b.n),
      w: Number(b.w),
      e: Number(b.e),
    }),
  )
  .handler(async ({ data }) => {
    // Snap del bbox a grilla 0.1° hacia afuera: pans cercanos comparten clave de
    // cache y el área cacheada siempre cubre el viewport real. ponytail: trae
    // algún pin fuera de pantalla, inofensivo (el cluster lo recorta).
    const G = 0.1
    const s = Math.floor(data.s / G) * G
    const n = Math.ceil(data.n / G) * G
    const w = Math.floor(data.w / G) * G
    const e = Math.ceil(data.e / G) * G
    const key = `bbox-${s.toFixed(1)}_${n.toFixed(1)}_${w.toFixed(1)}_${e.toFixed(1)}`

    // TTL 30s: el poll (30s) puede ver un reporte nuevo con hasta ~30s de retraso
    // (el beep tarda un ciclo). ponytail: si urge inmediatez, poll incremental
    // por created_at en vez de bajar este TTL.
    return edgeCached(key, 30, async () => {
      const db = getDb()
      const rows = await db
        .select(pinCols)
        .from(reports)
        .where(
          and(
            ...visibleFreshConds(),
            gte(reports.lat, s),
            lte(reports.lat, n),
            gte(reports.lng, w),
            lte(reports.lng, e),
          ),
        )
      // Sin cap: mostramos todos los reportes del viewport y la gente decide qué
      // se va y qué se queda. El bbox ya acota y MarkerClusterGroup absorbe miles
      // de pines. Sin límite, el orderBy no aporta (el cluster no respeta orden),
      // así que también lo quitamos. ponytail: si zoomed-out con ~50k+ se pone
      // lento, el upgrade es clustering server-side por tile, no re-poner un cap.
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }))
    })
  })

// Seed para el primer paint: los últimos ~200 reportes visibles, sin bbox. Va en
// el loader SSR del index → viajan en el HTML inicial, así el mapa monta con
// pines + heatmap sin esperar un round-trip. Cacheado en el borde (mismo payload
// para todos). El bbox del viewport los reemplaza apenas resuelve.
export const fetchSeedReports = createServerFn({ method: 'GET' }).handler(
  async () =>
    edgeCached('seed-v1', 30, async () => {
      const db = getDb()
      const rows = await db
        .select(pinCols)
        .from(reports)
        .where(and(...visibleFreshConds()))
        .orderBy(desc(reports.createdAt))
        .limit(200)
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }))
    }),
)

type NewReport = {
  type: string
  lat: number
  lng: number
  description?: string
  contact?: string
  meta?: string
}

export const createReport = createServerFn({ method: 'POST' })
  .validator(
    (d: NewReport): NewReport => ({
      type: String(d.type),
      lat: Number(d.lat),
      lng: Number(d.lng),
      description: d.description ?? '',
      contact: d.contact,
      meta: d.meta,
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const [row] = await db
      .insert(reports)
      .values({
        type: data.type,
        title: TYPES[data.type]?.label ?? data.type,
        description: data.description ?? '',
        lat: data.lat,
        lng: data.lng,
        contact: data.contact ?? null,
        meta: data.meta ?? null,
        creatorIp: clientIp() || null,
      })
      .returning({ id: reports.id })
    return row
  })

// JSON serializable: el validador de createServerFn rechaza `unknown`.
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue }

export type MediaItem = {
  id: string
  url: string
  width: number
  height: number
}

export type ReportDetail = {
  id: string
  type: string
  title: string
  description: string
  lat: number
  lng: number
  confirms: number
  contact: string | null
  url: string | null
  verified: boolean
  status: string // 'visible' | 'found' — el detalle pinta badge si 'found'
  createdAt: number
  meta: Record<string, JsonValue>
  media: MediaItem[]
}

// Detalle completo por id (incluye meta + fotos). Por-reporte, no en el bbox:
// el meta lleva fotos base64 que × 200 pines reventaría el payload de la lista.
export const fetchReport = createServerFn({ method: 'GET' })
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data }): Promise<ReportDetail | null> => {
    const db = getDb()
    // .at(0) (no destructuring) para que el tipo sea Report | undefined: el guard
    // de abajo es real, un id inexistente/oculto devuelve null en vez de crashear.
    const row = (
      await db
        .select()
        .from(reports)
        // 'found' incluido: un reporte encontrado sale del mapa pero su link
        // directo sigue resolviendo (con badge). 'hidden' (moderación) sí queda fuera.
        .where(
          and(
            eq(reports.id, data.id),
            inArray(reports.status, ['visible', 'found']),
          ),
        )
        .limit(1)
    ).at(0)
    if (!row) return null
    let meta: Record<string, JsonValue> = {}
    try {
      meta = row.meta ? JSON.parse(row.meta) : {}
    } catch {
      /* meta corrupto: lo ignoramos, el resto del reporte sigue siendo útil */
    }
    // strip any legacy base64 photos from meta (pre-R2)
    delete meta.photos
    const mediaRows = await db
      .select()
      .from(media)
      .where(eq(media.reportId, data.id))
      .orderBy(asc(media.position))
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      lat: row.lat,
      lng: row.lng,
      confirms: row.confirms,
      contact: row.contact,
      url: row.url ?? null,
      verified: row.verified,
      status: row.status,
      createdAt: row.createdAt.getTime(),
      meta,
      media: mediaRows.map((m) => ({
        id: m.id,
        url: import.meta.env.DEV
          ? `/media/${m.key}`
          : `https://media.ayudave.com/${m.key}`,
        width: m.width,
        height: m.height,
      })),
    }
  })

export const confirmReport = createServerFn({ method: 'POST' })
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data }) => {
    const db = getDb()
    const ip = clientIp()
    const ua = clientUa()

    // Bloquear self-confirm: comparamos IP del creador (si se guardó)
    if (ip) {
      const [report] = await db
        .select({ creatorIp: reports.creatorIp })
        .from(reports)
        .where(eq(reports.id, data.id))
        .limit(1)
      if (report?.creatorIp && report.creatorIp === ip)
        return { ok: false, reason: 'self' as const }
    }

    // Dedup: una confirmación por IP por reporte
    if (ip) {
      const existing = await db
        .select({ id: reportConfirms.id })
        .from(reportConfirms)
        .where(
          and(eq(reportConfirms.reportId, data.id), eq(reportConfirms.ip, ip)),
        )
        .limit(1)
      if (existing.length) return { ok: false, reason: 'already' as const }
    }

    await db.insert(reportConfirms).values({ reportId: data.id, ip, ua })
    await db
      .update(reports)
      .set({ confirms: sql`${reports.confirms} + 1` })
      .where(eq(reports.id, data.id))
    return { ok: true }
  })

// ponytail: auto-oculta a 5 flags; mover a cola de moderación en /admin si
// aparece abuso coordinado. El anti-doble-voto vive en el cliente (localStorage).
const FLAG_HIDE = 5
export const flagReport = createServerFn({ method: 'POST' })
  .validator((d: { id: string; reason?: string }) => ({
    id: String(d.id),
    reason: d.reason ? String(d.reason) : undefined,
  }))
  .handler(async ({ data }) => {
    const db = getDb()
    await db
      .update(reports)
      .set({
        flags: sql`${reports.flags} + 1`,
        status: sql`case when ${reports.flags} + 1 >= ${FLAG_HIDE} then 'hidden' else ${reports.status} end`,
      })
      .where(eq(reports.id, data.id))
    // ponytail: el motivo del flag se guarda en `comments` (prefijo [reporte])
    // hasta que exista /admin con su propia tabla de moderación.
    const reason = data.reason?.trim()
    if (reason)
      await db
        .insert(comments)
        .values({ reportId: data.id, text: `[reporte] ${reason}` })
  })

// "Ya apareció": solo para desaparecidos de la comunidad. Auto-oculta a los 3
// votos (mismo mecanismo que flags → status='hidden', que las queries ya filtran).
// ponytail: anti-doble-voto en el cliente (localStorage), como flag. El where
// blinda contra ocultar reportes verificados o de otro tipo aunque pasen el id.
const APPEARED_HIDE = 3
export const appearReport = createServerFn({ method: 'POST' })
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data }) => {
    const db = getDb()
    await db
      .update(reports)
      .set({
        appeared: sql`${reports.appeared} + 1`,
        status: sql`case when ${reports.appeared} + 1 >= ${APPEARED_HIDE} then 'hidden' else ${reports.status} end`,
      })
      .where(
        and(
          eq(reports.id, data.id),
          eq(reports.type, 'missing'),
          eq(reports.verified, false),
        ),
      )
  })
