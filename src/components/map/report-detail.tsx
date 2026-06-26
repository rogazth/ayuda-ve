import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BadgeCheck,
  Check,
  ChevronLeft,
  ExternalLink,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Send,
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
import {
  appearReport,
  confirmReport,
  flagReport,
} from '../../reports/reports.functions'
import type { ReportDetail } from '../../reports/reports.functions'
import {
  addComment,
  fetchComments,
  flagComment,
} from '../../comments/comments.functions'
import type { CommentRow } from '../../comments/comments.functions'
import { MoreActionsDrawer } from './more-actions-drawer'

// Tipos cuyo CTA de mapa es "Ver ubicación" (no se va "hacia" ellos).
const DIR_LABEL_TYPES = ['danger', 'road', 'security', 'flood', 'missing', 'lostpet']

// Un voto (confirmar/flag) por reporte por dispositivo. ponytail: guard
// client-side sin auth — suficiente para MVP; subir a rate-limit por IP si hay
// manipulación. 'c' = confirmado, 'f' = reportado, 'a' = "ya apareció".
type Vote = { c?: boolean; f?: boolean; a?: boolean }
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

// Comentarios ya reportados por este dispositivo (guard anti-doble-flag).
function cflags(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('ave-cflag') ?? '{}')
  } catch {
    return {}
  }
}
function addCflag(id: string) {
  const v = cflags()
  v[id] = true
  try {
    localStorage.setItem('ave-cflag', JSON.stringify(v))
  } catch {
    /* idem: el guard no persiste, no es crítico */
  }
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
        <img
          src={photos[0]}
          alt=""
          onClick={() => setLightbox(0)}
          className="h-[260px] w-full cursor-pointer bg-surface-muted object-cover"
        />
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
      <div className="relative">
        <div
          onScroll={(e) => {
            const el = e.currentTarget
            setActive(Math.round(el.scrollLeft / el.clientWidth))
          }}
          className="flex h-[260px] w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
}: {
  report: ReportDetail | null
  user: [number, number] | null
  onClose: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [flagged, setFlagged] = useState(false)
  const [appeared, setAppeared] = useState(false)
  const [bump, setBump] = useState(0) // confirmaciones extra optimistas
  const [shareOpen, setShareOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)
  const [appearOpen, setAppearOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // Al cargar/cambiar de reporte, lee el estado de voto persistido.
  useEffect(() => {
    if (!report) return
    const v = votes()[report.id] as Vote | undefined
    setConfirmed(!!v?.c)
    setFlagged(!!v?.f)
    setAppeared(!!v?.a)
    setBump(0)
  }, [report?.id])

  const doConfirm = () => {
    if (!report || confirmed) return
    setConfirmed(true)
    setBump(1)
    addVote(report.id, 'c')
    confirmReport({ data: { id: report.id } }).catch(() => {})
  }

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

  const label = report ? typeOf(report.type).label : 'Reporte'

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-white">
      {/* Header — mismo chrome que el wizard */}
      <div
        className="flex items-center gap-3 border-b border-surface-muted px-4"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <span className="flex-1 truncate text-[17px] font-bold text-ink">
          {label}
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
          confirmed={confirmed}
          appeared={appeared}
          confirms={report.confirms + bump}
          onConfirm={() => setConfirmOpen(true)}
          onAppear={() => setAppearOpen(true)}
          onShare={() => setShareOpen(true)}
          onMore={() => setMoreOpen(true)}
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

      {confirmOpen && (
        <ConfirmDialog
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            doConfirm()
            setConfirmOpen(false)
          }}
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
  confirmed,
  appeared,
  confirms,
  onConfirm,
  onAppear,
  onShare,
  onMore,
}: {
  report: ReportDetail
  user: [number, number] | null
  confirmed: boolean
  appeared: boolean
  confirms: number
  onConfirm: () => void
  onAppear: () => void
  onShare: () => void
  onMore: () => void
}) {
  const { type, meta } = report
  const commentsRef = useRef<HTMLDivElement>(null)
  const [commentCount, setCommentCount] = useState(0)
  const found = report.status === 'found'
  const t = typeOf(type)
  const photos = report.media.map((m) => m.url)
  const fields = metaFields(type, meta)
  const dist = user
    ? fmtDist(haversine(user[0], user[1], report.lat, report.lng))
    : null
  const headline =
    type === 'missing' && meta.missingName
      ? String(meta.missingName)
      : type === 'lostpet' && meta.petName
        ? String(meta.petName)
        : t.label
  // Fuente externa saneada (safeUrl valida http(s) y bloquea credenciales); host
  // limpio para mostrarla dentro del badge de procedencia, comunidad o verificado.
  const src = safeUrl(report.url)
  const host = src ? new URL(src).host.replace(/^www\./, '') : null

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {photos.length > 0 && <PhotoSlider photos={photos} />}

        {/* Identidad: marca del tipo + título específico + cuándo/dónde */}
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

        {/* Encontrado: el reporte salió del mapa pero el link directo lo muestra así */}
        {found && (
          <div className="mt-4 mx-5 flex items-center gap-2 rounded-2xl border border-success-line bg-success-wash px-4 py-3 text-success">
            <BadgeCheck className="size-5 flex-shrink-0" />
            <span className="text-[14px] font-semibold">
              {type === 'lostpet'
                ? '🐾 Esta mascota fue encontrada'
                : 'Esta persona fue localizada'}
            </span>
          </div>
        )}

        {/* Meta por tipo */}
        {fields.length > 0 && (
          <div className="mt-5 space-y-3 px-5">
            {fields.map((f) =>
              f.chips ? (
                <div key={f.label}>
                  <p className="mb-1.5 text-[13px] font-semibold text-ink-muted">
                    {f.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {f.chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-surface-muted px-3 py-1.5 text-[13px] text-ink"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  key={f.label}
                  className="flex justify-between gap-4 border-b border-surface-muted pb-2.5"
                >
                  <span className="text-[14px] text-ink-muted">{f.label}</span>
                  <span className="text-right text-[14px] font-semibold text-ink">
                    {f.text}
                  </span>
                </div>
              ),
            )}
          </div>
        )}

        {report.description.trim() && (
          <p className="mt-5 px-5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink-body">
            {report.description}
          </p>
        )}

        {/* Procedencia: verificado (entidad/fuente confiable) o comunidad.
            Neutro, nunca "sin verificar". La fuente, si existe, va dentro del
            badge — en comunidad también (antes solo en verified, smell S2). */}
        <div className="mt-6 px-5">
          {report.verified ? (
            <div className="rounded-2xl border border-success-line bg-success-wash px-4 py-3">
              <div className="flex items-center gap-2 text-success">
                <BadgeCheck className="size-5 flex-shrink-0" />
                <span className="text-[13px] font-semibold">
                  Entidad verificada
                </span>
              </div>
              {src && (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 flex items-center justify-center gap-2 rounded-xl border border-success-line bg-white py-2.5 text-[14px] font-semibold text-success"
                >
                  <Link2 className="size-4" />
                  Ver publicación original
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface-muted px-4 py-3">
              <p className="flex items-center gap-1.5 text-[13px] text-ink-body">
                <Users className="size-[18px] flex-shrink-0 text-ink-muted" />
                <span className="font-semibold">Reporte de la comunidad</span>
                {host && (
                  <>
                    <span className="text-ink-faint">·</span>
                    <a
                      href={src!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 font-semibold text-lagoon-ink"
                    >
                      <span className="truncate">{host}</span>
                      <ExternalLink className="size-3.5 flex-shrink-0" />
                    </a>
                  </>
                )}
              </p>
            </div>
          )}
        </div>

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
        <div ref={commentsRef} className="mt-6 px-5 pb-2">
          <CommentsSection reportId={report.id} onCount={setCommentCount} />
        </div>
      </div>

      {/* Footer SOSAFE: Lo confirmo · Comentarios · Compartir · Más. Las acciones
          de contacto (Llamar/WhatsApp/Cómo llegar) y Reportar viven en el "Más". */}
      <div
        className="flex border-t border-surface-muted px-2 pt-1.5"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {!report.verified && !found && (
          <FooterAction
            icon={<Check className="size-[22px]" />}
            label={confirmed ? 'Confirmado' : 'Lo confirmo'}
            count={confirms}
            active={confirmed}
            disabled={confirmed}
            onClick={onConfirm}
          />
        )}
        <FooterAction
          icon={<MessageCircle className="size-[22px]" />}
          label="Comentarios"
          count={commentCount}
          onClick={() =>
            commentsRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }
        />
        <FooterAction
          icon={<Share2 className="size-[22px]" />}
          label="Compartir"
          onClick={onShare}
        />
        <FooterAction
          icon={<MoreHorizontal className="size-[22px]" />}
          label="Más"
          onClick={onMore}
        />
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
  const text =
    report.type === 'missing' && typeof report.meta.missingName === 'string'
      ? `Ayúdanos a encontrar a ${report.meta.missingName}`
      : report.type === 'lostpet' && typeof report.meta.petName === 'string'
        ? `Ayúdanos a encontrar a ${report.meta.petName}`
        : typeOf(report.type).label
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

// Confirmar = afirmar que el reporte es real → pedimos intención explícita.
// Bottom-sheet en mobile, card centrada en desktop.
function ConfirmDialog({
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
        <h2 className="text-[18px] font-bold text-ink">¿Lo confirmas?</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          Confírmalo solo si viste la situación o sabes que es real. Así otros
          saben en qué pueden confiar.
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
            className="h-[48px] flex-1 rounded-2xl bg-lagoon text-[15px] font-bold text-white"
          >
            Lo confirmo
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
// card en desktop. El motivo se audita en moderation_events (flagReport).
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
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            className="-ml-1 p-1 text-ink sm:hidden"
          >
            <ChevronLeft className="size-6" />
          </button>
          <span className="flex-1 text-[17px] font-bold text-ink sm:text-[18px]">
            Reportar aviso
          </span>
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

// Acción del footer SOSAFE: ícono + label, con badge de conteo opcional. `active`
// = la acción ya ejecutada (Confirmado) → color de marca.
function FooterAction({
  icon,
  label,
  count,
  active,
  disabled,
  onClick,
}: {
  icon: ReactNode
  label: string
  count?: number
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 ${
        active ? 'text-lagoon' : 'text-sea-ink-soft'
      }`}
    >
      <span className="relative">
        {icon}
        {count != null && count > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] rounded-full bg-lagoon px-1 text-center text-[10px] leading-[16px] font-bold text-white tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="text-[11px] font-semibold leading-none">{label}</span>
    </button>
  )
}

// Comentarios de la comunidad: lista + composer. Auto-publican; cada uno se puede
// reportar (su "⋯" → flagComment, oculto a los 5 flags server-side). El nombre es
// libre/opcional; React escapa el texto al render (no es HTML).
function CommentsSection({
  reportId,
  onCount,
}: {
  reportId: string
  onCount: (n: number) => void
}) {
  const [list, setList] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchComments({ data: { reportId } })
      .then((rows) => {
        if (!alive) return
        setList(rows)
        setFlagged(cflags())
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [reportId])

  // Reporta el conteo al footer tras el commit (no durante el render del padre).
  useEffect(() => {
    onCount(list.length)
  }, [list.length, onCount])

  const submit = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    setErr(null)
    try {
      const res = await addComment({
        data: { reportId, text: t, authorName: name.trim() || undefined },
      })
      if (res.ok) {
        setList((l) => [res.comment, ...l])
        setText('')
      } else {
        setErr(
          res.reason === 'rate'
            ? 'Espera unos segundos antes de comentar de nuevo.'
            : res.reason === 'missing'
              ? 'Este reporte ya no está disponible.'
              : 'Escribe un comentario.',
        )
      }
    } catch {
      setErr('No se pudo enviar. Revisa tu conexión.')
    } finally {
      setSending(false)
    }
  }

  const flag = (id: string) => {
    if (flagged[id]) return
    setFlagged((f) => ({ ...f, [id]: true }))
    addCflag(id)
    flagComment({ data: { id } }).catch(() => {})
  }

  return (
    <section>
      <h2 className="mb-3 text-[15px] font-bold text-ink">
        Comentarios{list.length ? ` · ${list.length}` : ''}
      </h2>

      <div className="rounded-2xl border border-line p-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Tu nombre (opcional)"
          className="mb-2 w-full bg-transparent px-1.5 text-[13px] text-ink outline-none placeholder:text-ink-faint"
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
            disabled={!text.trim() || sending}
            aria-label="Enviar comentario"
            className="grid size-[40px] flex-none place-items-center rounded-full bg-lagoon text-white disabled:bg-lagoon-disabled"
          >
            <Send className="size-[18px]" />
          </button>
        </div>
        {err && <p className="mt-2 px-1 text-[12px] text-danger">{err}</p>}
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
