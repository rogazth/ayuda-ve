import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Suspense, lazy, useEffect, useState } from 'react'
import { fetchReport, fetchSeedReports } from '../reports/reports.functions'
import type { ReportDetail } from '../reports/reports.functions'
import { fetchQuakes } from '../quakes/quakes.functions'
import type { QuakeData } from '../quakes/quakes.functions'
import type { Pin } from '../components/map/types'
import { MapChrome } from '../components/map/map-chrome'
import { typeOf } from '../reports/reports'

type Og = { title: string; description: string; image: string; url: string }

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
  const title = name ? `Buscamos a ${name} · Ayuda Venezuela` : `${t.label} · Ayuda Venezuela`
  const description =
    report.description.trim().slice(0, 200) ||
    'Reporte de la comunidad · Ayuda Venezuela'
  // Foto real del reporte (R2, [[photos-to-r2]]) como og:image; logo si no hay.
  // En prod media.url ya es absoluta; en dev es /media/... → la absolutizamos.
  const photo = report.media[0]?.url
  const image = photo
    ? photo.startsWith('http')
      ? photo
      : `${origin}${photo}`
    : `${origin}/logo512.png`
  return { title, description, image, url: `${origin}/?r=${report.id}` }
}

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): { r?: string } => ({
    r: typeof s.r === 'string' ? s.r : undefined,
  }),
  loaderDeps: ({ search }) => ({ r: search.r }),
  loader: async ({
    deps,
  }): Promise<{ og: Og | null; seed: Pin[]; quakes: QuakeData | null }> => {
    // seed + quakes van en el HTML → el mapa monta con pines + heatmap sin
    // round-trip. quakes ahora es lectura local del snapshot (rápida); el timeout
    // de 500ms solo cubre la ventana fría tras un deploy (antes del primer cron,
    // cuando fetchQuakes cae a cómputo en vivo) — ahí el cliente lo carga luego.
    const [seed, quakes, og] = await Promise.all([
      fetchSeedReports().catch(() => [] as Pin[]),
      Promise.race([
        fetchQuakes(),
        new Promise<null>((res) => setTimeout(() => res(null), 500)),
      ]).catch(() => null),
      deps.r
        ? fetchOg({ data: deps.r }).catch(() => null)
        : Promise.resolve(null),
    ])
    return { og, seed, quakes }
  },
  head: ({ loaderData }) => {
    const og = loaderData?.og
    // Sin reporte = la home: canonical a la raíz (no arrastrar ?r al indexar).
    if (!og) return { links: [{ rel: 'canonical', href: 'https://ayudave.com/' }] }
    return {
      meta: [
        { title: og.title },
        { name: 'description', content: og.description },
        { property: 'og:title', content: og.title },
        { property: 'og:description', content: og.description },
        { property: 'og:url', content: og.url },
        { property: 'og:image', content: og.image },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: og.title },
        { name: 'twitter:description', content: og.description },
        { name: 'twitter:image', content: og.image },
      ],
      links: [{ rel: 'canonical', href: og.url }],
    }
  },
  component: App,
})

// Leaflet toca window: el mapa es cliente puro. lazy() evita importarlo en SSR.
const MapScreen = lazy(() => import('../components/map/map-screen'))

function App() {
  const { seed, quakes } = Route.useLoaderData()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return <Splash quakes={quakes} />
  return (
    <Suspense fallback={<Splash quakes={quakes} />}>
      <MapScreen initialPins={seed} initialQuakes={quakes} />
    </Suspense>
  )
}

const noop = () => {}

// App shell: el chrome (badge + botones, con la data de quakes del SSR) se pinta
// ya en su sitio; el único hueco que carga es el mapa (beige + retícula + spinner,
// igual que el estado vacío del MapContainer). Cuando Leaflet monta encima, no hay
// pop-in ni flash. Handlers inertes: la ventana de carga es de unos cientos de ms.
function Splash({ quakes }: { quakes: QuakeData | null }) {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div className="ave-splash absolute inset-0 z-0 grid place-items-center">
        <span className="ave-spinner" aria-hidden />
      </div>
      <MapChrome
        quakes={quakes}
        satellite={false}
        outsideVE={false}
        infoOpen={false}
        searchOpen={false}
        tab="mapa"
        onTab={noop}
        onBanner={noop}
        onEmergency={noop}
        onSearch={noop}
        onToggleSatellite={noop}
        onRecenter={noop}
        onReport={noop}
      />
    </div>
  )
}
