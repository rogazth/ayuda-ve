import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Bus,
  Check,
  HeartPulse,
  Megaphone,
  Package,
  Phone,
  Plus,
  Send,
  Shield,
  Tent,
  Wifi,
} from 'lucide-react'
import { fmtAge } from '../../reports/reports'
import {
  ANNOUNCEMENT_CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '../../announcements/announcements'
import type { AnnouncementCategory } from '../../announcements/announcements'
import {
  fetchAnnouncements,
  suggestAnnouncement,
} from '../../announcements/announcements.functions'
import type { Announcement } from '../../db/schema'

// Flecha del <select>, data-uri (asset, no color de tema). Igual que help-dialog.
const SELECT_STYLE = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%23737f82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 8 5 5 5-5'/%3E%3C/svg%3E\")",
  backgroundPosition: 'right 14px center',
}

type IconCmp = ComponentType<{ className?: string }>
const CATEGORY_ICONS: Record<AnnouncementCategory, IconCmp> = {
  salud: HeartPulse,
  conectividad: Wifi,
  rescate: Shield,
  insumos: Package,
  refugio: Tent,
  transporte: Bus,
}

// host legible para el link de fuente (cae al url crudo si no parsea).
function host(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Feed cronológico de avisos verificados (panel sobre el mapa, tab "Avisos").
// Read-only: solo muestra `status='visible'`. Chips de categoría filtran en
// cliente (volumen bajo, una sola carga). "Sugerir aviso" + moderación = otra fase.
export function AvisosScreen() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState<AnnouncementCategory | null>(null) // null = Todos
  const [showSuggest, setShowSuggest] = useState(false)

  useEffect(() => {
    fetchAnnouncements()
      .then((rows) => setItems(rows as Announcement[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const shown = cat ? items.filter((a) => a.category === cat) : items

  return (
    <div className="fixed inset-0 z-[820] flex flex-col bg-surface-muted">
      <header
        className="flex-none border-b border-line bg-white"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <h1 className="px-4 pb-2 text-[20px] font-extrabold text-ink">Avisos</h1>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip on={cat === null} onClick={() => setCat(null)}>
            Todos
          </Chip>
          {ANNOUNCEMENT_CATEGORIES.map((c) => {
            const color = CATEGORY_COLORS[c]
            const on = cat === c
            return (
              <Chip
                key={c}
                on={on}
                color={color}
                onClick={() => setCat(on ? null : c)}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: on ? '#fff' : color }}
                />
                {CATEGORY_LABELS[c]}
              </Chip>
            )
          })}
        </div>
      </header>

      <div
        className="flex-1 overflow-y-auto px-3 pt-3"
        style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        {shown.map((a) => (
          <Card key={a.id} a={a} />
        ))}
        {!loading && !shown.length && (
          <div className="mt-20 grid place-items-center px-8 text-center">
            <Megaphone className="size-10 text-ink-faint" />
            <p className="mt-3 text-[14px] text-ink-muted">
              {cat ? 'No hay avisos en esta categoría.' : 'No hay avisos por ahora.'}
            </p>
          </div>
        )}
        {loading && (
          <p className="py-6 text-center text-[13px] text-ink-faint">Cargando…</p>
        )}

        {/* Sugerir aviso: la comunidad propone → cola de moderación (pending). */}
        {!loading && (
          <button
            type="button"
            onClick={() => setShowSuggest(true)}
            className="mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-lagoon-wash text-[15px] font-bold text-lagoon-ink"
          >
            <Plus className="size-[19px]" /> Sugerir un aviso
          </button>
        )}
      </div>

      <SuggestAnnouncementDialog
        open={showSuggest}
        onClose={() => setShowSuggest(false)}
      />
    </div>
  )
}

const inputClass =
  'h-[48px] w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none focus:border-lagoon'
const labelClass = 'mb-1.5 block text-[13px] font-semibold text-ink-body'

// Sugerir aviso → suggestAnnouncement (entra pending). Espejo del dialog de
// "Sugerir contacto"; usa tokens semánticos en vez de hex.
function SuggestAnnouncementDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const empty = { category: 'salud', title: '', body: '', contact: '', url: '' }
  const [form, setForm] = useState(empty)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      setStatus('idle')
      setForm(empty)
    } else if (!open && d.open) d.close()
  }, [open])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <dialog
      ref={ref}
      className="m-0 h-dvh max-h-dvh w-full max-w-full border-0 bg-transparent p-0 text-ink backdrop:bg-[rgba(20,32,28,0.45)] open:animate-dialog-slide motion-reduce:open:animate-none"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <header className="flex items-center gap-3 border-b border-line px-[18px] pt-[18px] pb-3.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Volver"
            className="grid size-[34px] flex-none place-items-center rounded-full bg-surface-muted text-ink-body"
          >
            <ArrowLeft className="size-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[19px] font-extrabold text-ink">Sugerir aviso</h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Lo revisamos con su fuente y lo publicamos si verifica.
            </p>
          </div>
        </header>

        <div className="h-full flex-1 overflow-y-auto px-[18px] pt-4 pb-2">
          {status === 'done' ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 grid size-16 place-items-center rounded-full bg-success-wash text-success">
                <Check className="size-[30px]" strokeWidth={2.5} />
              </div>
              <h3 className="text-[18px] font-extrabold text-ink">¡Gracias!</h3>
              <p className="mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-ink-muted">
                Lo revisamos y lo publicamos si lo podemos verificar.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus('idle')
                  setForm(empty)
                }}
                className="mt-6 h-[44px] rounded-xl border border-line px-5 text-[14px] font-semibold text-ink"
              >
                Sugerir otro aviso
              </button>
            </div>
          ) : (
            <>
              <label className={labelClass}>Categoría</label>
              <select
                value={form.category}
                onChange={set('category')}
                className={`${inputClass} mb-3.5 appearance-none bg-no-repeat pr-10`}
                style={SELECT_STYLE}
              >
                {ANNOUNCEMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <label className={labelClass}>Título</label>
              <input
                value={form.title}
                onChange={set('title')}
                placeholder="ej. Punto Starlink gratis en Plaza Bolívar"
                maxLength={200}
                className={`${inputClass} mb-3.5`}
              />
              <label className={labelClass}>
                Descripción <span className="font-normal text-ink-muted">(opcional)</span>
              </label>
              <textarea
                value={form.body}
                onChange={set('body')}
                placeholder="Detalles: horario, qué ofrecen, cómo llegar…"
                maxLength={2000}
                rows={3}
                className="mb-3.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-lagoon"
              />
              <label className={labelClass}>
                Contacto <span className="font-normal text-ink-muted">(opcional)</span>
              </label>
              <input
                value={form.contact}
                onChange={set('contact')}
                placeholder="ej. 0212-555-1234"
                maxLength={50}
                type="tel"
                className={`${inputClass} mb-3.5`}
              />
              <label className={labelClass}>
                Fuente / enlace <span className="font-normal text-ink-muted">(opcional)</span>
              </label>
              <input
                value={form.url}
                onChange={set('url')}
                placeholder="ej. https://instagram.com/..."
                maxLength={500}
                type="url"
                className={inputClass}
              />
            </>
          )}
        </div>

        {status !== 'done' && (
          <div className="border-t border-line px-[18px] pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
            {status === 'error' && (
              <p className="mb-2 text-[13px] font-semibold text-danger">
                No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.
              </p>
            )}
            <button
              type="button"
              disabled={!form.title.trim() || status === 'sending'}
              onClick={async () => {
                setStatus('sending')
                try {
                  await suggestAnnouncement({
                    data: {
                      category: form.category,
                      title: form.title,
                      body: form.body || null,
                      contact: form.contact || null,
                      url: form.url || null,
                    },
                  })
                  setStatus('done')
                } catch {
                  setStatus('error')
                }
              }}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-lagoon text-[15.5px] font-bold text-white disabled:opacity-50"
            >
              <Send className="size-4" />
              {status === 'sending' ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}

function Chip({
  on,
  color,
  onClick,
  children,
}: {
  on: boolean
  color?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
        on && !color
          ? 'border-ink bg-ink text-white'
          : on
            ? 'text-white'
            : 'border-line bg-white text-ink-body'
      }`}
      style={on && color ? { background: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  )
}

// `category` viene de inserts controlados (avisos oficiales por SQL) → vocabulario
// confiable; no defendemos contra typos de nuestro propio seed.
function Card({ a }: { a: Announcement }) {
  const cat = a.category as AnnouncementCategory
  const color = CATEGORY_COLORS[cat]
  const label = CATEGORY_LABELS[cat]
  const Icon = CATEGORY_ICONS[cat]
  return (
    <article className="mb-2.5 rounded-2xl bg-white p-3.5 shadow-[0_1px_3px_rgba(23,58,64,0.06)]">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-[36px] flex-none place-items-center rounded-xl"
          style={{ background: color }}
        >
          <Icon className="size-[19px] text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold" style={{ color }}>
            {label}
          </p>
          <p className="flex items-center gap-1 text-[12px] font-semibold text-success">
            <BadgeCheck className="size-[14px]" /> Verificado
          </p>
        </div>
        <span className="flex-none text-[12px] text-ink-muted">
          {fmtAge(a.createdAt.getTime())}
        </span>
      </div>
      <h3 className="mt-2.5 text-[16px] leading-snug font-bold text-ink">{a.title}</h3>
      {a.body && <p className="mt-1 text-[14px] leading-relaxed text-ink-body">{a.body}</p>}
      {a.contact && (
        <a
          href={`tel:${a.contact.replace(/[^\d+]/g, '')}`}
          className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-bold text-lagoon-ink no-underline"
        >
          <Phone className="size-[15px]" /> {a.contact}
        </a>
      )}
      {a.url && (
        <div className="mt-2 text-[13px] text-ink-muted">
          Fuente:{' '}
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-semibold text-lagoon-ink"
          >
            {host(a.url)} ↗
          </a>
        </div>
      )}
    </article>
  )
}
