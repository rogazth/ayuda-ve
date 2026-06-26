import { getDb } from '../db'
import { moderationEvents } from '../db/schema'
import { clientIpHash, clientUaHash } from '../server/req'

export type ModEntity =
  | 'report'
  | 'comment'
  | 'contact'
  | 'announcement'
  | 'aid_center'
export type ModAction = 'flag' | 'hide' | 'approve' | 'reject'

// Registra un evento de moderación. Una sola fuente de verdad para auditar
// flags/hides/approvals — reemplaza el hack de comentarios '[reporte] …'.
// Se llama desde dentro de otras server fns (no es server fn pública).
export async function logModeration(e: {
  entityType: ModEntity
  entityId: string
  action: ModAction
  reason?: string
}) {
  const db = getDb()
  await db.insert(moderationEvents).values({
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    reason: e.reason?.trim() || null,
    ipHash: (await clientIpHash()) || null,
    uaHash: (await clientUaHash()) || null,
  })
}
