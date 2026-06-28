import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { computeQuakes } from './quakes/quakes.functions'
import { getDb } from './db'
import { quakeSnapshot, reports } from './db/schema'

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

// Espejo de reportes a Telegram (@ayudave_reportes): todo reporte nuevo visible
// (usuario + scrapers), una sola vez. notified_at se estampa SOLO tras el 200 de
// Telegram → un fallo se reintenta solo en el próximo tick (retry gratis, sin cola).
const TELEGRAM_TYPE_LABEL: Record<string, string> = {
  trapped: '🆘 Persona atrapada',
  missing: '👤 Persona desaparecida',
  danger: '🏚️ Estructura dañada',
  need: '🙏 Necesito ayuda',
  offer: '❤️ Ofrezco ayuda',
  support: '🏠 Punto de apoyo',
}

// Escapamos para parse_mode HTML: el título/descripción son texto libre del usuario.
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function buildTelegramMessage(r: typeof reports.$inferSelect): string {
  const head = TELEGRAM_TYPE_LABEL[r.type] ?? '📍 Nuevo reporte'
  const body = r.description ? `\n${escapeHtml(r.description.slice(0, 500))}` : ''
  return [
    head,
    `<b>${escapeHtml(r.title)}</b>${body}`,
    `\n📍 <a href="https://www.google.com/maps?q=${r.lat},${r.lng}">Ubicación</a>`,
    `🔗 https://ayudave.com/?r=${r.id}`,
  ].join('\n')
}

async function flushTelegram() {
  const token = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_CHANNEL_ID
  if (!token || !chatId) return // sin config (preview/local) → no-op

  const db = getDb()
  const pending = await db
    .select()
    .from(reports)
    .where(
      and(
        isNull(reports.notifiedAt), // solo lo no enviado
        eq(reports.status, 'visible'), // solo publicado (excluye hidden/found)
      ),
    )
    .orderBy(asc(reports.createdAt))
    .limit(15) // ponytail: 15/tick = 180/h, sobre los ~76/h de carga y bajo el límite ~20/min del canal; subir si el scraper bursea más

  for (const r of pending) {
    // globalThis.fetch: el `const fetch` del módulo (línea ~12) es el handler del
    // Worker, no el cliente HTTP — lo sombrea acá adentro.
    const res = await globalThis.fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: buildTelegramMessage(r),
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        }),
      },
    )
    if (res.ok) {
      await db
        .update(reports)
        .set({ notifiedAt: new Date() })
        .where(eq(reports.id, r.id))
    }
    // Si falla, notified_at queda null → se reintenta en el próximo tick.
  }
}

export default {
  fetch,
  async scheduled(
    _controller: ScheduledController,
    _env: unknown,
    ctx: ExecutionContext,
  ) {
    // El scraping vive en el admin Laravel (cold path) → POST /internal/ingest.
    // Acá: snapshot de sismos (USGS/FUNVISIS → D1) + espejo de reportes a Telegram.
    ctx.waitUntil(refreshQuakeSnapshot())
    ctx.waitUntil(flushTelegram())
  },
}
