import { useState } from 'react'
import { Popover } from 'radix-ui'
import { Check, ChevronsUpDown, Map as MapIcon, MapPin, Phone, Search } from 'lucide-react'
import { MOCK_AID_CENTERS, mockList, type AidCenter } from '../../mock'
import { HelpUsCard } from './help-us-card'
import { TelegramCta } from '../telegram-cta'

// "Cómo ayudar" (POC G): selector de país + centros de acopio del país elegido.
// Etapa 1: datos dummy (?mock=) — la tabla aid_centers se wirea en Etapa 2.
// Es una tab (panel bajo el nav): se sale por el bottom-nav, sin botón de cerrar.
export function ComoAyudarScreen() {
  const [{ items, loading }] = useState(() => mockList(MOCK_AID_CENTERS))

  // ponytail: países derivados de los centros; en E2 vendrán del backend.
  const countries = Array.from(
    new Map(items.map((c) => [c.country, c.flag])).entries(),
  ).sort((a, b) => a[0].localeCompare(b[0]))

  const [country, setCountry] = useState<string | null>(null)
  const shown = country ? items.filter((c) => c.country === country) : []

  return (
    <div className="fixed inset-0 z-[820] flex flex-col bg-surface-muted">
      <header
        className="flex-none border-b border-line bg-white"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <h1 className="px-4 pb-3 text-[20px] font-extrabold text-ink">Cómo ayudar</h1>
      </header>

      <div className="flex-none border-b border-line bg-white px-4 py-3">
        <CountryCombobox
          countries={countries}
          value={country}
          onChange={setCountry}
        />
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        {loading ? (
          <p className="py-6 text-center text-[13px] text-ink-faint">Cargando…</p>
        ) : !country ? (
          <div className="mt-16 grid place-items-center px-8 text-center">
            <MapPin className="size-10 text-ink-faint" />
            <p className="mt-3 text-[14px] text-ink-muted">
              Elegí un país para ver sus centros de acopio.
            </p>
          </div>
        ) : shown.length === 0 ? (
          <div className="mt-16 grid place-items-center px-8 text-center">
            <MapPin className="size-10 text-ink-faint" />
            <p className="mt-3 text-[14px] text-ink-muted">
              Aún no hay centros de acopio en {country}.
            </p>
          </div>
        ) : (
          <div className="px-4 pt-3">
            {shown.map((c) => (
              <AidCard key={c.id} c={c} />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 px-4 pt-6">
          <TelegramCta />
          <HelpUsCard />
        </div>
      </div>
    </div>
  )
}

function CountryCombobox({
  countries,
  value,
  onChange,
}: {
  countries: [string, string][]
  value: string | null
  onChange: (c: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = q.trim()
    ? countries.filter(([name]) => name.toLowerCase().includes(q.toLowerCase()))
    : countries
  const flag = value && countries.find(([n]) => n === value)?.[1]

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQ('')
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-3 text-left text-[14px] text-ink"
        >
          {flag && <span className="text-[18px]">{flag}</span>}
          <span className={value ? '' : 'text-ink-muted'}>
            {value ?? 'Seleccioná un país'}
          </span>
          <ChevronsUpDown className="ml-auto size-[18px] flex-none text-ink-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[900] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-line bg-white shadow-lg"
        >
          <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5 text-ink-muted">
            <Search className="size-[18px] flex-none" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar país…"
              className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3.5 py-3 text-[13px] text-ink-muted">Sin resultados.</p>
            ) : (
              filtered.map(([name, f]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(name)
                    setOpen(false)
                    setQ('')
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[14px] text-ink hover:bg-surface-muted"
                >
                  <span className="text-[18px]">{f}</span>
                  <span>{name}</span>
                  {value === name && (
                    <Check className="ml-auto size-[18px] flex-none text-lagoon" />
                  )}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function AidCard({ c }: { c: AidCenter }) {
  return (
    <article className="mb-3 rounded-2xl border border-line bg-white p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-[18px]">{c.flag}</span>
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold text-ink">{c.name}</p>
          <p className="text-[12.5px] text-ink-muted">
            {c.city}, {c.country}
          </p>
        </div>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[13.5px] text-ink-muted">
        <MapPin className="mt-0.5 size-[15px] flex-none" /> {c.address}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {c.needs.map((n) => (
          <span
            key={n}
            className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-bold text-ink"
          >
            {n}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-lagoon text-[13.5px] font-bold text-white"
        >
          <MapIcon className="size-4" /> Ver en mapa
        </button>
        {c.contact ? (
          <a
            href={`tel:${c.contact.replace(/[^\d+]/g, '')}`}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white text-[13.5px] font-bold text-ink no-underline"
          >
            <Phone className="size-4" /> Contacto
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white text-[13.5px] font-bold text-ink-faint"
          >
            <Phone className="size-4" /> Contacto
          </button>
        )}
      </div>
    </article>
  )
}
