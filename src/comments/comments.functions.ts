import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gt, notLike, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { comments, reports } from '../db/schema'
import { logModeration } from '../moderation/moderation'
import { clientIpHash } from '../server/req'

export type CommentRow = {
  id: string
  text: string
  authorName: string | null
  createdAt: number // ms, como el resto de la app (fmtAge)
}

// Comentarios visibles de un reporte, más nuevo primero. El notLike blinda contra
// filas viejas '[reporte] …' por si una réplica corre antes de la migración 0012.
export const fetchComments = createServerFn({ method: 'GET' })
  .validator((d: { reportId: string }) => ({ reportId: String(d.reportId) }))
  .handler(async ({ data }): Promise<CommentRow[]> => {
    const db = getDb()
    const rows = await db
      .select({
        id: comments.id,
        text: comments.text,
        authorName: comments.authorName,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(
        and(
          eq(comments.reportId, data.reportId),
          eq(comments.status, 'visible'),
          notLike(comments.text, '[reporte]%'),
        ),
      )
      .orderBy(desc(comments.createdAt))
      .limit(100)
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }))
  })

// Auto-publica (status='visible'). Throttle barato: 1 comentario por IP cada 20s.
// ponytail: throttle por reciente, no rate-limit por ventana — subir si hay spam.
const THROTTLE_MS = 20_000
export const addComment = createServerFn({ method: 'POST' })
  .validator((d: { reportId: string; text?: string; authorName?: string }) => ({
    reportId: String(d.reportId),
    text: String(d.text ?? '').slice(0, 1000),
    authorName: d.authorName ? String(d.authorName).slice(0, 40) : undefined,
  }))
  .handler(async ({ data }) => {
    const text = data.text.trim()
    const authorName = data.authorName?.trim() || null
    if (!text) return { ok: false as const, reason: 'invalid' as const }

    const db = getDb()
    // No comentar reportes inexistentes u ocultos.
    const rep = await db
      .select({ status: reports.status })
      .from(reports)
      .where(eq(reports.id, data.reportId))
      .limit(1)
    if (!rep.length || rep[0].status === 'hidden')
      return { ok: false as const, reason: 'missing' as const }

    const ipHash = await clientIpHash()
    if (ipHash) {
      const since = new Date(Date.now() - THROTTLE_MS)
      const recent = await db
        .select({ id: comments.id })
        .from(comments)
        .where(and(eq(comments.ipHash, ipHash), gt(comments.createdAt, since)))
        .limit(1)
      if (recent.length) return { ok: false as const, reason: 'rate' as const }
    }

    const [row] = await db
      .insert(comments)
      .values({ reportId: data.reportId, text, authorName, ipHash: ipHash || null })
      .returning({
        id: comments.id,
        text: comments.text,
        authorName: comments.authorName,
        createdAt: comments.createdAt,
      })
    return {
      ok: true as const,
      comment: { ...row, createdAt: row.createdAt.getTime() },
    }
  })

// Flag comunitario: oculta a los 2 reportes (mismo patrón que flagReport). Audita
// en moderation_events. Anti-doble-voto en el cliente (localStorage).
const FLAG_HIDE = 2
export const flagComment = createServerFn({ method: 'POST' })
  .validator((d: { id: string; reason?: string }) => ({
    id: String(d.id),
    reason: d.reason ? String(d.reason).slice(0, 500) : undefined,
  }))
  .handler(async ({ data }) => {
    const db = getDb()
    await db
      .update(comments)
      .set({
        flags: sql`${comments.flags} + 1`,
        status: sql`case when ${comments.flags} + 1 >= ${FLAG_HIDE} then 'hidden' else ${comments.status} end`,
      })
      .where(eq(comments.id, data.id))
    await logModeration({
      entityType: 'comment',
      entityId: data.id,
      action: 'flag',
      reason: data.reason,
    })
    return { ok: true as const }
  })
