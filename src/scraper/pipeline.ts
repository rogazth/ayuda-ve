import { env } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'
import type { getDb } from '../db'
import { media, reports } from '../db/schema'
import { resolveGeo } from './geocode'
import { imageSize } from './image'
import type { RawPerson, Source } from './types'

type Db = ReturnType<typeof getDb>

// Política de calidad (el usuario: geo buena o skip; imágenes vitales).
const REQUIRE_IMAGE = true // sin foto verificable no entra al mapa
const MAX_IMG_BYTES = 6 * 1024 * 1024
const UA = 'AyudaVE-bot/0.1 (+https://ayudave.com; agregador de desaparecidos)'

export type IngestResult =
  | { kind: 'inserted' }
  | { kind: 'updated' }
  | { kind: 'skipped'; reason: string }

// Descarga la foto, la mide y la sube a R2. Devuelve la fila media o null.
// Exportada para reusarla desde el scraper de daños (damage.ts).
export async function storeImage(reportId: string, url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.startsWith('image/')) return null
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.byteLength === 0 || buf.byteLength > MAX_IMG_BYTES) return null
  const dim = imageSize(buf)
  if (!dim || dim.width < 1 || dim.height < 1) return null // formato raro/corrupto → fuera
  const ext = ct.includes('png')
    ? 'png'
    : ct.includes('webp')
      ? 'webp'
      : ct.includes('gif')
        ? 'gif'
        : 'jpg'
  const id = crypto.randomUUID()
  const key = `reports/${reportId}/${id}.${ext}`
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: ct } })
  return { id, key, contentType: ct, width: dim.width, height: dim.height }
}

export async function ingestPerson(
  db: Db,
  source: Source,
  p: RawPerson,
): Promise<IngestResult> {
  const found = /found|encontrad|hallad/i.test(p.status)
  // resuelve el texto libre (Nominatim cacheado → gazetteer). Devuelve null si
  // no logra precisión de pueblo/calle → geo buena o skip.
  const geo = await resolveGeo(db, p.locationText, p.state)

  const existing = (
    await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(eq(reports.externalSource, source.id), eq(reports.externalId, p.externalId)),
      )
      .limit(1)
  ).at(0)

  // Geo buena o skip (solo bloquea altas nuevas; a las existentes les
  // refrescamos texto aunque ya no resuelvan).
  if (!existing && !geo) {
    return { kind: 'skipped', reason: 'geo' }
  }

  const meta = JSON.stringify({
    source: source.id,
    missingName: p.name,
    age: p.age,
    gender: p.gender,
    status: p.status,
    lastSeen: p.lastSeen,
    location: p.locationText,
    state: p.state,
    ...p.extra,
  })

  // createdAt re-estampado: el mapa filtra a 48h; mientras la fuente liste a
  // la persona la mantenemos "fresca"; si la quita, envejece y cae sola.
  const common = {
    type: 'missing' as const,
    title: p.name,
    description: p.description ?? '',
    contact: p.contact ?? null,
    url: p.sourceUrl ?? null,
    status: found ? 'hidden' : 'visible',
    verified: false,
    meta,
    externalSource: source.id,
    externalId: p.externalId,
    createdAt: new Date(),
    ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
  }

  if (existing) {
    await db.update(reports).set(common).where(eq(reports.id, existing.id))
    // backfill de foto si quedó sin media en una corrida previa
    const hasMedia = (
      await db.select({ id: media.id }).from(media).where(eq(media.reportId, existing.id)).limit(1)
    ).length
    if (!hasMedia && p.photoUrl) {
      const img = await storeImage(existing.id, p.photoUrl)
      if (img) {
        await db
          .insert(media)
          .values({ ...img, reportId: existing.id, position: 0 })
      }
    }
    return { kind: 'updated' }
  }

  // Alta nueva: la foto es obligatoria. La bajamos ANTES de insertar para no
  // dejar un reporte sin imagen si la descarga falla.
  let img: Awaited<ReturnType<typeof storeImage>> = null
  const id = crypto.randomUUID()
  if (p.photoUrl) img = await storeImage(id, p.photoUrl)
  if (REQUIRE_IMAGE && !img) return { kind: 'skipped', reason: p.photoUrl ? 'photo-failed' : 'no-photo' }

  await db.insert(reports).values({ id, lat: geo!.lat, lng: geo!.lng, ...common })
  if (img) await db.insert(media).values({ ...img, reportId: id, position: 0 })
  return { kind: 'inserted' }
}
