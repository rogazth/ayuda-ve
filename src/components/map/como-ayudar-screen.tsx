import { useState } from 'react'
import { Map as MapIcon, MapPin, Phone, Search } from 'lucide-react'
import { MOCK_AID_CENTERS, mockList, type AidCenter } from '../../mock'
import { HelpUsCard } from './help-us-card'
import { TelegramCta } from '../telegram-cta'

// "Cómo ayudar" (POC G): directorio buscable de centros de acopio en el exterior
// + mini-mapa acotado. Etapa 1: datos dummy (?mock=) — la tabla aid_centers y la
// búsqueda Mapbox se wirean en Etapa 2. Es una tab (panel bajo el nav, igual que
// Reportes): se sale por el bottom-nav, sin botón de cerrar.
const SEGMENTS = ['Centros de acopio', 'Donar', 'Qué se necesita'] as const
type Seg = (typeof SEGMENTS)[number]

export function ComoAyudarScreen() {
  const [seg, setSeg] = useState<Seg>('Centros de acopio')
  const [q, setQ] = useState('')
  const [{ items, loading }] = useState(() => mockList(MOCK_AID_CENTERS))

  const shown = q.trim()
    ? items.filter((c) =>
        `${c.name} ${c.city} ${c.country}`.toLowerCase().includes(q.toLowerCase()),
      )
    : items

  return (
    <div className="fixed inset-0 z-[820] flex flex-col bg-surface-muted">
      <header
        className="flex-none border-b border-line bg-white"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <h1 className="px-4 pb-3 text-[20px] font-extrabold text-ink">
          Cómo ayudar
        </h1>
      </header>

      <div className="flex flex-none gap-1.5 border-b border-line bg-white px-4 py-3">
        {SEGMENTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeg(s)}
            className={`h-[38px] flex-1 rounded-full border text-[13px] font-bold ${
              seg === s
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-white text-ink-body'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        {seg === 'Centros de acopio' ? (
          <>
            <div className="mx-4 mt-3.5 flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 text-ink-muted">
              <Search className="size-[18px] flex-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar país o ciudad…"
                className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted"
              />
            </div>

            {/* Mini-mapa acotado: decorativo (no monta Leaflet). En E2 = mapa real
                con maxBounds estrechos o imagen estática. */}
            <div
              className="relative mx-4 mt-3 h-[130px] overflow-hidden rounded-2xl border border-line"
              style={{
                background:
                  'repeating-linear-gradient(90deg,transparent 0 40px,rgba(120,128,124,.14) 40px 41px),repeating-linear-gradient(0deg,transparent 0 44px,rgba(120,128,124,.1) 44px 45px),#e9ecef',
              }}
            >
              {[
                [80, 70],
                [180, 50],
                [250, 95],
              ].map(([x, y], i) => (
                <span
                  key={i}
                  className="absolute grid size-6 place-items-center rounded-[50%_50%_50%_4px] bg-lagoon shadow-[0_3px_5px_rgba(20,30,30,0.3)]"
                  style={{ left: x, top: y, transform: 'translate(-50%,-100%) rotate(45deg)' }}
                >
                  <MapPin className="size-3 text-white" style={{ transform: 'rotate(-45deg)' }} />
                </span>
              ))}
            </div>

            {loading ? (
              <p className="py-6 text-center text-[13px] text-ink-faint">Cargando…</p>
            ) : shown.length === 0 ? (
              <div className="mt-16 grid place-items-center px-8 text-center">
                <MapPin className="size-10 text-ink-faint" />
                <p className="mt-3 text-[14px] text-ink-muted">
                  {q
                    ? 'No encontramos centros para esa búsqueda.'
                    : 'Aún no hay centros de acopio.'}
                </p>
              </div>
            ) : (
              <div className="px-4 pt-3">
                {shown.map((c) => (
                  <AidCard key={c.id} c={c} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="mt-16 grid place-items-center px-8 text-center">
            <p className="text-[14px] text-ink-muted">
              {seg === 'Donar'
                ? 'Canales de donación verificados — próximamente.'
                : 'Lista de lo que más se necesita — próximamente.'}
            </p>
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
