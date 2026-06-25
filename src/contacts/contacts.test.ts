import { expect, test } from 'vitest'
import { cleanSuggestion } from './contacts'

test('cleanSuggestion normaliza y rechaza basura', () => {
  const ok = cleanSuggestion({
    zone: ' Mérida ',
    category: 'bomberos',
    name: ' Bomberos ',
    phone: ' 0274-123 ',
  })
  expect(ok).toMatchObject({ zone: 'Mérida', name: 'Bomberos', phone: '0274-123' })
  expect(ok.sourceUrl).toBeNull()

  expect(() => cleanSuggestion({ ...ok, category: 'hacker' })).toThrow()
  expect(() => cleanSuggestion({ ...ok, phone: '   ' })).toThrow()
  expect(() => cleanSuggestion({ ...ok, zone: '' })).toThrow()
})
