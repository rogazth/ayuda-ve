import { useEffect, useRef, useState } from 'react'
import {
  BadgeCheck,
  Check,
  ExternalLink,
  Link2,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Send,
  SendHorizontal,
  Share2,
  Users,
  X,
} from 'lucide-react'
import {
  canContact,
  fmtAge,
  fmtDist,
  haversine,
  metaFields,
  phoneIntl,
  safeUrl,
  typeOf,
} from '../../reports/reports'
import { appearReport, flagReport } from '../../reports/reports.functions'
import type { ReportDetail } from '../../reports/reports.functions'
// Etapa 1: comentarios con datos dummy + variantes (?mock=full|empty|loading). El
// backend de comentarios (comments.functions) queda parqueado y se wirea en E2. [[mock]]
import { MOCK_COMMENTS, mockList, type Comment } from '../../mock'
import { MoreActionsDrawer } from './more-actions-drawer'

// Tipos cuyo CTA de mapa es "Ver ubicación" (no se va "hacia" ellos).
const DIR_LABEL_TYPES = ['danger', 'road', 'security', 'flood', 'missing', 'lostpet']

// Un voto (flag/aparición) por reporte por dispositivo. ponytail: guard
// client-side sin auth — suficiente para MVP; subir a rate-limit por IP si hay
// manipulación. 'f' = reportado, 'a' = "ya apareció".
type Vote = { f?: boolean; a?: boolean }
function votes(): Record<string, Vote> {
  try {
    return JSON.parse(localStorage.getItem('ave-voted') ?? '{}')
  } catch {
    return {}
  }
}
function addVote(id: string, k: keyof Vote) {
  const v = votes()
  v[id] = { ...v[id], [k]: true }
  try {
    localStorage.setItem('ave-voted', JSON.stringify(v))
  } catch {
    /* sin localStorage: el guard no persiste, no es crítico */
  }
}

// Nombre específico (desaparecido/mascota) o null. Lo usan el header, el cuerpo
// y el texto de compartir → una sola fuente.
function reportName(report: {
  type: string
  meta: Record<string, unknown>
}): string | null {
  if (
    report.type === 'missing' &&
    typeof report.meta.missingName === 'string' &&
    report.meta.missingName.trim()
  )
    return report.meta.missingName.trim()
  if (
    report.type === 'lostpet' &&
    typeof report.meta.petName === 'string' &&
    report.meta.petName.trim()
  )
    return report.meta.petName.trim()
  return null
}

// Texto de compartir: pedido con nombre si lo hay; si no, el tipo.
function shareText(report: ReportDetail): string {
  const nm = reportName(report)
  return nm ? `Ayúdanos a encontrar a ${nm}` : typeOf(report.type).label
}

// Marca circular con el color + ícono del tipo (mismo lenguaje que el pin).
function TypeMark({ type }: { type: string }) {
  const t = typeOf(type)
  return (
    <span
      className="grid h-[44px] w-[44px] flex-shrink-0 place-items-center rounded-full"
      style={{ background: t.color }}
    >
      <svg
        viewBox="0 0 24 24"
        width={23}
        height={23}
        dangerouslySetInnerHTML={{ __html: t.svg }}
      />
    </span>
  )
}

