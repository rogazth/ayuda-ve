import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { quakeSnapshot } from '../db/schema'
import { checkAuth } from '../ingest/ingest'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// Infografía de sismos: el admin renderiza el mapa+heatmap+markers (Playwright),
// sube el PNG a R2 y nos pasa la key acá. NO va por /internal/ingest (ese contrato
// es reports+media); los sismos viven en quake_snapshot (fila id=1). El cómputo
// del snapshot (datos) sigue en el cron del Worker; acá solo se agrega la imagen.
export const Route = createFileRoute('/internal/quake-image')({
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
        const imageKey = String(
          (body as { imageKey?: unknown })?.imageKey ?? '',
        ).trim()
        if (!imageKey || imageKey.length > 256)
          return json({ error: 'imageKey required' }, 400)

        await getDb()
          .update(quakeSnapshot)
          .set({ imageKey, imageUpdatedAt: new Date() })
          .where(eq(quakeSnapshot.id, 1))

        return json({ ok: true, imageKey })
      },
    },
  },
  component: () => null,
})
