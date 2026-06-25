import { eq } from 'drizzle-orm'
import type { getDb } from '../db'
import { geocache } from '../db/schema'
import { geocode as gazetteer } from './gazetteer'

type Db = ReturnType<typeof getDb>
export type Geo = { lat: number; lng: number; precision: string }

// Resultados demasiado gruesos: un centroide de estado/país re-introduce el
// apelotonamiento. Si Nominatim solo llega a esto, lo tratamos como no-resuelto.
const COARSE = new Set([
  'country',
  'state',
  'region',
  'province',
  'county',
  'state_district',
  'political',
])

const key = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim()

// Throttle global a ~1 req/s: política de Nominatim. Asigna slots en serie para
// que funcione correctamente bajo concurrencia (cada caller toma el próximo slot
// disponible antes de await, así no hay race condition).
let nextCallAt = 0
async function throttle() {
  const now = Date.now()
  const slot = (nextCallAt = Math.max(nextCallAt, now))
  nextCallAt = slot + 1100
  const wait = slot - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

async function nominatim(text: string): Promise<Geo | null> {
  await throttle()
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2` +
    `&countrycodes=ve&limit=1&accept-language=es&q=${encodeURIComponent(text)}`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'AyudaVE/0.1 (emergencia Venezuela; contacto: ayudave.com)' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return null
    const arr = (await r.json()) as Array<{
      lat: string
      lon: string
      addresstype?: string
      type?: string
    }>
    const hit = arr[0]
    if (!hit) return null
    const at = hit.addresstype ?? hit.type ?? ''
    if (COARSE.has(at)) return null // demasiado grueso → mejor skip
    return { lat: Number(hit.lat), lng: Number(hit.lon), precision: at || 'place' }
  } catch {
    return null // timeout/red: caemos al gazetteer abajo
  }
}

// Resuelve un texto libre a lat/lng. Orden: caché D1 → Nominatim → gazetteer
// offline (red de seguridad si la API está caída). Nominatim PRIMERO a propósito:
// "Macuto, la guaira" debe ir a Macuto, no caer al centroide de La Guaira del
// gazetteer. Cachea también los misses para no repetir consultas.
export async function resolveGeo(
  db: Db,
  place?: string,
  state?: string,
): Promise<Geo | null> {
  const text = [place, state].filter(Boolean).join(', ').trim()
  if (!text) return null
  const k = key(text)

  const cached = (
    await db.select().from(geocache).where(eq(geocache.query, k)).limit(1)
  ).at(0)
  if (cached) {
    return cached.lat != null && cached.lng != null
      ? { lat: cached.lat, lng: cached.lng, precision: cached.precision ?? 'cache' }
      : null
  }

  let geo = await nominatim(text)
  if (!geo) {
    // fallback offline: solo aceptamos match de ciudad (no centroide de estado)
    const gz = gazetteer(state, place)
    if (gz && gz.precision === 'city') geo = { ...gz }
  }

  await db
    .insert(geocache)
    .values({
      query: k,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      precision: geo?.precision ?? null,
    })
    .onConflictDoNothing()
  return geo
}
