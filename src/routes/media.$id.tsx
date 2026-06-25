import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { media } from '../db/schema'

export const Route = createFileRoute('/media/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const db = getDb()
        const [m] = await db
          .select()
          .from(media)
          .where(eq(media.id, params.id))
          .limit(1)
        if (!m) return new Response('Not found', { status: 404 })
        const obj = await env.MEDIA.get(m.key)
        if (!obj) return new Response('Not found', { status: 404 })
        return new Response(obj.body, {
          headers: {
            'Content-Type': m.contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
  component: () => null,
})
