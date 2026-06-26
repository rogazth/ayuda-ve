import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { quakeSnapshot } from '../db/schema'
import {
  VE_BOUNDS,
  inVenezuela,
  mergeQuakes,
  parseForecast,
  parseFunvisis,
} from './quakes'
import type { Forecast, FunvisisGeo, OafForecast, Quake } from './quakes'

// Sismos de DOS fuentes que se correlacionan: USGS (catálogo global, GeoJSON,
// sin key) trae los eventos grandes con página oficial, ShakeMap y pronóstico;
// FUNVISIS (red local) trae las réplicas chicas (M2–4) que USGS no registra en
// Venezuela. mergeQuakes() las une y deduplica. Datos verídicos: graficamos lo
// registrado, no predecimos. Bbox = VE_BOUNDS. ponytail: ampliar si cubrimos el Caribe.
const DAYS = 7
const MIN_MAG = 2.5
const FUNVISIS_FEED = 'http://www.funvisis.gob.ve/maravilla.json'

// fetch con caché de borde 60s: un pico de tráfico pega a Cloudflare, no a la fuente.
const cached = (url: string) =>
  fetch(url, { cf: { cacheTtl: 60, cacheEverything: true } })

export type { Quake } from './quakes'

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

// Cómputo en vivo desde las fuentes externas (USGS + FUNVISIS). Caro: varios
// fetch secuenciales + parseo. Por eso NO se llama en cada load; lo corre el cron
// (server.ts) y guarda el resultado. El load lee el snapshot local.
export async function computeQuakes(): Promise<QuakeData> {
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
      properties: {
        mag: number
        place: string | null
        time: number
        url: string
      }
      geometry: { coordinates: [number, number, number] }
    }>
  }
  const usgs: Quake[] = (fc.features ?? []).map((f) => ({
    id: f.id,
    mag: f.properties.mag,
    place: f.properties.place ?? '',
    time: f.properties.time,
    depth: f.geometry.coordinates[2],
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    url: f.properties.url,
    source: 'usgs',
  }))

  // FUNVISIS (red local): aporta las réplicas chicas. Si está caído seguimos
  // solo con USGS — nunca dejamos que tumbe el feed. Filtramos al bbox y a la
  // ventana de DAYS para que su lista rodante encaje con la de USGS.
  const sinceMs = Date.now() - DAYS * 86_400_000
  let funvisis: Quake[] = []
  try {
    const geo = (await cached(FUNVISIS_FEED).then((r) =>
      r.json(),
    )) as FunvisisGeo
    funvisis = parseFunvisis(geo).filter(
      (q) => q.time >= sinceMs && inVenezuela(q.lat, q.lng),
    )
  } catch {
    // FUNVISIS intermitente: degradamos a USGS, no rompemos
  }
  const merged = mergeQuakes(usgs, funvisis)

  // sismo principal = mayor magnitud de la ventana
  const main = merged.reduce<Quake | null>(
    (a, q) => (!a || q.mag > a.mag ? q : a),
    null,
  )

  // Solo el episodio del terremoto: nada anterior al día (UTC) del sismo
  // principal. Quita la sismicidad de fondo previa que ensucia el mapa y
  // confunde ("¿esto es del terremoto o normal?"). El principal queda dentro.
  const since = main ? Math.floor(main.time / 86_400_000) * 86_400_000 : 0
  const quakes = merged.filter((q) => q.time >= since)

  let shakemap: MmiContours | null = null
  let forecast: Forecast | null = null
  // ShakeMap y pronóstico son productos de USGS: solo si el principal es de USGS.
  if (main && main.source === 'usgs') {
    try {
      const detail = (await cached(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${main.id}&format=geojson`,
      ).then((r) => r.json())) as { properties: { products: ProductMap } }
      const prods = detail.properties.products
      const smUrl =
        prods?.shakemap?.[0]?.contents?.['download/cont_mmi.json']?.url
      const fcUrl = prods?.oaf?.[0]?.contents?.['forecast.json']?.url
      const [sm, oaf] = await Promise.all([
        smUrl
          ? cached(smUrl)
              .then((r) => r.json())
              .catch(() => null)
          : null,
        fcUrl
          ? cached(fcUrl)
              .then((r) => r.json())
              .catch(() => null)
          : null,
      ])
      shakemap = sm as MmiContours | null
      if (oaf) forecast = parseForecast(oaf as OafForecast)
    } catch {
      // sin detalle igual mostramos los sismos registrados
    }
  }

  return {
    updated: Date.now(),
    quakes,
    mainId: main?.id ?? null,
    shakemap,
    forecast,
  }
}

// Load: lee el snapshot que el cron refresca cada 2 min (lectura D1 local ~ms,
// sin tocar USGS/FUNVISIS). Fallback a cómputo en vivo si aún no hay snapshot
// (ventana fría tras un deploy, hasta que corra el primer cron). getDb se usa
// solo dentro del handler → el bundler lo elimina del cliente.
export const fetchQuakes = createServerFn({ method: 'GET' }).handler(
  async (): Promise<QuakeData> => {
    try {
      const row = (
        await getDb()
          .select({ data: quakeSnapshot.data })
          .from(quakeSnapshot)
          .where(eq(quakeSnapshot.id, 1))
          .limit(1)
      ).at(0)
      if (row?.data) return JSON.parse(row.data) as QuakeData
    } catch {
      /* sin tabla/snapshot todavía: caemos a cómputo en vivo */
    }
    return computeQuakes()
  },
)

type ProductMap = Record<
  string,
  Array<{ contents?: Record<string, { url: string }> }>
>
