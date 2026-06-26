import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Suspense, lazy, useEffect, useState } from 'react'
import { fetchReport, fetchSeedReports } from '../reports/reports.functions'
import type { ReportDetail } from '../reports/reports.functions'
import type { Pin } from '../components/map/types'
import { typeOf } from '../reports/reports'

type Og = { title: string; description: string; image: string }

const fetchOg = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getRequestUrl } = await import('@tanstack/react-start/server')
    const report = await fetchReport({ data: { id } })
    if (!report) return null
    return ogFor(report, getRequestUrl().origin)
  })

// Meta OG por reporte. Solo se construye en SSR: los crawlers de redes
// (WhatsApp/FB/X) hacen un GET fresco a /?r=<id> y leen el <head>. En cliente el
// mapa ya trae el detalle, así que ahí no hace falta.
function ogFor(report: ReportDetail, origin: string): Og {
  const t = typeOf(report.type)
  const name =
    report.type === 'missing' && typeof report.meta.missingName === 'string'
      ? report.meta.missingName.trim()
      : ''
  const title = name ? `Buscamos a ${name} · AyudaVE` : `${t.label} · AyudaVE`
  const description =
    report.description.trim().slice(0, 200) || 'Reporte de la comunidad · AyudaVE'
  // ponytail: las fotos son base64 (inservibles como og:image). Hasta R2
  // [[photos-to-r2]] usamos el logo; cambiar a la URL de la foto cuando exista.
  const image = `${origin}/logo512.png`
  return { title, description, image }
}

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): { r?: string } => ({
    r: typeof s.r === 'string' ? s.r : undefined,
  }),
  loaderDeps: ({ search }) => ({ r: search.r }),
  loader: async ({ deps }): Promise<{ og: Og | null; seed: Pin[] }> => {
    // seed (D1 propio, cacheado) va en el HTML para que el mapa monte con pines
    // sin round-trip. Quakes NO va aquí: su flujo son varios fetch a USGS
    // (lista→detalle→shakemap) que tardan >1s y colgaban el SSR para terminar en
    // null igual; lo carga el cliente al montar (cacheado 60s en el borde).
    const [seed, og] = await Promise.all([
      fetchSeedReports().catch(() => [] as Pin[]),
      deps.r ? fetchOg({ data: deps.r }).catch(() => null) : Promise.resolve(null),
    ])
    return { og, seed }
  },
  head: ({ loaderData }) => {
    const og = loaderData?.og
    if (!og) return {}
    return {
      meta: [
        { title: og.title },
        { name: 'description', content: og.description },
        { property: 'og:title', content: og.title },
        { property: 'og:description', content: og.description },
        { property: 'og:image', content: og.image },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: og.title },
        { name: 'twitter:description', content: og.description },
        { name: 'twitter:image', content: og.image },
      ],
    }
  },
  component: App,
})

// Leaflet toca window: el mapa es cliente puro. lazy() evita importarlo en SSR.
const MapScreen = lazy(() => import('../components/map/map-screen'))

function App() {
  const { seed } = Route.useLoaderData()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return <Splash />
  return (
    <Suspense fallback={<Splash />}>
      <MapScreen initialPins={seed} />
    </Suspense>
  )
}

function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center text-sea-ink-soft">
      Cargando mapa…
    </div>
  )
}
