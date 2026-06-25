import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { contacts } from '../db/schema'
import { cleanSuggestion, type SuggestionInput } from './contacts'

// Contactos visibles de un estado.
export const fetchContactsByZone = createServerFn({ method: 'GET' })
  .validator((p: { zone: string }) => {
    if (!p.zone?.trim()) throw new Error('zone requerida')
    return { zone: p.zone.trim() }
  })
  .handler(async ({ data }) => {
    const db = getDb()
    return db
      .select()
      .from(contacts)
      .where(and(eq(contacts.zone, data.zone), eq(contacts.status, 'visible')))
  })

// Sugerencia de la comunidad → entra 'pending', no se muestra hasta aprobarse.
export const suggestContact = createServerFn({ method: 'POST' })
  .validator((input: SuggestionInput) => cleanSuggestion(input))
  .handler(async ({ data }) => {
    const db = getDb()
    await db.insert(contacts).values({ ...data, source: 'comunidad', status: 'pending' })
  })

// --- Admin (sin auth aún) ---

export const listPendingContacts = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb()
  return db.select().from(contacts).where(eq(contacts.status, 'pending'))
})

export const moderateContact = createServerFn({ method: 'POST' })
  .validator((p: { id: string; status: 'visible' | 'hidden' }) => {
    if (!p.id) throw new Error('id requerido')
    if (p.status !== 'visible' && p.status !== 'hidden')
      throw new Error('status inválido')
    return { id: p.id, status: p.status }
  })
  .handler(async ({ data }) => {
    const db = getDb()
    await db
      .update(contacts)
      .set({ status: data.status })
      .where(and(eq(contacts.id, data.id), eq(contacts.status, 'pending')))
  })
