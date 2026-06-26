import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { announcements } from '../db/schema'
import { cleanAnnouncement } from './announcements'
import type { SuggestAnnouncementInput } from './announcements'

// Avisos visibles, recientes primero. Sin paginar ni filtrar por categoría: el
// volumen es bajo, se cargan todos y la pantalla filtra por categoría en cliente.
// Read-only: sugerencias de comunidad y moderación entran en otra fase (hoy se
// publican avisos oficiales fuera de banda por SQL).
export const fetchAnnouncements = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb()
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.status, 'visible'))
    .orderBy(desc(announcements.createdAt))
})

// Sugerencia de la comunidad → entra 'pending', no se muestra hasta aprobarse
// fuera de banda (SQL). Espejo de suggestContact. Sin rate-limit: la cola es de
// moderación y nada se publica solo. ponytail: añadir throttle por ipHash si la
// cola pending se llena de spam.
export const suggestAnnouncement = createServerFn({ method: 'POST' })
  .validator((input: SuggestAnnouncementInput) => cleanAnnouncement(input))
  .handler(async ({ data }) => {
    const db = getDb()
    await db.insert(announcements).values({ ...data, source: 'comunidad', status: 'pending' })
  })
