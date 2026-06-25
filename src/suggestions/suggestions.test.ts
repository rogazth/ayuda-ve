import { expect, test } from 'vitest'
import { SUGGESTION_MAX, cleanSuggestion } from './suggestions'

test('cleanSuggestion recorta, limita y colapsa contacto vacío a null', () => {
  expect(cleanSuggestion('  hola  ', '  a@b.com ')).toEqual({
    text: 'hola',
    contact: 'a@b.com',
  })
  expect(cleanSuggestion('texto', '').contact).toBeNull()
  expect(cleanSuggestion('texto', null).contact).toBeNull()
  expect(cleanSuggestion('', '').text).toBe('') // vacío: el handler lo rechaza
  expect(cleanSuggestion('x'.repeat(5000)).text.length).toBe(SUGGESTION_MAX)
})
