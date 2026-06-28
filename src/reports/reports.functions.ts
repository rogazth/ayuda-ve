import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, gte, inArray, lt, lte, ne, or, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { media, reportConfirms, reports } from '../db/schema'
import { clientCountry, clientIpHash, clientUa } from '../server/req'
import { countryFlag, isoForCountry } from '../geo/countries'
import { TYPES, safeUrl } from './reports'

// Decisión PO: el mapa muestra TODO lo visible, sin corte de antigüedad. La
// visibilidad la maneja solo `status` (hidden por moderación/flags, found cuando
// la fuente lo marca). Única excepción temporal: las alertas de seguridad son
// eventos puntuales y expiran a 24h.
const SECURITY_TTL_MS = 24 * 60 * 60 * 1000

// URL pública de un objeto en R2. En dev el SW proxea /media/<key>; en prod sale
// del bucket público. Una sola fuente para detalle y feed.
const mediaUrl = (key: string) =>
  import.meta.env.DEV ? `/media/${key}` : `https://media.ayudave.com/${key}`

export type Bounds = { s: number; n: number; w: number; e: number; types?: string[] }

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

// Reglas de visibilidad compartidas: solo `status='visible'`, sin corte de
// antigüedad (decisión PO). Única excepción: las alertas de seguridad expiran a 24h.
function visibleFreshConds() {
  const securityCutoff = new Date(Date.now() - SECURITY_TTL_MS)
  return [
    eq(reports.status, 'visible'),
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
      // filtro opcional por tipo (zoom-out global pide solo 'support'); whitelist
      types: Array.isArray(b.types)
        ? b.types.map(String).filter((t) => Object.hasOwn(TYPES, t))
        : undefined,
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
    const typeFilter = data.types?.length ? data.types : null
    const key = `bbox-${s.toFixed(1)}_${n.toFixed(1)}_${w.toFixed(1)}_${e.toFixed(1)}${typeFilter ? `_${typeFilter.join(',')}` : ''}`

    // TTL 30s: el poll (30s) puede ver un reporte nuevo con hasta ~30s de retraso
    // (el beep tarda un ciclo). ponytail: si urge inmediatez, poll incremental
    // por created_at en vez de bajar este TTL.
    return edgeCached(key, 30, async () => {
      const db = getDb()
      // Agregamos por coordenada: la fuente geocodifica por centroide de municipio,
      // así que ~14k reportes caen en ~1.5k puntos (un punto de Caracas tiene 2.5k+
      // apilados). Sin agregar mandaríamos miles de marcadores a un pixel — lag puro.
      // GROUP BY lat,lng → un punto por coordenada con su conteo (n). Esto acota los
      // marcadores al nº de coords distintas del viewport (≤1.5k en todo el país),
      // no al nº de reportes: el cliente nunca lagea por más que crezca la tabla.
      // Bare-columns con max(created_at): id/type/title salen del reporte más nuevo
      // del punto (el representante del apilado). n>1 → el cliente pinta burbuja y
      // abre el drawer de apilados (fetchReportsAtPoint).
      const rows = await db
        .select({
          id: reports.id,
          type: reports.type,
          title: reports.title,
          lat: reports.lat,
          lng: reports.lng,
          confirms: reports.confirms,
          createdAt: sql<number>`max(${reports.createdAt})`,
          n: sql<number>`count(*)`,
        })
        .from(reports)
        .where(
          and(
            ...visibleFreshConds(),
            ...(typeFilter ? [inArray(reports.type, typeFilter)] : []),
            gte(reports.lat, s),
            lte(reports.lat, n),
            gte(reports.lng, w),
            lte(reports.lng, e),
          ),
        )
        .groupBy(reports.lat, reports.lng)
      // createdAt viene crudo (segundos) por el sql max(); ×1000 → ms como el resto.
      return rows.map((r) => ({
        ...r,
        createdAt: Number(r.createdAt) * 1000,
        n: Number(r.n),
      }))
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

// Centros de acopio (type 'support') para la pestaña "Cómo ayudar": lista completa
// agrupable por país. Es chica (~700) y global → la traemos toda, sin bbox. La lista
// se cachea en el borde; `suggested` (país del visitante, CF-IPCountry) se computa
// por request — pre-selecciona el país si tenemos centros ahí.
export type AidCenter = {
  id: string
  name: string
  country: string
  countryCode: string | null
  flag: string
  city: string | null
  address: string | null
  needs: string[]
  contact: string | null
  url: string | null
  lat: number
  lng: number
}

export const fetchAidCenters = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ centers: AidCenter[]; suggested: string | null }> => {
    const centers = await edgeCached('aid-centers-v1', 60, async () => {
      const db = getDb()
      const rows = await db
        .select({
          id: reports.id,
          name: reports.title,
          lat: reports.lat,
          lng: reports.lng,
          contact: reports.contact,
          url: reports.url,
          meta: reports.meta,
        })
        .from(reports)
        .where(and(eq(reports.type, 'support'), eq(reports.status, 'visible')))
        .orderBy(asc(reports.title))
      return rows.map((r): AidCenter => {
        const m = (() => {
          try {
            return JSON.parse(r.meta ?? '{}') as Record<string, unknown>
          } catch {
            return {}
          }
        })()
        const country = typeof m.country === 'string' && m.country.trim() ? m.country.trim() : 'Otro'
        return {
          id: r.id,
          name: r.name,
          country,
          countryCode: isoForCountry(country),
          flag: countryFlag(country),
          city: typeof m.city === 'string' ? m.city : null,
          address: typeof m.address === 'string' ? m.address : null,
          needs: Array.isArray(m.available) ? m.available.map(String) : [],
          contact: r.contact,
          url: r.url,
          lat: r.lat,
          lng: r.lng,
        }
      })
    })
    // Pre-selección: país del visitante (CF) si tenemos centros ahí. Fuera del cache
    // (varía por request); barato (un find sobre ~700).
    const iso = clientCountry()
    const suggested = iso
      ? (centers.find((c) => c.countryCode === iso)?.country ?? null)
      : null
    return { centers, suggested }
  },
)

// Lista de reportes apilados en una coordenada (el bbox la colapsa a un punto con
// n). Se pide al tocar la burbuja y se pinta con la misma card del feed (FeedItem:
// portada + nº de fotos + dirección). Epsilon en vez de igualdad exacta de float
// por robustez al round-trip del double por JSON. Cacheado: un punto caliente
// (Caracas) lo tocan muchos y la query barre miles de filas.
export const fetchReportsAtPoint = createServerFn({ method: 'GET' })
  .validator((d: { lat: number; lng: number }) => ({
    lat: Number(d.lat),
    lng: Number(d.lng),
  }))
  .handler(async ({ data }): Promise<FeedItem[]> => {
    const E = 1e-6
    const key = `pt-${data.lat.toFixed(4)}_${data.lng.toFixed(4)}`
    return edgeCached(key, 60, async () => {
      const db = getDb()
      const pointConds = [
        ...visibleFreshConds(),
        gte(reports.lat, data.lat - E),
        lte(reports.lat, data.lat + E),
        gte(reports.lng, data.lng - E),
        lte(reports.lng, data.lng + E),
      ]
      const rows = await db
        .select({
          id: reports.id,
          type: reports.type,
          title: reports.title,
          confirms: reports.confirms,
          verified: reports.verified,
          status: reports.status,
          createdAt: reports.createdAt,
          meta: reports.meta,
        })
        .from(reports)
        .where(and(...pointConds))
        .orderBy(desc(reports.createdAt))
      if (!rows.length) return []
      // Media por el mismo predicado de punto (join), no por lista de ids: un punto
      // caliente apila miles de reportes y un IN con miles de ids revienta el límite
      // de parámetros de D1. ponytail: si un punto se vuelve pesado, paginar el
      // apilado; hoy se trae todo para que ningún reporte quede inalcanzable.
      const mediaRows = await db
        .select({ reportId: media.reportId, key: media.key, position: media.position })
        .from(media)
        .innerJoin(reports, eq(media.reportId, reports.id))
        .where(and(...pointConds))
      const byReport = groupMedia(mediaRows)
      return rows.map((r) => toFeedItem(r, byReport.get(r.id) ?? []))
    })
  })

// Card del feed: payload liviano (sin meta ni todas las fotos). Solo portada +
// conteo; el detalle (fetchReport) trae el carrusel completo al abrir.
export type FeedItem = {
  id: string
  type: string
  title: string
  confirms: number
  verified: boolean
  status: string
  createdAt: number
  cover: string | null
  mediaCount: number
  address: string | null
}

// Dirección legible para la card del feed, desde el meta del reporte (misma
// fuente que el detalle: address > location > zone). ponytail: el meta legacy
// puede traer fotos base64 → no parseamos blobs gigantes (createReport ya capa a
// 8k; el guard cubre filas viejas).
function feedAddress(metaRaw: string | null): string | null {
  if (!metaRaw || metaRaw.length > 16000) return null
  try {
    const m = JSON.parse(metaRaw) as Record<string, unknown>
    for (const k of ['address', 'location', 'zone']) {
      const v = m[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  } catch {
    /* meta corrupto: la card va sin dirección */
  }
  return null
}

// Agrupa filas de media por reporte (portada = la de menor position).
function groupMedia(rows: { reportId: string; key: string; position: number }[]) {
  const m = new Map<string, { key: string; position: number }[]>()
  for (const x of rows) {
    const arr = m.get(x.reportId)
    if (arr) arr.push(x)
    else m.set(x.reportId, [x])
  }
  return m
}

// Arma un FeedItem desde la fila del reporte + sus medias. Portada = position
// mínima; mediaCount = total. Compartido por el feed y los apilados.
function toFeedItem(
  r: {
    id: string
    type: string
    title: string
    confirms: number
    verified: boolean
    status: string
    createdAt: Date
    meta: string | null
  },
  ms: { key: string; position: number }[],
): FeedItem {
  const cover = ms.reduce<(typeof ms)[number] | null>(
    (a, m) => (!a || m.position < a.position ? m : a),
    null,
  )
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    confirms: r.confirms,
    verified: r.verified,
    status: r.status,
    createdAt: r.createdAt.getTime(),
    cover: cover ? mediaUrl(cover.key) : null,
    mediaCount: ms.length,
    address: feedAddress(r.meta),
  }
}

type FeedQuery = { cursor?: number; types?: string[]; status?: 'visible' | 'found' }
const FEED_LIMIT = 20

// Feed cronológico paginado por cursor (createdAt). 'found' lista los reportes
// que salieron del mapa por aparecer (chip de status); el resto = visible+fresco.
// Cacheado por (status, tipos, cursor): páginas iguales colapsan a 1 lectura D1.
export const fetchFeed = createServerFn({ method: 'GET' })
  .validator((d: FeedQuery): FeedQuery => {
    const cursor =
      d.cursor != null && Number.isFinite(Number(d.cursor))
        ? Number(d.cursor)
        : undefined
    const types = Array.isArray(d.types)
      ? d.types
          .map(String)
          .filter((t) => Object.hasOwn(TYPES, t))
          .slice(0, 20)
      : undefined
    const status = d.status === 'found' ? ('found' as const) : undefined
    return { cursor, types: types?.length ? types : undefined, status }
  })
  .handler(async ({ data }): Promise<FeedItem[]> => {
    const key = `feed-${data.status ?? 'v'}-${data.types?.join('.') ?? 'all'}-${data.cursor ?? 0}`
    return edgeCached(key, 30, async () => {
      const db = getDb()
      const conds =
        data.status === 'found'
          ? [eq(reports.status, 'found')]
          : [...visibleFreshConds()]
      if (data.types) conds.push(inArray(reports.type, data.types))
      if (data.cursor != null)
        conds.push(lt(reports.createdAt, new Date(data.cursor)))
      const rows = await db
        .select({
          id: reports.id,
          type: reports.type,
          title: reports.title,
          confirms: reports.confirms,
          verified: reports.verified,
          status: reports.status,
          createdAt: reports.createdAt,
          meta: reports.meta,
        })
        .from(reports)
        .where(and(...conds))
        .orderBy(desc(reports.createdAt))
        .limit(FEED_LIMIT)
      if (!rows.length) return []
      // Portada + conteo de una sola query a media para los ≤20 ids de la página.
      const ids = rows.map((r) => r.id)
      const mediaRows = await db
        .select({ reportId: media.reportId, key: media.key, position: media.position })
        .from(media)
        .where(inArray(media.reportId, ids))
      const byReport = groupMedia(mediaRows)
      return rows.map((r) => toFeedItem(r, byReport.get(r.id) ?? []))
    })
  })

export type TypeCounts = { counts: Record<string, number>; found: number }

// Conteo por tipo para los chips (visible+fresco) + total de "Encontrados".
// Cacheado: lo piden todos los que abren Reportes y barre toda la tabla.
export const fetchTypeCounts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TypeCounts> =>
    edgeCached('type-counts-v1', 30, async () => {
      const db = getDb()
      const rows = await db
        .select({ type: reports.type, n: sql<number>`count(*)` })
        .from(reports)
        .where(and(...visibleFreshConds()))
        .groupBy(reports.type)
      const counts: Record<string, number> = {}
      for (const r of rows) counts[r.type] = Number(r.n)
      const [found] = await db
        .select({ n: sql<number>`count(*)` })
        .from(reports)
        .where(eq(reports.status, 'found'))
      return { counts, found: Number(found.n) }
    }),
)

type NewReport = {
  type: string
  lat: number
  lng: number
  description?: string
  contact?: string
  meta?: string
  url?: string
}

export const createReport = createServerFn({ method: 'POST' })
  .validator((d: NewReport): NewReport => {
    const type = String(d.type)
    if (!Object.hasOwn(TYPES, type)) throw new Error('tipo inválido')
    const lat = Number(d.lat)
    const lng = Number(d.lng)
    // bbox generoso de Venezuela (+ margen): rechaza 0,0, NaN y otro continente.
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -1 ||
      lat > 16 ||
      lng < -75 ||
      lng > -58
    )
      throw new Error('coordenadas fuera de rango')
    const description = (d.description ?? '').slice(0, 2000)
    const contact = d.contact ? String(d.contact).slice(0, 200) : undefined
    const meta = d.meta ? String(d.meta) : undefined
    if (meta !== undefined) {
      if (meta.length > 8000) throw new Error('meta demasiado grande')
      try {
        JSON.parse(meta) // rechaza meta corrupto antes de persistir
      } catch {
        throw new Error('meta inválido')
      }
    }
    // Fuente/url: solo http(s) sin credenciales (safeUrl). Inválida → se descarta
    // (campo opcional); el cliente ya la bloquea, esto cierra el trust boundary.
    const url = d.url ? (safeUrl(String(d.url).slice(0, 500)) ?? undefined) : undefined
    return { type, lat, lng, description, contact, meta, url }
  })
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
        url: data.url ?? null,
        creatorIp: (await clientIpHash()) || null,
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
        url: mediaUrl(m.key),
        width: m.width,
        height: m.height,
      })),
    }
  })

export const confirmReport = createServerFn({ method: 'POST' })
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data }) => {
    const db = getDb()
    const ip = await clientIpHash()
    const ua = clientUa()

    // Bloquear self-confirm: comparamos hash de IP del creador (si se guardó)
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
    reason: d.reason ? String(d.reason).slice(0, 500) : undefined,
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
    // ponytail: auditoría en moderation_events parqueada para Etapa 2 (no hay
    // admin UI que la lea). `reason` se sigue validando; se persistirá al wirear.
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
