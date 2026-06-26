import { useState } from 'react'
import type { ComponentType } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Bus,
  HeartPulse,
  Megaphone,
  Package,
  Phone,
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
// Etapa 1: datos dummy + variantes (?mock=full|empty|loading). El backend de
// avisos (announcements.functions) queda parqueado y se wirea en Etapa 2. [[mock]]
import { MOCK_ANNOUNCEMENTS, mockList, type Announcement } from '../../mock'

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
// cliente (volumen bajo, una sola carga). Para proponer un aviso, el público usa
// el buzón único "Enviar una sugerencia" (Más); aquí no hay formulario.
// Centro de notificaciones: feed de avisos verificados. Algunas notificaciones
// se ligan a un reporte (reportId) → CTA "Ver reporte". El badge rojo del nav
// (en MapChrome) indica que hay novedades.
export function AvisosScreen({
  onOpenReport,
}: {
  onOpenReport?: (id: string) => void
}) {
  const [{ items, loading }] = useState(() => mockList(MOCK_ANNOUNCEMENTS))
  const [cat, setCat] = useState<AnnouncementCategory | null>(null) // null = Todos

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
          <Card key={a.id} a={a} onOpenReport={onOpenReport} />
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
      </div>
    </div>
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
function Card({
  a,
  onOpenReport,
}: {
  a: Announcement
  onOpenReport?: (id: string) => void
}) {
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
          {fmtAge(a.createdAt)}
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
      {a.reportId && (
        <button
          type="button"
          onClick={() => onOpenReport?.(a.reportId!)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-lagoon-wash py-2.5 text-[14px] font-bold text-lagoon-ink"
        >
          Ver reporte <ArrowRight className="size-4" />
        </button>
      )}
    </article>
  )
}
