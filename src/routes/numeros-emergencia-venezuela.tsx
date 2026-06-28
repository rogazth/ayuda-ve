import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, Phone } from 'lucide-react'
import {
  EMERGENCY,
  FEATURED_ALERTS,
  REGIONAL,
  type ContactEntry,
} from '../reports/reports'
import { LandingShell } from '../components/landing/landing-shell'

const SITE = 'https://ayudave.com'
const URL = `${SITE}/numeros-emergencia-venezuela`
const TITLE = 'Números de emergencia en Venezuela'
const DESC =
  'Teléfonos de emergencia verificados en Venezuela: 911, bomberos, Protección Civil y contactos por estado. Cada número con su fuente y listo para llamar.'
// Curado a mano: las fuentes de los contactos son de junio de 2026.
const UPDATED = 'junio de 2026'

export const Route = createFileRoute('/numeros-emergencia-venezuela')({
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

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

function Page() {
  const regions = Object.entries(REGIONAL).filter(([, v]) => v && v.length)
  return (
    <LandingShell
      title={TITLE}
      intro="Solo publicamos números verificados con su fuente. Toca un número para llamar."
      updated={UPDATED}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }}
      />

      <Section title="Nacionales">
        {EMERGENCY.map((c) => (
          <ContactRow key={c.name + c.phone} c={c} />
        ))}
      </Section>

      {FEATURED_ALERTS.length > 0 && (
        <Section title="Líneas activas">
          {FEATURED_ALERTS.map((a) => (
            <div
              key={a.org + a.phone}
              className="border-b border-line px-4 py-3.5 last:border-b-0"
            >
              <p className="text-[15px] font-extrabold text-ink">{a.org}</p>
              <p className="mt-0.5 text-[13px] text-ink-muted">{a.headline}</p>
              <a
                href={tel(a.phone)}
                className="mt-2 inline-flex items-center gap-1.5 text-[15px] font-bold text-lagoon-ink no-underline"
              >
                <Phone className="size-4" /> {a.phone}
              </a>
              <Source label="" url={a.url} />
            </div>
          ))}
        </Section>
      )}

      {regions.map(([state, list]) => (
        <Section key={state} title={state}>
          {list!.map((c) => (
            <ContactRow key={c.name + c.phone} c={c} />
          ))}
        </Section>
      ))}
    </LandingShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 text-[12px] font-extrabold tracking-[0.05em] text-ink-faint uppercase">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {children}
      </div>
    </section>
  )
}

function ContactRow({ c }: { c: ContactEntry }) {
  return (
    <div className="border-b border-line px-4 py-3.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold text-ink">{c.name}</p>
          {c.note && <p className="mt-0.5 text-[12.5px] text-ink-muted">{c.note}</p>}
        </div>
        <a
          href={tel(c.phone)}
          className="flex flex-none items-center gap-1.5 rounded-xl bg-lagoon-wash px-3 py-2 text-[15px] font-bold text-lagoon-ink no-underline"
        >
          <Phone className="size-4" /> {c.phone}
        </a>
      </div>
      <Source label={c.source.label} url={c.source.url} />
    </div>
  )
}

function Source({ label, url }: { label: string; url?: string }) {
  if (!label && !url) return null
  return (
    <p className="mt-2 text-[11.5px] leading-[1.5] text-ink-faint">
      <span className="font-semibold">Fuente: </span>
      {label}
      {url && (
        <>
          {label ? '. ' : ''}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[3px] font-semibold text-lagoon-ink no-underline"
          >
            Ir al sitio <ExternalLink className="size-[11px]" />
          </a>
        </>
      )}
    </p>
  )
}
