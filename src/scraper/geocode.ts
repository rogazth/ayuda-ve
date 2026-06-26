import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import type { getDb } from '../db'
import { geocache } from '../db/schema'
import { geocode as gazetteer } from './gazetteer'

type Db = ReturnType<typeof getDb>
export type Geo = { lat: number; lng: number; precision: string }

const key = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim()

// Throttle global. Mapbox no tiene la regla de 1 req/s de Nominatim: el límite
// del free tier de geocoding es ~600 req/min. 120ms entre slots ≈ 500/min, con
// margen. Asigna slots en serie para que funcione bajo concurrencia (cada caller
// toma el próximo slot antes de await, sin race condition).
// ponytail: 120ms = techo seguro del free tier. Si subís de plan, bajalo.
const SLOT_MS = 120
let nextCallAt = 0
async function throttle() {
  const now = Date.now()
  const slot = (nextCallAt = Math.max(nextCallAt, now))
  nextCallAt = slot + SLOT_MS
  const wait = slot - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

// Geocoder. types= restringe a granularidad de pueblo o más fina: deja fuera
// region/district/postcode/country, que serían un centroide de estado y re-
// introducirían el apelotonamiento (igual política que con Nominatim).
// Lanza ante un fallo transitorio (red/timeout/429/5xx) para que resolveGeo NO
// cachee un miss falso. Devuelve null solo si la API respondió 200 sin resultado.
async function mapbox(text: string): Promise<Geo | null> {
  await throttle()
  const url =
    `https://api.mapbox.com/search/geocode/v6/forward?country=ve&limit=1` +
    `&language=es&types=address,street,neighborhood,locality,place` +
    `&q=${encodeURIComponent(text)}&access_token=${env.MAPBOX_TOKEN}`
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!r.ok) throw new Error(`mapbox ${r.status}`) // transitorio → no cachear miss
  const data = (await r.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] }
      properties?: { feature_type?: string }
    }>
  }
  const hit = data.features?.[0]
  const coords = hit?.geometry?.coordinates
  if (!coords) return null
  const [lng, lat] = coords
  return { lat, lng, precision: hit?.properties?.feature_type || 'place' }
}

// Resuelve un texto libre a lat/lng. Orden: caché D1 → Mapbox → gazetteer offline
// (red de seguridad si la API está caída). Mapbox PRIMERO a propósito: "Macuto,
// la guaira" debe ir a Macuto, no caer al centroide de La Guaira del gazetteer.
// Cachea también los misses para no repetir consultas — salvo si Mapbox falló de
// forma transitoria, ahí reintenta en la próxima corrida (no quema cobertura).
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

  let geo: Geo | null = null
  let transient = false
  try {
    geo = await mapbox(text)
  } catch {
    transient = true // API caída/throttle: no envenenamos el caché con un miss
  }
  if (!geo) {
    // fallback offline: solo aceptamos match de ciudad (no centroide de estado)
    const gz = gazetteer(state, place)
    if (gz && gz.precision === 'city') geo = { ...gz }
  }

  // Solo cacheamos cuando la respuesta es definitiva (Mapbox respondió, o el
  // gazetteer resolvió). Un 429/timeout sin match offline NO se cachea: reintenta.
  if (geo || !transient) {
    await db
      .insert(geocache)
      .values({
        query: k,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        precision: geo?.precision ?? null,
      })
      .onConflictDoNothing()
  }
  return geo
}
