import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { quakeSnapshot } from '../db/schema'
import { checkAuth } from '../ingest/ingest'

// Lectura del snapshot de sismos para el admin (cold path): el admin no tiene conexión
// directa a D1 (solo sqlite de staging), así que lee la data por HTTP con la misma auth
// que el resto de /internal/*. La usa RenderQuakeInfographic para pintar la infografía con
// EXACTAMENTE los mismos sismos+ShakeMap que el Worker ya computó y muestra (fuente única;
// no se recomputa ni se inventa). Devuelve el QuakeData crudo (quakes, shakemap, mainId…).
export const Route = createFileRoute('/internal/quake-snapshot')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = checkAuth({
          key: env.INGEST_SERVICE_KEY,
          allowed: env.INGEST_ALLOWED_IPS,
          authHeader: request.headers.get('authorization'),
          ip: request.headers.get('cf-connecting-ip'),
        })
        if (!auth.ok) return new Response(auth.message, { status: auth.status })

        const row = (
          await getDb()
            .select({ data: quakeSnapshot.data })
            .from(quakeSnapshot)
            .where(eq(quakeSnapshot.id, 1))
            .limit(1)
        ).at(0)

        // Aún sin snapshot (ventana fría tras deploy): forma vacía → el admin se salta.
        const body = row?.data ?? '{"quakes":[],"shakemap":null,"mainId":null}'
        return new Response(body, {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
  component: () => null,
})
