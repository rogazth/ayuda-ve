import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

// ponytail: sirve media desde el binding R2 solo para dev local. En prod las URLs
// apuntan a media.ayudave.com (custom domain) y esta ruta nunca se usa.
export const Route = createFileRoute('/media/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const obj = await env.MEDIA.get(params._splat ?? '')
        if (!obj) return new Response('Not found', { status: 404 })
        const headers = new Headers()
        obj.writeHttpMetadata(headers)
        headers.set('etag', obj.httpEtag)
        return new Response(obj.body, { headers })
      },
    },
  },
  component: () => null,
})
