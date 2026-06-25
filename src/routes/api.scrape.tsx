import { createFileRoute } from '@tanstack/react-router'
import { runScrape } from '../scraper/run'

// Disparador manual del scraper. El driver real es el Cron Trigger
// (scheduled() en server.ts); esto es para probar/forzar una corrida. Gated a
// dev: en el build de producción import.meta.env.DEV es false → 404.
export const Route = createFileRoute('/api/scrape')({
  server: {
    handlers: {
      POST: async () => {
        if (!import.meta.env.DEV) return new Response('Not found', { status: 404 })
        const summary = await runScrape()
        return new Response(JSON.stringify(summary, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
  component: () => null,
})
