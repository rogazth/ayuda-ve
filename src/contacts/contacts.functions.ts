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

// Moderación de contactos (aprobar/ocultar pendientes) = fuera de banda por SQL/
// wrangler hasta que exista admin con auth. Sin endpoint público sin protección.
