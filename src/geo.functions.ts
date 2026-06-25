import { createServerFn } from '@tanstack/react-start'

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
