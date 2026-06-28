import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { media as mediaTable, reports } from '../db/schema'
import {
  checkAuth,
  insertValues,
  mediaToReplace,
  parseIngestBody,
  updateValues,
} from '../ingest/ingest'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// Ingest de scrapers desde el admin Laravel (cold path). El admin ya geocodificó
// y subió la media a R2; acá solo hacemos upsert por (externalSource, externalId)
// preservando estado de comunidad/moderación (ver ingest.ts). Auth: service key +
// allowlist de IP del VPS. Respuesta por-record para que el admin estampe
// ingested_at solo por los exitosos.
export const Route = createFileRoute('/internal/ingest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = checkAuth({
          key: env.INGEST_SERVICE_KEY,
          allowed: env.INGEST_ALLOWED_IPS,
          authHeader: request.headers.get('authorization'),
          ip: request.headers.get('cf-connecting-ip'),
        })
        if (!auth.ok) return new Response(auth.message, { status: auth.status })

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ error: 'invalid JSON' }, 400)
        }
        const parsed = parseIngestBody(body)
        if (!parsed.ok) return json({ error: parsed.error }, 400)

        const db = getDb()
        const inserted: string[] = []
        const updated: string[] = []
        const errors: Array<{ externalId: string; error: string }> = []

        for (const rec of parsed.value) {
          try {
            const [existing] = await db
              .select({ id: reports.id, status: reports.status })
              .from(reports)
              .where(
                and(
                  eq(reports.externalSource, rec.externalSource),
                  eq(reports.externalId, rec.externalId),
                ),
              )
              .limit(1)

            let reportId: string
            if (existing) {
              reportId = existing.id
              await db
                .update(reports)
                .set(updateValues(rec, existing.status))
                .where(eq(reports.id, existing.id))
              updated.push(rec.externalId)
            } else {
              reportId = crypto.randomUUID()
              await db
                .insert(reports)
                .values({ id: reportId, ...insertValues(rec) })
              inserted.push(rec.externalId)
            }

            // Media: vacío preserva (fallo transitorio de descarga); no vacío es
            // autoritativo → reemplaza el set. R2 lo administra el admin.
            const repl = mediaToReplace(rec.media)
            if (repl) {
              await db
                .delete(mediaTable)
                .where(eq(mediaTable.reportId, reportId))
              await db.insert(mediaTable).values(
                repl.map((m) => ({
                  reportId,
                  key: m.key,
                  contentType: m.contentType,
                  width: m.width,
                  height: m.height,
                  position: m.position,
                })),
              )
            }
          } catch (e) {
            errors.push({
              externalId: rec.externalId,
              error: e instanceof Error ? e.message : String(e),
            })
          }
        }

        return json({
          inserted,
          updated,
          errors,
          counts: {
            inserted: inserted.length,
            updated: updated.length,
            errors: errors.length,
          },
        })
      },
    },
  },
  component: () => null,
})
