import { createFileRoute } from '@tanstack/react-router'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { getDb } from '../db'
import { reports } from '../db/schema'

const SITE = 'https://ayudave.com'
// Páginas estáticas indexables (home + landings SEO).
const STATIC = ['/', '/personas-desaparecidas', '/numeros-emergencia-venezuela']
// missing/lostpet son registro de pie (no caducan); además indexamos verificados.
const STANDING = ['missing', 'lostpet']

// Sitemap dinámico: páginas fijas + deep-links de reportes indexables (/?r=<id>).
// ponytail: tope de 1000 reportes — si crece, paginar en sitemap-<n>.xml.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        let reportRows: { id: string; createdAt: Date }[] = []
        try {
          const db = getDb()
          reportRows = await db
            .select({ id: reports.id, createdAt: reports.createdAt })
            .from(reports)
            .where(
              and(
                inArray(reports.status, ['visible', 'found']),
                or(inArray(reports.type, STANDING), eq(reports.verified, true)),
              ),
            )
            .orderBy(desc(reports.createdAt))
            .limit(1000)
        } catch {
          /* sin DB (SSR frío/dev): el sitemap sale solo con las páginas fijas */
        }

        const urls = [
          ...STATIC.map((p) => `  <url><loc>${SITE}${p}</loc></url>`),
          ...reportRows.map(
            (r) =>
              `  <url><loc>${SITE}/?r=${r.id}</loc><lastmod>${r.createdAt.toISOString()}</lastmod></url>`,
          ),
        ].join('\n')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
        return new Response(xml, {
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
  component: () => null,
})
