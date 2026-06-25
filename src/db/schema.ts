import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// created_at + updated_at compartidos. Función (no constante) para que cada tabla
// reciba builders frescos. updated_at se refresca solo en cada .update() (drizzle).
const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
})

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    type: text('type').notNull(), // heridos | derrumbe | servicios | albergue | otro
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    confirms: integer('confirms').notNull().default(0),
    flags: integer('flags').notNull().default(0),
    status: text('status').notNull().default('visible'), // visible | hidden
    ...timestamps(),
  },
  (t) => [index('reports_lat_lng').on(t.lat, t.lng)], // bbox del viewport
)

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportId: text('report_id')
    .notNull()
    .references(() => reports.id),
  text: text('text').notNull(),
  ...timestamps(),
})

// Contactos por zona. Dos categorías (mvp): `source='oficial'` = lo que damos
// nosotros, verificado, con `sourceUrl` de referencia; `source='comunidad'` =
// sugerido por usuarios, entra `pending` hasta aprobarse en /admin.
// La zona se resuelve por cercanía (haversine al contacto más próximo), no hay
// tabla de zonas. Sin match → la app cae a EMERGENCY nacional (en reports.ts).
export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  zone: text('zone').notNull(), // "Barquisimeto", "Caracas"
  category: text('category').notNull(), // bomberos | policia | hospital | proteccion_civil | otro
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  source: text('source').notNull(), // oficial | comunidad
  sourceUrl: text('source_url'), // link de referencia (obligatorio en 'oficial')
  status: text('status').notNull().default('pending'), // pending | visible | hidden
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  ...timestamps(),
})
// ponytail: sin índice (lat,lng). La tabla es chica (contactos de un país, se
// escanea entera en JS). Agregar índice + prefiltro bbox si crece a miles.

export type Report = typeof reports.$inferSelect
export type Comment = typeof comments.$inferSelect
export type Contact = typeof contacts.$inferSelect
