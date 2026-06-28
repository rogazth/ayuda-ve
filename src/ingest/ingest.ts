// Lógica pura del ingest scrapeado (admin Laravel → POST /internal/ingest). Sin
// I/O ni `cloudflare:workers` para que sea testeable en node (vitest). La ruta
// (internal.ingest.tsx) hace el I/O de D1 y delega aquí las decisiones.
//
// El admin ya geocodificó y subió la media a R2; el Worker solo hace upsert por
// (externalSource, externalId). REGLA CLAVE: un re-upsert NO pisa estado de
// comunidad/moderación (confirms/flags/appeared/creatorIp) ni revive un reporte
// oculto. Solo escribe lo que es del origen.
import { safeUrl } from '../reports/reports'

export const INGEST_TYPES = ['missing', 'danger', 'lostpet'] as const
export type IngestType = (typeof INGEST_TYPES)[number]

const MAX_RECORDS = 200 // tope de batch por request
const MEDIA_CT = /^image\/(jpeg|webp|png|gif)$/

export type IngestMedia = {
  key: string
  contentType: string
  width: number
  height: number
  position: number
}

export type IngestRecord = {
  externalSource: string
  externalId: string
  type: IngestType
  title: string
  description: string
  lat: number
  lng: number
  status: 'visible' | 'found'
  verified: boolean
  url?: string
  contact?: string
  media: IngestMedia[]
  meta: Record<string, unknown>
}

const isFiniteNum = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x)

// Crudo del origen → status persistible. El admin ya manda 'visible'/'found',
// pero mapeamos defensivamente cualquier variante de "encontrado/localizado".
export function mapStatus(raw: string): 'visible' | 'found' {
  return /found|encontrad|hallad|localizad/i.test(raw) ? 'found' : 'visible'
}

// Status a persistir en el update: un reporte oculto por moderación/flags
// (status='hidden') NUNCA se revive a visible por un re-scrape.
export function resolveStatus(
  existingStatus: string,
  sourceStatus: 'visible' | 'found',
): string {
  return existingStatus === 'hidden' ? 'hidden' : sourceStatus
}

// Comparación en tiempo (casi) constante: recorre el largo máximo e incluye la
// diferencia de longitud, para no filtrar el largo del secreto por early-return.
export function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

export type AuthResult =
  | { ok: true }
  | { ok: false; status: number; message: string }

// Auth de /internal/*: bearer (tiempo constante) + allowlist de IP. Fail-closed
// si faltan los secrets. Pura: la ruta le pasa env + headers.
export function checkAuth(opts: {
  key?: string
  allowed?: string
  authHeader: string | null
  ip: string | null
}): AuthResult {
  if (!opts.key || !opts.allowed)
    return { ok: false, status: 503, message: 'ingest not configured' }
  const m = /^Bearer\s+(.+)$/i.exec(opts.authHeader ?? '')
  if (!m || !timingSafeEqual(m[1], opts.key))
    return { ok: false, status: 401, message: 'unauthorized' }
  const list = opts.allowed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!opts.ip || !list.includes(opts.ip))
    return { ok: false, status: 403, message: 'forbidden ip' }
  return { ok: true }
}

type ParseOk = { ok: true; value: IngestRecord }
type ParseErr = { ok: false; error: string }

