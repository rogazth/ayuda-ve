import { useEffect, useState } from 'react'
import { Popover } from 'radix-ui'
import { Check, ChevronsUpDown, Map as MapIcon, MapPin, Phone, Search } from 'lucide-react'
import { fetchAidCenters } from '../../reports/reports.functions'
import type { AidCenter } from '../../reports/reports.functions'
import { HelpUsCard } from './help-us-card'
import { TelegramCta } from '../telegram-cta'

// Cuántas tarjetas pintar de una. Sin país (todos) la lista llega a ~700 → render
// incremental ("Ver más") para no congelar el primer paint en gama baja.
const PAGE = 80

// "Cómo ayudar": selector de país + centros de acopio. Sin país elegido muestra
// TODOS; pre-selecciona el país del visitante (CF-IPCountry) si tenemos centros ahí.
// Es una tab (panel bajo el nav): se sale por el bottom-nav, sin botón de cerrar.
export function ComoAyudarScreen() {
  const [data, setData] = useState<{ centers: AidCenter[]; suggested: string | null } | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    let alive = true
    fetchAidCenters()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ centers: [], suggested: null }))
    return () => {
      alive = false
    }
  }, [])

  // Pre-selecciona el país del visitante cuando llega la data (una vez).
  useEffect(() => {
    if (data?.suggested) setCountry(data.suggested)
  }, [data?.suggested])

  const loading = data === null
  const items = data?.centers ?? []

  // Países presentes (con bandera), ordenados; Venezuela primero (es el grueso).
  const countries = Array.from(new Map(items.map((c) => [c.country, c.flag])).entries()).sort(
    (a, b) => (a[0] === 'Venezuela' ? -1 : b[0] === 'Venezuela' ? 1 : a[0].localeCompare(b[0])),
  )

  const shown = country ? items.filter((c) => c.country === country) : items
  const visible = shown.slice(0, limit)
  // Reinicia el límite al cambiar de país.
  useEffect(() => setLimit(PAGE), [country])

  return (
    <div className="fixed inset-0 z-[820] flex flex-col bg-surface-muted">
      <header
        className="flex-none border-b border-line bg-white"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <h1 className="px-4 pb-3 text-[20px] font-extrabold text-ink">Cómo ayudar</h1>
      </header>

      <div className="flex-none border-b border-line bg-white px-4 py-3">
        <CountryCombobox countries={countries} value={country} onChange={setCountry} />
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        {loading ? (
          <p className="py-6 text-center text-[13px] text-ink-faint">Cargando…</p>
        ) : shown.length === 0 ? (
          <div className="mt-16 grid place-items-center px-8 text-center">
            <MapPin className="size-10 text-ink-faint" />
            <p className="mt-3 text-[14px] text-ink-muted">
              {country
                ? `Aún no hay centros de acopio en ${country}.`
                : 'Aún no hay centros de acopio.'}
            </p>
          </div>
        ) : (
          <div className="px-4 pt-3">
            <p className="mb-2 text-[12.5px] text-ink-muted">
              {country
                ? `${shown.length} ${shown.length === 1 ? 'centro' : 'centros'} en ${country}`
                : `${shown.length} centros en todos los países · elegí uno para filtrar`}
            </p>
            {visible.map((c) => (
              <AidCard key={c.id} c={c} />
            ))}
            {shown.length > visible.length && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="mb-2 mt-1 h-11 w-full rounded-xl border border-line bg-white text-[14px] font-bold text-ink"
              >
                Ver más ({shown.length - visible.length})
              </button>
            )}
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
  onChange: (c: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = q.trim()
    ? countries.filter(([name]) => name.toLowerCase().includes(q.toLowerCase()))
    : countries
  const flag = value ? countries.find(([n]) => n === value)?.[1] : '🌎'

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
            {value ?? 'Todos los países'}
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
            {!q.trim() && (
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[14px] text-ink hover:bg-surface-muted"
              >
                <span className="text-[18px]">🌎</span>
                <span>Todos los países</span>
                {value === null && (
                  <Check className="ml-auto size-[18px] flex-none text-lagoon" />
                )}
              </button>
            )}
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
            {[c.city, c.country].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>
      {c.address && (
        <p className="mt-2 flex items-start gap-1.5 text-[13.5px] text-ink-muted">
          <MapPin className="mt-0.5 size-[15px] flex-none" /> {c.address}
        </p>
      )}
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
