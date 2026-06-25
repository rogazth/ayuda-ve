import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import * as Sentry from '@sentry/react'
import { Toaster } from 'sonner'

import appCss from '../styles.css?url'

// ponytail: browser-only init, SSR skipped via window check
if (typeof window !== 'undefined') {
  Sentry.init({
    dsn: 'https://8ee8b52de9a4ec37e81300385faf29c0@o638460.ingest.us.sentry.io/4511625208397824',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    environment: import.meta.env.MODE,
  })
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
      },
      { title: 'AyudaVE — Reportes de emergencia en Venezuela' },
      {
        name: 'description',
        content:
          'Mapa colaborativo de reportes de emergencia en Venezuela. Reporta y consulta incidentes, sismos y alertas en tiempo real.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'AyudaVE' },
      { property: 'og:url', content: 'https://ayudave.com' },
      { property: 'og:title', content: 'AyudaVE — Reportes de emergencia en Venezuela' },
      {
        property: 'og:description',
        content:
          'Mapa colaborativo de reportes de emergencia en Venezuela. Reporta y consulta incidentes, sismos y alertas en tiempo real.',
      },
      { property: 'og:image', content: 'https://ayudave.com/og.png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'AyudaVE — Reportes de emergencia en Venezuela' },
      {
        name: 'twitter:description',
        content:
          'Mapa colaborativo de reportes de emergencia en Venezuela. Reporta y consulta incidentes, sismos y alertas en tiempo real.',
      },
      { name: 'twitter:image', content: 'https://ayudave.com/og.png' },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // ponytail: dev-only, client-side import (touches window) — react-grab toolbar
  useEffect(() => {
    if (import.meta.env.DEV) import('react-grab')
  }, [])

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Toaster position="top-center" richColors />
        <Scripts />
      </body>
    </html>
  )
}
