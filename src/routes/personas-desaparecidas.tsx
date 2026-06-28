import { createFileRoute, Link } from '@tanstack/react-router'
import { fetchFeed } from '../reports/reports.functions'
import type { FeedItem } from '../reports/reports.functions'
import { fmtAge } from '../reports/reports'
import { LandingShell } from '../components/landing/landing-shell'

const SITE = 'https://ayudave.com'
const URL = `${SITE}/personas-desaparecidas`
const TITLE = 'Personas desaparecidas en Venezuela'
const DESC =
  'Ayuda a encontrar a las personas desaparecidas durante la emergencia en Venezuela. Reportes con foto y última ubicación, listos para compartir por WhatsApp y llegar a más gente.'

export const Route = createFileRoute('/personas-desaparecidas')({
  loader: async (): Promise<{ items: FeedItem[] }> => {
    const items = await fetchFeed({ data: { types: ['missing'] } }).catch(
      () => [] as FeedItem[],
    )
    return { items }
  },
  head: () => ({
    meta: [
      { title: `${TITLE} · Ayuda Venezuela` },
      { name: 'description', content: DESC },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: URL },
      { property: 'og:title', content: `${TITLE} · Ayuda Venezuela` },
      { property: 'og:description', content: DESC },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: `${TITLE} · Ayuda Venezuela` },
      { name: 'twitter:description', content: DESC },
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
  component: Page,
})

const BREADCRUMB = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ayuda Venezuela', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: TITLE, item: URL },
  ],
}

function Page() {
  const { items } = Route.useLoaderData()
  return (
    <LandingShell
      title={TITLE}
      intro="Casos reportados por la comunidad. Toca un reporte para ver el detalle en el mapa y compartirlo."
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }}
      />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-5 text-[14px] text-ink-muted">
          Por ahora no hay reportes de personas desaparecidas.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                to="/"
                search={{ r: it.id }}
                className="flex gap-3 rounded-2xl border border-line bg-white p-3 no-underline"
              >
                {it.cover && (
                  <img
                    src={it.cover}
                    alt=""
                    loading="lazy"
                    className="size-[68px] flex-none rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-extrabold text-ink">
                    {it.title}
                  </p>
                  {it.address && (
                    <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                      {it.address}
                    </p>
                  )}
                  <p className="mt-1 text-[12.5px] text-ink-faint">
                    {fmtAge(it.createdAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </LandingShell>
  )
}
