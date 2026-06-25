import { expect, test } from 'vitest'
import { TYPES, fmtDist, haversine, typeOf } from './reports'
import { inVenezuela } from '../quakes/quakes'

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
  expect(typeOf('heridos').color).toBe('#E03131')
  expect(typeOf('???')).toBe(TYPES.otro)
})

test('inVenezuela acepta el país y rechaza el exterior', () => {
  expect(inVenezuela(10.49, -66.85)).toBe(true) // Caracas
  expect(inVenezuela(25.76, -80.19)).toBe(false) // Miami
  expect(inVenezuela(40.41, -3.7)).toBe(false) // Madrid
  expect(inVenezuela(4.71, -74.07)).toBe(false) // Bogotá (justo al oeste)
})
