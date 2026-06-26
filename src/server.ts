import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { runDamageScrape } from './scraper/damage'
import { runScrape } from './scraper/run'
import { computeQuakes } from './quakes/quakes.functions'
import { getDb } from './db'
import { quakeSnapshot } from './db/schema'

// Server entry custom: TanStack Start lo auto-detecta (src/server.ts) y lo usa
// en vez de su default. Reusamos su handler de fetch tal cual y le colgamos el
// cron — el equivalente a `php artisan schedule:run`. Triggers en wrangler.jsonc.
const fetch = createStartHandler(defaultStreamHandler)

// Snapshot de sismos: computa desde USGS/FUNVISIS y persiste el JSON (fila id=1)
// para que el load lo lea local. Vive aquí (server-only), no en quakes.functions,
// para no arrastrar getDb/cloudflare al bundle cliente que importa fetchQuakes.
async function refreshQuakeSnapshot() {
  const data = JSON.stringify(await computeQuakes())
  await getDb()
    .insert(quakeSnapshot)
    .values({ id: 1, data })
    .onConflictDoUpdate({
      target: quakeSnapshot.id,
      set: { data, updatedAt: new Date() },
    })
}

export default {
  fetch,
  async scheduled(
    _controller: ScheduledController,
    _env: unknown,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(runScrape())
    ctx.waitUntil(runDamageScrape())
    // snapshot de sismos: computa desde USGS/FUNVISIS una vez y lo guarda en D1
    // para que el load lo lea local (heatmap en el primer paint, sin fetch externo).
    ctx.waitUntil(refreshQuakeSnapshot())
  },
}
