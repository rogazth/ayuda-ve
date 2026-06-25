import { createServerFn } from '@tanstack/react-start'
import { VE_BOUNDS, parseForecast } from './quakes'
import type { Forecast, OafForecast } from './quakes'

// Sismos desde USGS (fuente pública, sin API key, GeoJSON). Datos verídicos:
// graficamos lo registrado, no predecimos. Bbox de Venezuela = VE_BOUNDS
// (fuente única en lib/quakes). ponytail: ampliar si cubrimos el Caribe.
const DAYS = 7
const MIN_MAG = 2.5

// fetch con caché de borde 60s: un pico de tráfico pega a Cloudflare, no a USGS.
const cached = (url: string) =>
  fetch(url, { cf: { cacheTtl: 60, cacheEverything: true } })

export type Quake = {
  id: string
  mag: number
  place: string
  time: number
  depth: number
  lat: number
  lng: number
  url: string // página oficial del evento en USGS (fuente comprobable)
}

// Contornos MMI (GeoJSON): líneas iso-sísmicas = zona afectada por la sacudida.
export type MmiContours = {
  type: string
  features: Array<{
    type: string
    properties: { value: number; color: string; weight: number; units: string }
    geometry: { type: string; coordinates: number[][][] }
  }>
}

export type QuakeData = {
  updated: number
  quakes: Quake[]
  mainId: string | null
  shakemap: MmiContours | null
  forecast: Forecast | null
}

export const fetchQuakes = createServerFn({ method: 'GET' }).handler(
  async (): Promise<QuakeData> => {
    const start = new Date(Date.now() - DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const listUrl =
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
      `&starttime=${start}&minmagnitude=${MIN_MAG}` +
      `&minlatitude=${VE_BOUNDS.minLat}&maxlatitude=${VE_BOUNDS.maxLat}` +
      `&minlongitude=${VE_BOUNDS.minLng}&maxlongitude=${VE_BOUNDS.maxLng}&orderby=time`

    const fc = (await cached(listUrl).then((r) => r.json())) as {
      features?: Array<{
        id: string
        properties: { mag: number; place: string | null; time: number; url: string }
        geometry: { coordinates: [number, number, number] }
      }>
    }
    const quakes: Quake[] = (fc.features ?? []).map((f) => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place ?? '',
      time: f.properties.time,
      depth: f.geometry.coordinates[2],
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      url: f.properties.url,
    }))

    // sismo principal = mayor magnitud de la ventana
    const main = quakes.reduce<Quake | null>(
      (a, q) => (!a || q.mag > a.mag ? q : a),
      null,
    )

    let shakemap: MmiContours | null = null
    let forecast: Forecast | null = null
    if (main) {
      try {
        const detail = (await cached(
          `https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${main.id}&format=geojson`,
        ).then((r) => r.json())) as { properties: { products: ProductMap } }
        const prods = detail.properties.products
        const smUrl = prods?.shakemap?.[0]?.contents?.['download/cont_mmi.json']?.url
        const fcUrl = prods?.oaf?.[0]?.contents?.['forecast.json']?.url
        const [sm, oaf] = await Promise.all([
          smUrl ? cached(smUrl).then((r) => r.json()).catch(() => null) : null,
          fcUrl ? cached(fcUrl).then((r) => r.json()).catch(() => null) : null,
        ])
        shakemap = sm as MmiContours | null
        if (oaf) forecast = parseForecast(oaf as OafForecast)
      } catch {
        // sin detalle igual mostramos los sismos registrados
      }
    }

    return { updated: Date.now(), quakes, mainId: main?.id ?? null, shakemap, forecast }
  },
)

type ProductMap = Record<
  string,
  Array<{ contents?: Record<string, { url: string }> }>
>