// Slider de fotos con scroll-snap nativo + dots. ponytail: sin librería de
// carrusel — el índice activo sale de scrollLeft/clientWidth en onScroll.
function PhotoSlider({ photos }: { photos: string[] }) {
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)

  if (photos.length < 2)
    return (
      <>
        <div className="px-4 pt-3.5">
          <img
            src={photos[0]}
            alt=""
            onClick={() => setLightbox(0)}
            className="h-[200px] w-full cursor-pointer rounded-2xl bg-surface-muted object-cover"
          />
        </div>
        {lightbox !== null && (
          <PhotoLightbox
            photos={photos}
            initial={lightbox}
            onClose={() => setLightbox(null)}
          />
        )}
      </>
    )
  return (
    <>
      <div className="px-4 pt-3.5">
        <div className="relative overflow-hidden rounded-2xl">
          <div
            onScroll={(e) => {
              const el = e.currentTarget
              setActive(Math.round(el.scrollLeft / el.clientWidth))
            }}
            className="flex h-[200px] w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {photos.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                onClick={() => setLightbox(i)}
                className="h-full w-full flex-shrink-0 cursor-pointer snap-center bg-surface-muted object-cover"
              />
            ))}
          </div>
          <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.45))]">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === active ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        </div>
      </div>
      {lightbox !== null && (
        <PhotoLightbox
          photos={photos}
          initial={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}

function PhotoLightbox({
  photos,
  initial,
  onClose,
}: {
  photos: string[]
  initial: number
  onClose: () => void
}) {
  const [active, setActive] = useState(initial)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = initial * el.clientWidth
  }, [])

  return (
    <div className="fixed inset-0 z-[980] flex flex-col bg-black">
      <div
        className="flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <span className="text-[14px] text-white/60">
          {active + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="grid h-[34px] w-[34px] place-items-center rounded-full bg-white/15"
        >
          <X className="size-5 text-white" />
        </button>
      </div>
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget
          setActive(Math.round(el.scrollLeft / el.clientWidth))
        }}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((src, i) => (
          <div
            key={i}
            className="flex h-full w-full flex-shrink-0 snap-center items-center justify-center"
          >
            <img
              src={src}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div
          className="flex justify-center gap-1.5 pt-3"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          {photos.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ReportDetailScreen({
  report,
  user,
  onClose,
  onViewOnMap,
}: {
  report: ReportDetail | null
  user: [number, number] | null
  onClose: () => void
  onViewOnMap: (lat: number, lng: number) => void
}) {
  const [flagged, setFlagged] = useState(false)
  const [appeared, setAppeared] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)
  const [appearOpen, setAppearOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // Al cargar/cambiar de reporte, lee el estado de voto persistido.
  useEffect(() => {
    if (!report) return
    const v = votes()[report.id] as Vote | undefined
    setFlagged(!!v?.f)
    setAppeared(!!v?.a)
  }, [report?.id])

  const doFlag = (reason: string) => {
    if (!report || flagged) return
    setFlagged(true)
    addVote(report.id, 'f')
    flagReport({
      data: { id: report.id, reason: reason.trim() || undefined },
    }).catch(() => {})
  }

  const doAppear = () => {
    if (!report || appeared) return
    setAppeared(true)
    addVote(report.id, 'a')
    appearReport({ data: { id: report.id } }).catch(() => {})
  }

  // Compartir: en móvil (Android/iOS) la hoja nativa del SO es lo más familiar
  // —sobre todo para personas mayores— y manda a WhatsApp/todo. Sin `share`
  // (escritorio) caemos a la hoja con botones de marca. [[share]]
  const doShare = async () => {
    if (!report) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareText(report),
          text: shareText(report),
          url: `${location.origin}/?r=${report.id}`,
        })
      } catch {
        /* el usuario canceló la hoja nativa: no abrimos la de respaldo */
      }
      return
    }
    setShareOpen(true)
  }

  // Header: un pill de estado con prioridad Encontrado > Verificado > Comunidad.
  // Le da sentido al header (antes casi vacío) y libera el cuerpo: la procedencia
  // ya no se repite abajo, solo queda el bloque de Fuente si hay enlace. [[report-detail]]
  const status = !report
    ? null
    : report.status === 'found'
      ? { label: 'Encontrado', Icon: BadgeCheck, cls: 'bg-success text-white' }
      : report.verified
        ? {
            label: 'Verificado',
            Icon: BadgeCheck,
            cls: 'border border-success-line bg-success-wash text-success',
          }
        : {
            label: 'Reporte de la comunidad',
            Icon: Users,
            cls: 'border border-line bg-surface-muted text-ink-body',
          }

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-white animate-dialog-slide motion-reduce:animate-none">
      {/* Header — pill de estado + cerrar a la derecha (alcanzable con el pulgar). */}
      <div
        className="flex items-center gap-3 border-b border-surface-muted px-4"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <span className="flex-1">
          {status && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${status.cls}`}
            >
              <status.Icon className="size-[15px]" /> {status.label}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-surface-muted text-sea-ink-soft"
        >
          <X className="size-[18px]" />
        </button>
      </div>

      {!report ? (
        <div className="grid flex-1 place-items-center">
          <p className="text-[14px] text-ink-muted">Cargando reporte…</p>
        </div>
      ) : (
        <Body
          report={report}
          user={user}
          appeared={appeared}
          onAppear={() => setAppearOpen(true)}
          onShare={doShare}
          onMore={() => setMoreOpen(true)}
          onViewOnMap={onViewOnMap}
        />
      )}

      {shareOpen && report && (
        <ShareSheet report={report} onClose={() => setShareOpen(false)} />
      )}

      {moreOpen && report && (
        <MoreActionsDrawer
          lat={report.lat}
          lng={report.lng}
          dirLabel={
            DIR_LABEL_TYPES.includes(report.type) ? 'Ver ubicación' : 'Cómo llegar'
          }
          intl={phoneIntl(report.contact)}
          showContact={canContact(report.type, report.contact)}
          flagged={flagged}
          onFlag={() => setFlagOpen(true)}
          onClose={() => setMoreOpen(false)}
        />
      )}

      {flagOpen && (
        <FlagDialog
          onCancel={() => setFlagOpen(false)}
          onSubmit={(reason) => {
            doFlag(reason)
            setFlagOpen(false)
          }}
        />
      )}
      {appearOpen && (
        <AppearDialog
          onCancel={() => setAppearOpen(false)}
          onConfirm={() => {
            doAppear()
            setAppearOpen(false)
          }}
        />
      )}
    </div>
  )
}

function Body({
  report,
  user,
  appeared,
  onAppear,
  onShare,
  onMore,
  onViewOnMap,
}: {
  report: ReportDetail
  user: [number, number] | null
  appeared: boolean
  onAppear: () => void
  onShare: () => void
  onMore: () => void
  onViewOnMap: (lat: number, lng: number) => void
}) {
  const { type, meta } = report
  const found = report.status === 'found'
  const t = typeOf(type)
  const photos = report.media.map((m) => m.url)
  const fields = metaFields(type, meta)
  const dist = user
    ? fmtDist(haversine(user[0], user[1], report.lat, report.lng))
    : null
  // Título del cuerpo: nombre específico si lo hay; si no, el tipo (acá el header
  // queda sin título, así el tipo aparece una sola vez).
  const headline = reportName(report) ?? t.label
  // Fuente externa saneada (safeUrl valida http(s) y bloquea credenciales); host
  // limpio para mostrarla dentro del badge de procedencia, comunidad o verificado.
  const src = safeUrl(report.url)
  const host = src ? new URL(src).host.replace(/^www\./, '') : null
  // Línea de dirección legible si el meta la trae; si no, etiqueta genérica. El
  // botón siempre lleva al mapa (todo reporte tiene lat/lng).
  const addrLine =
    (typeof meta.address === 'string' && meta.address.trim()) ||
    (typeof meta.location === 'string' && meta.location.trim()) ||
    null
  const addrSub = typeof meta.zone === 'string' ? meta.zone.trim() || null : null

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {photos.length > 0 && <PhotoSlider photos={photos} />}

        {/* Identidad: marca del tipo + título (nombre o tipo) + cuándo/dónde */}
        <div className="flex items-center gap-3 px-5 pt-4">
          <TypeMark type={type} />
          <div className="min-w-0">
            <h1
              className="truncate text-[22px] leading-tight font-bold"
              style={{ color: t.color }}
            >
              {headline}
            </h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {fmtAge(report.createdAt)}
              {dist ? ` · ${dist}` : ''}
            </p>
          </div>
        </div>

        {/* Meta por tipo — cajas kv del POC (label arriba, valor abajo). Todas
            iguales: las listas (p. ej. "Necesita") van como valor unido, no como
            un bloque aparte de chips. */}
        {fields.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 px-5">
            {fields.map((f) => (
              <div
                key={f.label}
                className="rounded-lg border border-line bg-surface-muted px-3 py-2"
              >
                <p className="text-[11px] font-semibold tracking-[0.03em] text-ink-muted uppercase">
                  {f.label}
                </p>
                <p className="mt-0.5 text-[14px] font-semibold text-ink">
                  {f.chips ? f.chips.join(', ') : f.text}
                </p>
              </div>
            ))}
          </div>
        )}

        {report.description.trim() && (
          <p className="mt-5 px-5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink-body">
            {report.description}
          </p>
        )}

        {/* Ubicación + "Ver en mapa" (POC). Todo reporte tiene lat/lng → centra
            el mapa vivo y cierra el detalle. */}
        <div className="mt-5 px-5">
          <button
            type="button"
            onClick={() => onViewOnMap(report.lat, report.lng)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-muted px-3.5 py-3 text-left"
          >
            <MapPin className="size-5 flex-none text-lagoon-ink" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold text-ink">
                {addrLine || 'Ubicación del reporte'}
              </span>
              {addrSub && (
                <span className="block truncate text-[12px] text-ink-muted">
                  {addrSub}
                </span>
              )}
            </span>
            <span className="flex flex-none flex-col items-center gap-0.5 text-lagoon-ink">
              <MapIcon className="size-5" />
              <span className="text-[11px] font-bold">Ver en mapa</span>
            </span>
          </button>
        </div>

        {/* Fuente: bloque único que aparece solo si el reporte trae enlace de
            origen (igual para verificado y comunidad). La procedencia vive ahora
            en el pill del header. [[report-detail]] */}
        {src && (
          <div className="mt-6 px-5">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface-muted px-3.5 py-3"
            >
              <Link2 className="size-5 flex-none text-lagoon-ink" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold tracking-[0.03em] text-ink-muted uppercase">
                  Fuente
                </span>
                <span className="block truncate text-[14px] font-bold text-ink">
                  {host}
                </span>
              </span>
              <ExternalLink className="size-[18px] flex-none text-lagoon-ink" />
            </a>
          </div>
        )}

        {/* "Ya apareció" — solo desaparecidos de la comunidad. A los 3 votos el
            aviso se oculta del mapa (el umbral vive en appearReport). */}
        {type === 'missing' && !report.verified && !found && (
          <div className="mt-4 px-5">
            <div className="flex items-center justify-between rounded-2xl bg-success-wash px-4 py-3">
              <span className="text-[14px] text-success">
                ¿Esta persona ya apareció?
              </span>
              <button
                type="button"
                onClick={onAppear}
                disabled={appeared}
                className="rounded-full bg-success px-4 py-2 text-[13px] font-bold text-white disabled:bg-success/45"
              >
                {appeared ? '✓ Marcado' : 'Ya apareció'}
              </button>
            </div>
          </div>
        )}

        {/* Comentarios de la comunidad */}
        <div className="mt-6 px-5 pb-2">
          <CommentsSection reportId={report.id} />
        </div>
      </div>

      {/* Footer: Compartir (acción primaria — difundir es el punto) + Opciones
          (Cómo llegar / Llamar / WhatsApp / Reportar). Los comentarios viven en el
          cuerpo; "Ya apareció" también. */}
      <div
        className="flex gap-2.5 border-t border-surface-muted px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={onShare}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-lagoon text-[16px] font-bold text-white"
        >
          <Share2 className="size-[20px]" /> Compartir
        </button>
        <button
          type="button"
          onClick={onMore}
          className="flex h-[50px] flex-none items-center justify-center gap-2 rounded-2xl border border-line px-5 text-[15px] font-bold text-ink-body"
        >
          <MoreHorizontal className="size-[20px]" /> Opciones
        </button>
      </div>
    </>
  )
}

// Compartir por redes con intent URLs (cero dependencias). WhatsApp/Telegram
// dominan en VE para redes de búsqueda; X/Facebook por alcance; copiar como fallback.
// ponytail: navigator.share queda fuera — el usuario pidió botones nombrados.
function ShareSheet({
  report,
  onClose,
}: {
  report: ReportDetail
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const url = `${location.origin}/?r=${report.id}`
  const text = shareText(report)
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)

  // Facebook ignora el texto (solo toma la URL y lee el OG del link).
  // ponytail: los `bg` son colores de marca de cada red (identidad de terceros),
  // no tokens de la app — quedan literales a propósito.
  const targets = [
    {
      label: 'WhatsApp',
      bg: '#25D366',
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      icon: <MessageCircle className="size-6 text-white" />,
    },
    {
      label: 'Telegram',
      bg: '#229ED9',
      href: `https://t.me/share/url?url=${u}&text=${t}`,
      icon: <Send className="size-6 text-white" />,
    },
    {
      label: 'X',
      bg: '#000000',
      href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
      glyph: 'X',
    },
    {
      label: 'Facebook',
      bg: '#1877F2',
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      glyph: 'f',
    },
  ]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* sin clipboard: nada que hacer */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[970] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl sm:pb-5"
      >
        <h2 className="text-[18px] font-bold text-ink">
          Compartir reporte
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          Difundir ayuda a que llegue a más gente.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-x-2 gap-y-4">
          {targets.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex w-[64px] flex-col items-center gap-1.5"
            >
              <span
                className="grid size-[52px] place-items-center rounded-full"
                style={{ background: s.bg }}
              >
                {s.icon ?? (
                  <span className="text-[22px] font-bold text-white">
                    {s.glyph}
                  </span>
                )}
              </span>
              <span className="text-[12px] text-ink-body">{s.label}</span>
            </a>
          ))}
          <button
            type="button"
            onClick={copy}
            className="flex w-[64px] flex-col items-center gap-1.5"
          >
            <span className="grid size-[52px] place-items-center rounded-full bg-surface-muted">
              {copied ? (
                <Check className="size-6 text-lagoon" />
              ) : (
                <Link2 className="size-6 text-ink-body" />
              )}
            </span>
            <span className="text-[12px] text-ink-body">
              {copied ? 'Copiado' : 'Copiar'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

// "Ya apareció": ocultar el aviso es sensible, así que pedimos intención explícita.
function AppearDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[960] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl sm:pb-5"
      >
        <h2 className="text-[18px] font-bold text-ink">
          ¿Esta persona ya apareció?
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          Márcalo solo si sabes que la encontraron. Cuando varias personas lo
          confirmen, el aviso se ocultará del mapa.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-[48px] flex-1 rounded-2xl border border-line text-[15px] font-bold text-ink-body"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-[48px] flex-1 rounded-2xl bg-success text-[15px] font-bold text-white"
          >
            Ya apareció
          </button>
        </div>
      </div>
    </div>
  )
}

