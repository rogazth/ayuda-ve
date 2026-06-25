import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

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
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    type: text('type').notNull(), // trapped | missing | danger | need | offer | support
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    confirms: integer('confirms').notNull().default(0),
    flags: integer('flags').notNull().default(0),
    status: text('status').notNull().default('visible'), // visible | hidden
    contact: text('contact'),
    meta: text('meta'), // JSON blob con campos específicos por tipo
    creatorIp: text('creator_ip'), // para bloquear self-confirm
    ...timestamps(),
  },
  (t) => [index('reports_lat_lng').on(t.lat, t.lng)], // bbox del viewport
)

export const comments = sqliteTable('comments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  reportId: text('report_id')
    .notNull()
    .references(() => reports.id),
  text: text('text').notNull(),
  ...timestamps(),
})

// Contactos por zona. `source='oficial'` = verificado con sourceUrl;
// `source='comunidad'` = sugerido por usuario, entra pending hasta aprobarse.
// La zona es el nombre del estado venezolano (ej. "Lara", "Distrito Capital").
export const contacts = sqliteTable('contacts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  zone: text('zone').notNull(), // estado venezolano, ej. "Lara"
  category: text('category').notNull(), // bomberos | policia | hospital | proteccion_civil | otro
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  source: text('source').notNull(), // oficial | comunidad
  sourceUrl: text('source_url'), // link de referencia (obligatorio en 'oficial')
  status: text('status').notNull().default('pending'), // pending | visible | hidden
  ...timestamps(),
})

// Buzón de sugerencias del proyecto: texto libre + contacto opcional para dar
// seguimiento. No se muestran en el mapa; se revisan aparte (open source).
export const suggestions = sqliteTable('suggestions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  text: text('text').notNull(),
  contact: text('contact'), // email/teléfono opcional para responder
  ...timestamps(),
})

export const reportConfirms = sqliteTable(
  'report_confirms',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reportId: text('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    ip: text('ip').notNull(),
    ua: text('ua').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index('report_confirms_report_ip').on(t.reportId, t.ip)],
)

export const media = sqliteTable('media', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  reportId: text('report_id')
    .notNull()
    .references(() => reports.id, { onDelete: 'cascade' }),
  key: text('key').notNull(), // R2 key: reports/<reportId>/<mediaId>.jpg
  contentType: text('content_type').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  position: integer('position').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export type Report = typeof reports.$inferSelect
export type Comment = typeof comments.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type Suggestion = typeof suggestions.$inferSelect
export type ReportConfirm = typeof reportConfirms.$inferSelect
export type Media = typeof media.$inferSelect
