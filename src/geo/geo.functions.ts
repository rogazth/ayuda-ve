import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

const SEARCHBOX = 'https://api.mapbox.com/search/searchbox/v1'

// Autocomplete del wizard, vía Search Box API (proxy server-side: el token sigue
// secret, no se expone al browser). suggest + retrieve comparten session_token →
// Mapbox lo factura como 1 sesión, contra el free tier de Search Box (aparte del
// de Geocoding del scraper). ponytail: dos fetch finitos, sin SDK.
export type Suggestion = { id: string; name: string; place: string }

// Texto → sugerencias (sin coords; las trae retrieve al elegir). proximity sesga
// al centro del mapa para mejor relevancia. Devuelve [] ante cualquier fallo.
export const geoSuggest = createServerFn({ method: 'GET' })
  .validator((c: { q: string; session: string; proximity?: string }) => ({
    q: String(c.q ?? ''),
    session: String(c.session ?? ''),
    proximity: c.proximity ? String(c.proximity) : undefined,
  }))
  .handler(async ({ data }): Promise<Array<Suggestion>> => {
    const q = data.q.trim()
    if (q.length < 3 || !data.session) return []
    const url = new URL(`${SEARCHBOX}/suggest`)
    url.searchParams.set('q', q)
    url.searchParams.set('session_token', data.session)
    url.searchParams.set('access_token', env.MAPBOX_TOKEN)
    url.searchParams.set('country', 've')
    url.searchParams.set('language', 'es')
    url.searchParams.set('limit', '6')
    url.searchParams.set('types', 'address,street,neighborhood,locality,place,poi')
    if (data.proximity) url.searchParams.set('proximity', data.proximity)
    try {
      const r = await fetch(url)
      if (!r.ok) return []
      const j = (await r.json()) as {
        suggestions?: Array<{
          mapbox_id: string
          name: string
          place_formatted?: string
          full_address?: string
        }>
      }
      // place_formatted = contexto sin el nombre (pareja natural de name en la UI);
      // full_address lo repetiría. ponytail: línea secundaria, no dirección canónica.
      return (j.suggestions ?? []).map((s) => ({
        id: s.mapbox_id,
        name: s.name,
        place: s.place_formatted ?? s.full_address ?? '',
      }))
    } catch {
      return []
    }
  })

// mapbox_id → [lat, lng]. Cierra la sesión (mismo session_token que el suggest).
// El response es GeoJSON; leemos geometry.coordinates [lng,lat] con fallbacks.
export const geoRetrieve = createServerFn({ method: 'GET' })
  .validator((c: { id: string; session: string }) => ({
    id: String(c.id ?? ''),
    session: String(c.session ?? ''),
  }))
  .handler(async ({ data }): Promise<[number, number] | null> => {
    if (!data.id) return null
    const url = new URL(`${SEARCHBOX}/retrieve/${encodeURIComponent(data.id)}`)
    url.searchParams.set('session_token', data.session)
    url.searchParams.set('access_token', env.MAPBOX_TOKEN)
    try {
      const r = await fetch(url)
      if (!r.ok) return null
      const j = (await r.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number] }
          properties?: { coordinates?: { longitude: number; latitude: number } }
          center?: { longitude: number; latitude: number }
        }>
      }
      const f = j.features?.[0]
      const g = f?.geometry?.coordinates
      if (g && g.length === 2) return [g[1], g[0]] // [lng,lat] → [lat,lng]
      const c = f?.properties?.coordinates ?? f?.center
      if (c && c.longitude != null && c.latitude != null)
        return [c.latitude, c.longitude]
      return null
    } catch {
      return null
    }
  })

// Estado (entidad federal) del usuario por coordenadas. Nominatim (OSM): gratis,
// sin key, misma cartografía que el mapa. Una llamada cacheada en el borde; si
// falla, el selector de Ayuda queda en su default. ponytail: reverse geocode
// simple, no necesitamos polígonos locales para un preselect.
export const reverseEstado = createServerFn({ method: 'GET' })
  .validator((c: { lat: number; lng: number }) => ({
    lat: Number(c.lat),
    lng: Number(c.lng),
  }))
  .handler(async ({ data }): Promise<string | null> => {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
        `&lat=${data.lat}&lon=${data.lng}&zoom=8&accept-language=es`
      const r = await fetch(url, {
        headers: { 'User-Agent': 'AyudaVE/0.1 (emergencia Venezuela)' },
        cf: { cacheTtl: 3600, cacheEverything: true },
      })
      const j: { address?: { state?: string } } = await r.json()
      return j.address?.state ?? null
    } catch {
      return null
    }
  })
