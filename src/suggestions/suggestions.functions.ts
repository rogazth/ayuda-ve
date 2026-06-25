import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../db'
import { suggestions } from '../db/schema'
import { cleanSuggestion } from './suggestions'

export const createSuggestion = createServerFn({ method: 'POST' })
  .validator((d: { text: string; contact?: string }) =>
    cleanSuggestion(d.text, d.contact),
  )
  .handler(async ({ data }) => {
    if (!data.text) throw new Error('La sugerencia está vacía')
    const db = getDb()
    await db.insert(suggestions).values({
      text: data.text,
      contact: data.contact,
    })
  })
