import { useEffect, useState } from 'react'
import {
  Check,
  ChevronLeft,
  Flag,
  Link2,
  MessageCircle,
  Navigation,
  Phone,
  Send,
  Share2,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  canContact,
  fmtAge,
  fmtDist,
  haversine,
  mapsDir,
  metaFields,
  phoneIntl,
  typeOf,
} from '../../reports/reports'
import { confirmReport, flagReport } from '../../reports/reports.functions'
import type { ReportDetail } from '../../reports/reports.functions'

// Un voto (confirmar/flag) por reporte por dispositivo. ponytail: guard
// client-side sin auth — suficiente para MVP; subir a rate-limit por IP si hay
// manipulación. 'c' = confirmado, 'f' = reportado.
type Vote = { c?: boolean; f?: boolean }
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
  if (photos.length < 2)
    return (
      <img
        src={photos[0]}
        alt=""
        className="aspect-[4/3] w-full bg-[#f3f4f6] object-cover"
      />
    )
  return (
    <div className="relative">
      <div
        onScroll={(e) => {
          const el = e.currentTarget
          setActive(Math.round(el.scrollLeft / el.clientWidth))
        }}
        className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="h-full w-full flex-shrink-0 snap-center bg-[#f3f4f6] object-cover"
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
  const [bump, setBump] = useState(0) // confirmaciones extra optimistas
  const [shareOpen, setShareOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)

  // Al cargar/cambiar de reporte, lee el estado de voto persistido.
  useEffect(() => {
    if (!report) return
    const v = votes()[report.id] as Vote | undefined
    setConfirmed(!!v?.c)
    setFlagged(!!v?.f)
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

  const label = report ? typeOf(report.type).label : 'Reporte'

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-white">
      {/* Header — mismo chrome que el wizard */}
      <div
        className="flex items-center gap-3 border-b border-[#f3f4f6] px-4"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <span className="flex-1 truncate text-[17px] font-bold text-[#1a1c1e]">
          {label}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-[#f1f4f2] text-[#416166]"
        >
          <X className="size-[18px]" />
        </button>
      </div>

      {!report ? (
        <div className="grid flex-1 place-items-center">
          <p className="text-[14px] text-[#737f82]">Cargando reporte…</p>
        </div>
      ) : (
        <Body
          report={report}
          user={user}
          confirmed={confirmed}
          flagged={flagged}
          confirms={report.confirms + bump}
          onConfirm={() => setConfirmOpen(true)}
          onFlag={() => setFlagOpen(true)}
          onShare={() => setShareOpen(true)}
        />
      )}

      {shareOpen && report && (
        <ShareSheet report={report} onClose={() => setShareOpen(false)} />
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
    </div>
  )
}

function Body({
  report,
  user,
  confirmed,
  flagged,
  confirms,
  onConfirm,
  onFlag,
  onShare,
}: {
  report: ReportDetail
  user: [number, number] | null
  confirmed: boolean
  flagged: boolean
  confirms: number
  onConfirm: () => void
  onFlag: () => void
  onShare: () => void
}) {
  const { type, meta } = report
  const t = typeOf(type)
  const photos = report.media.map((m) => m.url)
  const fields = metaFields(type, meta)
  const dist = user
    ? fmtDist(haversine(user[0], user[1], report.lat, report.lng))
    : null
  const headline =
    type === 'missing' && meta.missingName
      ? String(meta.missingName)
      : t.label
  const intl = phoneIntl(report.contact)
  const showContact = canContact(type, report.contact)

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
            <p className="mt-0.5 text-[13px] text-[#6b7280]">
              {fmtAge(report.createdAt)}
              {dist ? ` · ${dist}` : ''}
            </p>
          </div>
        </div>

        {/* Meta por tipo */}
        {fields.length > 0 && (
          <div className="mt-5 space-y-3 px-5">
            {fields.map((f) =>
              f.chips ? (
                <div key={f.label}>
                  <p className="mb-1.5 text-[13px] font-semibold text-[#6b7280]">
                    {f.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {f.chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-[#f3f4f6] px-3 py-1.5 text-[13px] text-[#1a1c1e]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  key={f.label}
                  className="flex justify-between gap-4 border-b border-[#f3f4f6] pb-2.5"
                >
                  <span className="text-[14px] text-[#6b7280]">{f.label}</span>
                  <span className="text-right text-[14px] font-semibold text-[#1a1c1e]">
                    {f.text}
                  </span>
                </div>
              ),
            )}
          </div>
        )}

        {report.description.trim() && (
          <p className="mt-5 px-5 text-[15px] leading-relaxed whitespace-pre-wrap text-[#374151]">
            {report.description}
          </p>
        )}

        {/* Nota de confianza: el contenido es de la comunidad, sin verificar */}
        <div className="mt-6 px-5">
          <div className="flex items-start gap-2.5 rounded-2xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3">
            <TriangleAlert className="mt-0.5 size-5 flex-shrink-0 text-[#ea580c]" />
            <p className="text-[13px] leading-snug text-[#9a3412]">
              Reporte de la comunidad. Confirma con fuentes oficiales antes de
              actuar.
            </p>
          </div>
        </div>

        {/* Confirmaciones */}
        <div className="mt-4 px-5">
          <div className="flex items-center justify-between rounded-2xl bg-[#f0fdf9] px-4 py-3">
            <span className="text-[14px] text-[#173a40]">
              <b className="tabular-nums">{confirms}</b>{' '}
              {confirms === 1 ? 'persona confirma' : 'personas confirman'}
            </span>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmed}
              className="rounded-full bg-[#0e9c8f] px-4 py-2 text-[13px] font-bold text-white disabled:bg-[#9bd4cd]"
            >
              {confirmed ? '✓ Confirmado' : 'Confirmar'}
            </button>
          </div>
        </div>

        {/* Reportar abuso */}
        <div className="mt-4 mb-2 px-5">
          <button
            type="button"
            onClick={onFlag}
            disabled={flagged}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#9ca3af] disabled:opacity-60"
          >
            <Flag className="size-3.5" />
            {flagged ? 'Reporte enviado' : 'Reportar como falso o inapropiado'}
          </button>
        </div>
      </div>

      {/* Footer sticky: acciones por tipo */}
      <div
        className="border-t border-[#f3f4f6] px-5 pt-3"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        {showContact && intl && (
          <div className="mb-3 flex gap-3">
            <a
              href={`tel:+${intl}`}
              className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#e6f5f3] text-[16px] font-bold text-[#0b7d72]"
            >
              <Phone className="size-5" /> Llamar
            </a>
            <a
              href={`https://wa.me/${intl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#e7f6ec] text-[16px] font-bold text-[#15803d]"
            >
              <MessageCircle className="size-5" /> WhatsApp
            </a>
          </div>
        )}
        {/* Compartir = acción principal (difundir un reporte vale más que llegar
            a él, sobre todo en desaparecidos) → filled. "Cómo llegar" baja a secundario. */}
        <button
          type="button"
          onClick={onShare}
          className="mb-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0e9c8f] text-[16px] font-bold text-white"
        >
          <Share2 className="size-5" /> Compartir
        </button>
        <a
          href={mapsDir(report.lat, report.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-[#d4dbdc] text-[16px] font-bold text-[#173a40]"
        >
          <Navigation className="size-5" />
          {type === 'danger' || type === 'missing'
            ? 'Ver ubicación'
            : 'Cómo llegar'}
        </a>
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
    report.type === 'missing' &&
    typeof report.meta.missingName === 'string'
      ? `Ayúdanos a encontrar a ${report.meta.missingName}`
      : typeOf(report.type).label
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)

  // Facebook ignora el texto (solo toma la URL y lee el OG del link).
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
        <h2 className="text-[18px] font-bold text-[#1a1c1e]">
          Compartir reporte
        </h2>
        <p className="mt-1 text-[13px] text-[#6b7280]">
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
              <span className="text-[12px] text-[#374151]">{s.label}</span>
            </a>
          ))}
          <button
            type="button"
            onClick={copy}
            className="flex w-[64px] flex-col items-center gap-1.5"
          >
            <span className="grid size-[52px] place-items-center rounded-full bg-[#f3f4f6]">
              {copied ? (
                <Check className="size-6 text-[#0e9c8f]" />
              ) : (
                <Link2 className="size-6 text-[#374151]" />
              )}
            </span>
            <span className="text-[12px] text-[#374151]">
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
        <h2 className="text-[18px] font-bold text-[#1a1c1e]">
          ¿Confirmar este reporte?
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
          Confirma solo si viste la situación o sabes que es real. Así otros
          saben en qué pueden confiar.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-[48px] flex-1 rounded-2xl border border-[#e5e7eb] text-[15px] font-bold text-[#374151]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-[48px] flex-1 rounded-2xl bg-[#0e9c8f] text-[15px] font-bold text-white"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// Reportar abuso con motivo opcional. Full-screen en mobile (espacio para teclado),
// card en desktop. El motivo se guarda como comentario de moderación.
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
          className="flex items-center gap-3 border-b border-[#f3f4f6] px-4 pb-3 sm:border-0 sm:pt-4 sm:pb-0"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            className="-ml-1 p-1 text-[#1a1c1e] sm:hidden"
          >
            <ChevronLeft className="size-6" />
          </button>
          <span className="flex-1 text-[17px] font-bold text-[#1a1c1e] sm:text-[18px]">
            Reportar aviso
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 sm:flex-none">
          <p className="text-[14px] leading-relaxed text-[#6b7280]">
            Lo marcaremos para revisión. Si quieres, cuéntanos por qué: falso,
            duplicado, información peligrosa…
          </p>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={5}
            placeholder="Motivo (opcional)"
            className="mt-4 w-full resize-none rounded-xl border border-[#e5e7eb] px-4 py-3 text-[15px] text-[#1a1c1e] outline-none focus:border-[#0e9c8f]"
          />
        </div>
        <div
          className="border-t border-[#f3f4f6] px-5 pt-3 sm:border-0 sm:pt-2 sm:pb-4"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => onSubmit(reason)}
            className="h-[52px] w-full rounded-2xl bg-[#d7263d] text-[16px] font-bold text-white"
          >
            Enviar reporte
          </button>
        </div>
      </div>
    </div>
  )
}
