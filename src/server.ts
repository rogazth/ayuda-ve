import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { runDamageScrape } from './scraper/damage'
import { runScrape } from './scraper/run'

// Server entry custom: TanStack Start lo auto-detecta (src/server.ts) y lo usa
// en vez de su default. Reusamos su handler de fetch tal cual y le colgamos el
// cron — el equivalente a `php artisan schedule:run`. Triggers en wrangler.jsonc.
const fetch = createStartHandler(defaultStreamHandler)

export default {
  fetch,
  async scheduled(
    _controller: ScheduledController,
    _env: unknown,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(runScrape())
    ctx.waitUntil(runDamageScrape())
  },
}
