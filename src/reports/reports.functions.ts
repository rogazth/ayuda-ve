import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server'
import { and, asc, desc, eq, gte, lte, ne, or, sql } from 'drizzle-orm'
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
// TODO(albergue): los albergues sembrados deberían exentarse de este filtro.
const FRESH_MS = 48 * 60 * 60 * 1000
// Alertas de seguridad expiran en 12h — son eventos puntuales, no permanentes.
const SECURITY_TTL_MS = 12 * 60 * 60 * 1000

export type Bounds = { s: number; n: number; w: number; e: number }

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
    const db = getDb()
    const cutoff = new Date(Date.now() - FRESH_MS)
    const securityCutoff = new Date(Date.now() - SECURITY_TTL_MS)
    const rows = await db
      .select({
        id: reports.id,
        type: reports.type,
        title: reports.title,
        lat: reports.lat,
        lng: reports.lng,
        confirms: reports.confirms,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(
        and(
          eq(reports.status, 'visible'),
          gte(reports.lat, data.s),
          lte(reports.lat, data.n),
          gte(reports.lng, data.w),
          lte(reports.lng, data.e),
          gte(reports.createdAt, cutoff),
          // alertas de seguridad expiran en 12h
          or(ne(reports.type, 'security'), gte(reports.createdAt, securityCutoff)),
        ),
      )
      .orderBy(desc(reports.createdAt))
      .limit(200)

    return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }))
  })

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

export type MediaItem = { id: string; url: string; width: number; height: number }

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
        .where(and(eq(reports.id, data.id), eq(reports.status, 'visible')))
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
      if (report?.creatorIp && report.creatorIp === ip) return { ok: false, reason: 'self' as const }
    }

    // Dedup: una confirmación por IP por reporte
    if (ip) {
      const existing = await db
        .select({ id: reportConfirms.id })
        .from(reportConfirms)
        .where(and(eq(reportConfirms.reportId, data.id), eq(reportConfirms.ip, ip)))
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
