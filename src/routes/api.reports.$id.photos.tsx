import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { media, reports } from '../db/schema'

const MAX_BYTES = 1.5 * 1024 * 1024
const MAX_DIM = 12000 // px; descarta dimensiones absurdas (bombas de descompresión)
const MAX_PER_REPORT = 8 // total acumulado por reporte (varios POST)

// Valida por contenido, no por file.type del browser (mentible). Devuelve el
// contentType real o null si los magic bytes no son JPEG/WebP.
function sniffImage(buf: ArrayBuffer): 'image/jpeg' | 'image/webp' | null {
  const b = new Uint8Array(buf)
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return 'image/jpeg'
  if (
    b.length >= 12 &&
    b[0] === 0x52 && // R
    b[1] === 0x49 && // I
    b[2] === 0x46 && // F
    b[3] === 0x46 && // F
    b[8] === 0x57 && // W
    b[9] === 0x45 && // E
    b[10] === 0x42 && // B
    b[11] === 0x50 // P
  )
    return 'image/webp'
  return null
}

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

        // Tope total por reporte: varios POST no pueden pasarse de MAX_PER_REPORT.
        const existing = await db
          .select({ id: media.id })
          .from(media)
          .where(eq(media.reportId, params.id))
        if (existing.length + files.length > MAX_PER_REPORT)
          return new Response('Too many photos', { status: 400 })

        const ids: string[] = []
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          if (file.size > MAX_BYTES)
            return new Response('Photo too large (max 1.5MB)', { status: 400 })

          const buf = await file.arrayBuffer()
          const contentType = sniffImage(buf)
          if (!contentType)
            return new Response('Only jpeg/webp allowed', { status: 400 })

          const width = Number(form.get(`width_${i}`) ?? 0)
          const height = Number(form.get(`height_${i}`) ?? 0)
          if (!(width > 0) || !(height > 0) || width > MAX_DIM || height > MAX_DIM)
            return new Response('Bad image dimensions', { status: 400 })

          const ext = contentType === 'image/webp' ? 'webp' : 'jpg'
          const id = crypto.randomUUID()
          const key = `reports/${params.id}/${id}.${ext}`
          await env.MEDIA.put(key, buf, {
            httpMetadata: { contentType },
          })
          await db.insert(media).values({
            id,
            reportId: params.id,
            key,
            contentType,
            width,
            height,
            position: existing.length + i,
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
