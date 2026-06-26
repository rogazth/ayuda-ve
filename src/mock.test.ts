import { expect, test } from 'vitest'
import { mockList } from './mock'

test('mockList resuelve las variantes de estado', () => {
  const data = [1, 2, 3]
  expect(mockList(data, 'full')).toEqual({ items: [1, 2, 3], loading: false })
  expect(mockList(data, 'empty')).toEqual({ items: [], loading: false })
  expect(mockList(data, 'loading')).toEqual({ items: [], loading: true })
})