// Valida un record manualmente (el repo no usa Zod). Saneamos lo que se va a
// renderizar/enlazar (url por safeUrl, longitudes). `meta` se guarda verbatim
// (es el shape rico del admin); sourceCreatedAt se mete en meta (sin columna aún).
export function parseIngestRecord(raw: unknown): ParseOk | ParseErr {
  if (!raw || typeof raw !== 'object')
    return { ok: false, error: 'record not an object' }
  const r = raw as Record<string, unknown>

  const externalSource = String(r.externalSource ?? '').trim()
  if (!externalSource) return { ok: false, error: 'externalSource required' }
  const externalId = String(r.externalId ?? '').trim()
  if (!externalId) return { ok: false, error: 'externalId required' }
  if (!INGEST_TYPES.includes(r.type as IngestType))
    return { ok: false, error: `type must be one of ${INGEST_TYPES.join('|')}` }
  const title = String(r.title ?? '')
    .trim()
    .slice(0, 200)
  if (!title) return { ok: false, error: 'title required' }
  if (!isFiniteNum(r.lat) || !isFiniteNum(r.lng))
    return { ok: false, error: 'lat/lng must be finite numbers' }
  if (r.lat < -90 || r.lat > 90 || r.lng < -180 || r.lng > 180)
    return { ok: false, error: 'lat/lng out of range' }

  const media: IngestMedia[] = []
  const mediaRaw = Array.isArray(r.media) ? r.media : []
  for (const item of mediaRaw) {
    if (!item || typeof item !== 'object')
      return { ok: false, error: 'media item not an object' }
    const m = item as Record<string, unknown>
    const key = String(m.key ?? '').trim()
    if (!key) return { ok: false, error: 'media.key required' }
    const contentType = String(m.contentType ?? '').trim()
    if (!MEDIA_CT.test(contentType))
      return { ok: false, error: 'media.contentType invalid' }
    if (
      !isFiniteNum(m.width) ||
      !isFiniteNum(m.height) ||
      m.width <= 0 ||
      m.height <= 0
    )
      return { ok: false, error: 'media dims invalid' }
    media.push({
      key,
      contentType,
      width: m.width,
      height: m.height,
      position: isFiniteNum(m.position) ? m.position : media.length,
    })
  }

  const meta =
    r.meta && typeof r.meta === 'object'
      ? { ...(r.meta as Record<string, unknown>) }
      : {}
  if (r.sourceCreatedAt != null) meta.sourceCreatedAt = String(r.sourceCreatedAt)

  return {
    ok: true,
    value: {
      externalSource,
      externalId,
      type: r.type as IngestType,
      title,
      description:
        r.description != null ? String(r.description).slice(0, 5000) : '',
      lat: r.lat,
      lng: r.lng,
      status: mapStatus(String(r.status ?? 'visible')),
      verified: Boolean(r.verified),
      url: r.url != null ? (safeUrl(String(r.url)) ?? undefined) : undefined,
      contact: r.contact != null ? String(r.contact).slice(0, 200) : undefined,
      media,
      meta,
    },
  }
}

export function parseIngestBody(
  raw: unknown,
): { ok: true; value: IngestRecord[] } | ParseErr {
  if (!raw || typeof raw !== 'object')
    return { ok: false, error: 'body not an object' }
  const records = (raw as { records?: unknown }).records
  if (!Array.isArray(records))
    return { ok: false, error: 'records must be an array' }
  if (records.length === 0) return { ok: false, error: 'records empty' }
  if (records.length > MAX_RECORDS)
    return { ok: false, error: `too many records (max ${MAX_RECORDS})` }
  const out: IngestRecord[] = []
  for (let i = 0; i < records.length; i++) {
    const p = parseIngestRecord(records[i])
    if (!p.ok) return { ok: false, error: `record[${i}]: ${p.error}` }
    out.push(p.value)
  }
  return { ok: true, value: out }
}

// Columnas que el ingest escribe en un INSERT. id lo genera el caller (Worker).
export function insertValues(r: IngestRecord) {
  return {
    type: r.type,
    title: r.title,
    description: r.description,
    lat: r.lat,
    lng: r.lng,
    status: r.status,
    contact: r.contact ?? null,
    url: r.url ?? null,
    verified: r.verified,
    meta: JSON.stringify(r.meta),
    externalSource: r.externalSource,
    externalId: r.externalId,
  }
}

// Columnas que el ingest escribe en un UPDATE. NO toca confirms/flags/appeared/
// creatorIp/createdAt (estado de comunidad/moderación) ni revive un hidden.
export function updateValues(r: IngestRecord, existingStatus: string) {
  return {
    type: r.type,
    title: r.title,
    description: r.description,
    lat: r.lat,
    lng: r.lng,
    status: resolveStatus(existingStatus, r.status),
    contact: r.contact ?? null,
    url: r.url ?? null,
    verified: r.verified,
    meta: JSON.stringify(r.meta),
  }
}

// Media en el update: array vacío = preservar la existente (un fallo transitorio
// de descarga en el admin manda []). No vacío = set autoritativo → el caller
// borra la media del reporte y reinserta esta.
export function mediaToReplace(incoming: IngestMedia[]): IngestMedia[] | null {
  return incoming.length ? incoming : null
}
