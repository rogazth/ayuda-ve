import { expect, test } from 'vitest'
import { buildSources, esPlace, magColor, parseForecast } from './quakes'

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