// Reportar abuso con motivo opcional. Full-screen en mobile (espacio para teclado),
// card en desktop. El motivo se valida server-side; la auditoría en
// moderation_events se wirea en Etapa 2 (hoy flagReport solo incrementa/oculta).
function FlagDialog({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-[960] flex flex-col bg-white sm:items-center sm:justify-center sm:bg-black/40 sm:p-4">
      <div className="flex min-h-0 w-full flex-1 flex-col bg-white sm:max-w-md sm:flex-none sm:rounded-2xl">
        <div
          className="flex items-center gap-3 border-b border-surface-muted px-4 pb-3 sm:border-0 sm:pt-4 sm:pb-0"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
        >
          <span className="flex-1 text-[17px] font-bold text-ink sm:text-[18px]">
            Reportar aviso
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="grid size-[34px] flex-none place-items-center rounded-full bg-surface-muted text-sea-ink-soft"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 sm:flex-none">
          <p className="text-[14px] leading-relaxed text-ink-muted">
            Lo marcaremos para revisión. Si quieres, cuéntanos por qué: falso,
            duplicado, información peligrosa…
          </p>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={5}
            placeholder="Motivo (opcional)"
            className="mt-4 w-full resize-none rounded-xl border border-line px-4 py-3 text-[15px] text-ink outline-none focus:border-lagoon"
          />
        </div>
        <div
          className="border-t border-surface-muted px-5 pt-3 sm:border-0 sm:pt-2 sm:pb-4"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => onSubmit(reason)}
            className="h-[52px] w-full rounded-2xl bg-danger text-[16px] font-bold text-white"
          >
            Enviar reporte
          </button>
        </div>
      </div>
    </div>
  )
}

