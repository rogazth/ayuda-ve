import { expect, test } from 'vitest'
import { cleanSuggestion, nearestZone } from './contacts'

const ROWS = [
  { zone: 'Barquisimeto', lat: 10.0647, lng: -69.3247 },
  { zone: 'Caracas', lat: 10.4806, lng: -66.9036 },
]

test('nearestZone elige la ciudad más cercana dentro del radio', () => {
  expect(nearestZone(ROWS, 10.07, -69.33)).toBe('Barquisimeto') // en Barquisimeto
  expect(nearestZone(ROWS, 10.49, -66.85)).toBe('Caracas') // en Caracas
})

test('nearestZone devuelve null fuera del radio (fallback nacional)', () => {
  expect(nearestZone(ROWS, 8.6, -71.1)).toBeNull() // Mérida: lejos de ambas
  expect(nearestZone([], 10.07, -69.33)).toBeNull() // sin datos
})

test('cleanSuggestion normaliza y rechaza basura', () => {
  const ok = cleanSuggestion({
    zone: ' Mérida ',
    category: 'bomberos',
    name: ' Bomberos ',
    phone: ' 0274-123 ',
    lat: 8.6,
    lng: -71.1,
  })
  expect(ok).toMatchObject({ zone: 'Mérida', name: 'Bomberos', phone: '0274-123' })
  expect(ok.sourceUrl).toBeNull()

  expect(() => cleanSuggestion({ ...ok, category: 'hacker' })).toThrow()
  expect(() => cleanSuggestion({ ...ok, phone: '   ' })).toThrow()
  expect(() => cleanSuggestion({ ...ok, lat: 999 })).toThrow()
})
