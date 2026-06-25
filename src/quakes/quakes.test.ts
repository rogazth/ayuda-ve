import { expect, test } from 'vitest'
import {
  buildSources,
  esPlace,
  funvisisTime,
  magColor,
  mergeQuakes,
  parseForecast,
  parseFunvisis,
  quakeOpacity,
} from './quakes'
import type { Quake } from './quakes'

test('esPlace traduce el lugar de USGS al español', () => {
  expect(esPlace('16 km NNW of Morón, Venezuela')).toBe(
    'a 16 km al NNO de Morón, Venezuela',
  )
  expect(esPlace('Venezuela region')).toBe('región de Venezuela')
  expect(esPlace('Caracas')).toBe('Caracas') // sin patrón: tal cual
})

test('magColor sube de severidad con la magnitud', () => {
  expect(magColor(2.9)).toBe('#9ccc65') // verde: leve
  expect(magColor(4.2)).toBe('#fb8c00') // naranja
  expect(magColor(7.5)).toBe('#d7263d') // rojo: fuerte
})

test('parseForecast extrae la probabilidad M5+ por ventana', () => {
  // forma real del forecast.json de USGS (producto oaf)
  const oaf = {
    creationTime: 1782356359389,
    forecast: [
      { label: '1 Day', bins: [{ magnitude: 5, probability: 0.8942 }] },
      {
        label: '1 Week',
        bins: [
          { magnitude: 4, probability: 0.99 },
          { magnitude: 5, probability: 0.9815 },
        ],
      },
      { label: '1 Month', bins: [{ magnitude: 6, probability: 0.5 }] }, // sin M5
    ],
  }
  const fc = parseForecast(oaf)
  expect(fc.windows).toEqual([
    { label: '1 Day', m5: 0.8942 },
    { label: '1 Week', m5: 0.9815 },
    { label: '1 Month', m5: 0 }, // sin bin M5 → 0, no rompe ni inventa
  ])
})

test('buildSources arma refs APA con links comprobables', () => {
  const main = {
    mag: 7.5,
    place: '28 km SE of Yumare, Venezuela',
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000t7zp',
    time: 1782338711566, // 2026-06-24
  }
  const refs = buildSources(main)
  // evento + shakemap + oaf de USGS, más FUNVISIS y OSM
  expect(refs.map((r) => r.key)).toEqual([
    'usgs-event',
    'usgs-shakemap',
    'usgs-oaf',
    'funvisis',
    'osm',
  ])
  expect(refs[0].cite).toContain('(2026)')
  expect(refs[0].cite).toContain('M 7.5')
  expect(refs[1].url).toBe(`${main.url}/shakemap`)
  expect(refs[2].url).toBe(`${main.url}/oaf/forecast`)
  // sin sismo principal: solo fuentes base (no inventa citas de USGS)
  expect(buildSources(null).map((r) => r.key)).toEqual(['funvisis', 'osm'])
})

test('quakeOpacity: grande o reciente nítido; chico y viejo al fondo', () => {
  const H = 3_600_000
  expect(quakeOpacity(3, 0)).toBe(1) // reciente → nítido
  expect(quakeOpacity(7, 300 * H)).toBe(1) // grande → nítido aunque viejo
  expect(quakeOpacity(3, 300 * H)).toBe(0.3) // chico y viejo → piso
  const mid = quakeOpacity(3, 48 * H) // chico, 48h → intermedio
  expect(mid).toBeGreaterThan(0.3)
  expect(mid).toBeLessThan(1)
})

test('funvisisTime: hora local de Venezuela (VET, UTC-4) → epoch UTC', () => {
  // 25-06-2026 16:16 VET == 20:16 UTC
  expect(funvisisTime('25-06-2026', '16:16')).toBe(Date.UTC(2026, 5, 25, 20, 16))
  expect(Number.isNaN(funvisisTime('basura', '16:16'))).toBe(true)
  expect(Number.isNaN(funvisisTime('25-06-2026', ''))).toBe(true)
})

test('parseFunvisis mapea el template ajeno y salta lo corrupto', () => {
  // forma real de maravilla.json: campos de un store locator reutilizado
  const geo = {
    features: [
      {
        geometry: { type: 'Point', coordinates: [-66.81, 10.61] },
        properties: {
          phoneFormatted: '2.4 km',
          phone: '3.0', // magnitud
          address: '7 km al oeste de Naiguata',
          city: '16:16', // hora local VET
          country: 'Venezuela',
          postalCode: '25-06-2026', // fecha DD-MM-YYYY
          state: '13.5 km', // profundidad
          lat: '10.61',
          long: '-66.81',
        },
      },
      // corrupto (sin magnitud): se salta, no inventa
      { geometry: { coordinates: [-67, 10] }, properties: { phone: 'x' } },
    ],
  }
  const qs = parseFunvisis(geo)
  expect(qs).toHaveLength(1)
  expect(qs[0]).toMatchObject({
    mag: 3.0,
    depth: 13.5,
    place: '7 km al oeste de Naiguata',
    lat: 10.61,
    lng: -66.81,
    source: 'funvisis',
    time: Date.UTC(2026, 5, 25, 20, 16),
  })
  expect(qs[0].url).toContain('funvisis')
})

test('mergeQuakes deduplica solapados (gana USGS) y suma los de FUNVISIS', () => {
  const t = Date.UTC(2026, 5, 25, 20, 16)
  const usgs: Quake[] = [
    { id: 'us1', mag: 7.5, place: 'Yumare', time: t, depth: 10, lat: 10.43, lng: -68.47, url: 'u', source: 'usgs' },
  ]
  const funvisis: Quake[] = [
    // mismo evento que us1 (≤90s y ≤0.5°): debe descartarse, gana USGS
    { id: 'fv-dup', mag: 7.4, place: 'Yumare', time: t + 30_000, depth: 12, lat: 10.45, lng: -68.5, url: 'f', source: 'funvisis' },
    // réplica chica propia de FUNVISIS (USGS no la tiene): se conserva
    { id: 'fv-new', mag: 3.0, place: 'Naiguata', time: t + 3_600_000, depth: 5, lat: 10.61, lng: -66.81, url: 'f', source: 'funvisis' },
  ]
  const merged = mergeQuakes(usgs, funvisis)
  expect(merged.map((q) => q.id)).toEqual(['fv-new', 'us1']) // más nuevo primero
  expect(merged.some((q) => q.id === 'fv-dup')).toBe(false)
})