// Comentarios de la comunidad: lista + composer. Etapa 1: datos dummy en memoria
// (el composer agrega local, reportar marca local). addComment/flagComment se
// wirean en Etapa 2. El nombre es libre/opcional; React escapa el texto al render.
function CommentsSection({ reportId }: { reportId: string }) {
  const [{ items, loading }] = useState(() => mockList(MOCK_COMMENTS))
  const [list, setList] = useState<Comment[]>(items)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})

  const submit = () => {
    const t = text.trim()
    if (!t) return
    setList((l) => [
      {
        id: `local-${reportId}-${l.length}`,
        authorName: name.trim() || null,
        text: t,
        createdAt: Date.now(),
      },
      ...l,
    ])
    setText('')
  }

  const flag = (id: string) => {
    if (flagged[id]) return
    setFlagged((f) => ({ ...f, [id]: true }))
  }

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-ink">
        Comentarios
        {list.length > 0 && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[12px] font-bold text-ink-muted tabular-nums">
            {list.length}
          </span>
        )}
      </h2>

      <div className="rounded-2xl border border-line p-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Tu nombre (opcional)"
          className="mb-2 w-full rounded-xl bg-surface-muted px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={1}
            placeholder="Escribe un comentario…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl bg-surface-muted px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            aria-label="Enviar comentario"
            className="grid size-[40px] flex-none place-items-center rounded-full bg-lagoon text-white disabled:bg-lagoon-disabled"
          >
            <SendHorizontal className="size-[18px]" />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-[13px] text-ink-muted">Cargando comentarios…</p>
      ) : list.length === 0 ? (
        <p className="mt-4 text-[13px] text-ink-muted">
          Sé el primero en comentar.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  <b className="font-semibold text-ink">
                    {c.authorName || 'Anónimo'}
                  </b>
                  <span className="ml-2 text-ink-faint">
                    {fmtAge(c.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-[14px] leading-relaxed whitespace-pre-wrap text-ink-body">
                  {c.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => flag(c.id)}
                disabled={!!flagged[c.id]}
                aria-label="Reportar comentario"
                className="-mt-1 size-7 flex-none rounded-full text-ink-faint disabled:opacity-50"
              >
                <MoreHorizontal className="mx-auto size-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
