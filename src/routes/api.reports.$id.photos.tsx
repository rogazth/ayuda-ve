import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { media, reports } from '../db/schema'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/webp'])
const MAX_BYTES = 1.5 * 1024 * 1024

export const Route = createFileRoute('/api/reports/$id/photos')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const db = getDb()
        const [report] = await db
          .select({ id: reports.id })
          .from(reports)
          .where(eq(reports.id, params.id))
          .limit(1)
        if (!report) return new Response('Not found', { status: 404 })

        const form = await request.formData()
        const files = form.getAll('photo') as File[]
        if (!files.length) return new Response('No photos', { status: 400 })
        if (files.length > 4) return new Response('Max 4 photos', { status: 400 })

        const ids: string[] = []
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          if (!ALLOWED_TYPES.has(file.type))
            return new Response('Only jpeg/webp allowed', { status: 400 })
          if (file.size > MAX_BYTES)
            return new Response('Photo too large (max 1.5MB)', { status: 400 })

          const width = Number(form.get(`width_${i}`) ?? 0)
          const height = Number(form.get(`height_${i}`) ?? 0)
          const id = crypto.randomUUID()
          const key = `reports/${params.id}/${id}.jpg`
          await env.MEDIA.put(key, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type },
          })
          await db.insert(media).values({
            id,
            reportId: params.id,
            key,
            contentType: file.type,
            width,
            height,
            position: i,
          })
          ids.push(id)
        }
        return new Response(JSON.stringify({ ids }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
  component: () => null,
})
