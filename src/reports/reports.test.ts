import { expect, test } from 'vitest'
import {
  TYPES,
  canContact,
  fmtDist,
  formatVePhone,
  haversine,
  isValidVePhone,
  metaFields,
  newFreshPins,
  phoneIntl,
  safeUrl,
  typeOf,
} from './reports'
import { inVenezuela } from '../quakes/quakes'

test('safeUrl solo deja pasar http(s) sin credenciales', () => {
  expect(safeUrl('https://x.com/post/1')).toBe('https://x.com/post/1')
  expect(safeUrl('http://ok.com')).toBe('http://ok.com/')
  expect(safeUrl('javascript:alert(1)')).toBeNull()
  expect(safeUrl('data:text/html,<script>')).toBeNull()
  expect(safeUrl('https://user:pass@x.com')).toBeNull()
  expect(safeUrl('not a url')).toBeNull()
  expect(safeUrl(null)).toBeNull()
})

test('haversine ~111 km por grado de longitud en el ecuador', () => {
  expect(haversine(0, 0, 0, 1)).toBeGreaterThan(111000)
  expect(haversine(0, 0, 0, 1)).toBeLessThan(111400)
  expect(haversine(10, -66, 10, -66)).toBe(0)
})

test('fmtDist redondea metros y pasa a km', () => {
  expect(fmtDist(50)).toBe('a 50 m')
  expect(fmtDist(812)).toBe('a 810 m')
  expect(fmtDist(1500)).toBe('a 1.5 km')
})

test('typeOf cae en "otro" para tipos desconocidos', () => {
  expect(typeOf('trapped').color).toBe('#E03131')
  expect(typeOf('???')).toBe(TYPES.otro)
})

test('metaFields mapea por tipo: arrays → chips, strings → texto, ignora vacíos y photos', () => {
  const f = metaFields('need', {
    items: ['Agua', 'Comida'],
    count: '2–5',
    photos: ['data:...'],
    state: '',
  })
  expect(f).toEqual([
    { label: 'Necesita', chips: ['Agua', 'Comida'] },
    { label: 'Personas', text: '2–5' },
  ])
  expect(metaFields('???', { x: 1 })).toEqual([]) // tipo desconocido no crashea
})

test('phoneIntl normaliza a dígitos con prefijo 58', () => {
  expect(phoneIntl('4141234567')).toBe('584141234567')
  expect(phoneIntl('+58 414-123 4567')).toBe('584141234567')
  expect(phoneIntl('')).toBeNull()
  expect(phoneIntl(null)).toBeNull()
})

test('formatVePhone agrupa 3-3-4 y recorta a 10 dígitos', () => {
  expect(formatVePhone('4141234567')).toBe('414 123 4567')
  expect(formatVePhone('+58 (414) 123-4567 99')).toBe('414 123 4567')
  expect(formatVePhone('414')).toBe('414')
})

test('isValidVePhone: 10 dígitos empezando en 2 o 4', () => {
  expect(isValidVePhone('4141234567')).toBe(true)
  expect(isValidVePhone('2121234567')).toBe(true)
  expect(isValidVePhone('414123456')).toBe(false) // 9 dígitos
  expect(isValidVePhone('5141234567')).toBe(false) // empieza en 5
})

test('canContact: danger nunca, resto solo con teléfono', () => {
  expect(canContact('trapped', '4141234567')).toBe(true)
  expect(canContact('trapped', null)).toBe(false)
  expect(canContact('danger', '4141234567')).toBe(false)
})

test('newFreshPins: solo ids nuevos y recientes; siembra sin repetir', () => {
  const now = 1_000_000
  const FRESH = 120_000 // 2 min
  const seen = new Set<string>()
  const p = (id: string, age: number) => ({ id, createdAt: now - age })

  // Primera pasada: todos "nuevos" pero solo los frescos cuentan; siembra seen.
  const first = newFreshPins(
    [p('a', 10_000), p('b', 300_000)],
    seen,
    now,
    FRESH,
  )
  expect(first.map((x) => x.id)).toEqual(['a']) // b es viejo (5 min)
  expect(seen.has('a') && seen.has('b')).toBe(true) // ambos sembrados

  // Segunda pasada: 'a' ya visto (no suena), 'c' nuevo y fresco sí.
  const second = newFreshPins([p('a', 12_000), p('c', 5_000)], seen, now, FRESH)
  expect(second.map((x) => x.id)).toEqual(['c'])

  // Pan a zona con reporte viejo no visto → no suena.
  expect(newFreshPins([p('d', 999_999)], seen, now, FRESH)).toEqual([])
})

test('inVenezuela acepta el país y rechaza el exterior', () => {
  expect(inVenezuela(10.49, -66.85)).toBe(true) // Caracas
  expect(inVenezuela(25.76, -80.19)).toBe(false) // Miami
  expect(inVenezuela(40.41, -3.7)).toBe(false) // Madrid
  expect(inVenezuela(4.71, -74.07)).toBe(false) // Bogotá (justo al oeste)
})
