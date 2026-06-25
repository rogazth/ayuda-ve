import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { getDb } from './db'
import { contacts } from './db/schema'
import { cleanSuggestion, nearestZone, type SuggestionInput } from './lib/contacts'

// Contactos de la zona del usuario. El cliente manda su GPS; resolvemos la zona
// por cercanía (haversine) y devolvemos sus contactos visibles. Sin cobertura
// (zone=null) → el cliente muestra los EMERGENCY nacionales (reports.ts).
export const fetchLocalContacts = createServerFn({ method: 'GET' })
  .validator((p: { lat: number; lng: number }) => ({
    lat: Number(p.lat),
    lng: Number(p.lng),
  }))
  .handler(async ({ data }) => {
    const db = getDb()
    // Tabla chica: una query, el resto en JS (ver nota en schema.ts).
    const rows = await db.select().from(contacts).where(eq(contacts.status, 'visible'))
    const zone = nearestZone(rows, data.lat, data.lng)
    if (!zone) return { zone: null, contacts: [] }
    return { zone, contacts: rows.filter((r) => r.zone === zone) }
  })

// Sugerencia de la comunidad → entra 'pending', no se muestra hasta aprobarse.
export const suggestContact = createServerFn({ method: 'POST' })
  .validator((input: SuggestionInput) => cleanSuggestion(input))
  .handler(async ({ data }) => {
    const db = getDb()
    const [row] = await db
      .insert(contacts)
      .values({ ...data, source: 'comunidad', status: 'pending' })
      .returning({ id: contacts.id })
    return { id: row.id }
  })

// --- Admin (sin auth aún; el mvp lo difiere a basic auth) ---

export const listPendingContacts = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb()
  return db.select().from(contacts).where(eq(contacts.status, 'pending'))
})

// Aprobar (visible) o rechazar (hidden) una sugerencia.
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
    return { ok: true }
  })
