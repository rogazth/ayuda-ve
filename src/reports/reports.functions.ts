import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '../db'
import { reports } from '../db/schema'

// ponytail: dato viejo en emergencia = peligroso. Filtramos a 48h (mvp.md).
// TODO(albergue): los albergues sembrados deberían exentarse de este filtro.
const FRESH_MS = 48 * 60 * 60 * 1000

export type Bounds = { s: number; n: number; w: number; e: number }

// Pins por viewport: payload mínimo, índice (lat,lng) hace el BETWEEN barato.
export const fetchReportsInBounds = createServerFn({ method: 'GET' })
  .validator(
    (b: Bounds): Bounds => ({
      s: Number(b.s),
      n: Number(b.n),
      w: Number(b.w),
      e: Number(b.e),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const cutoff = new Date(Date.now() - FRESH_MS)
    const rows = await db
      .select({
        id: reports.id,
        type: reports.type,
        title: reports.title,
        lat: reports.lat,
        lng: reports.lng,
        confirms: reports.confirms,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(
        and(
          eq(reports.status, 'visible'),
          gte(reports.lat, data.s),
          lte(reports.lat, data.n),
          gte(reports.lng, data.w),
          lte(reports.lng, data.e),
          gte(reports.createdAt, cutoff),
        ),
      )
      .orderBy(desc(reports.createdAt))
      .limit(200)

    return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }))
  })
