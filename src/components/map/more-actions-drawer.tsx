import { Flag, MessageCircle, Navigation, Phone } from 'lucide-react'
import { mapsDir } from '../../reports/reports'

// Acciones secundarias del detalle (el "⋯" del footer SOSAFE): Cómo llegar,
// Llamar, WhatsApp y Reportar. Bottom-sheet como ShareSheet — saca estos CTA del
// cuerpo del reporte para dejar el footer con 4 acciones limpias.
export function MoreActionsDrawer({
  lat,
  lng,
  dirLabel,
  intl,
  showContact,
  flagged,
  onFlag,
  onClose,
}: {
  lat: number
  lng: number
  dirLabel: string
  intl: string | null
  showContact: boolean
  flagged: boolean
  onFlag: () => void
  onClose: () => void
}) {
  const row =
    'flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold'
  return (
    <div
      className="fixed inset-0 z-[960] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl bg-white p-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl sm:pb-3"
      >
        <a
          href={mapsDir(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className={`${row} text-sea-ink`}
        >
          <Navigation className="size-5 flex-none text-lagoon-ink" />
          {dirLabel}
        </a>

        {showContact && intl && (
          <>
            <a
              href={`tel:+${intl}`}
              onClick={onClose}
              className={`${row} text-sea-ink`}
            >
              <Phone className="size-5 flex-none text-lagoon-ink" />
              Llamar
            </a>
            <a
              href={`https://wa.me/${intl}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={`${row} text-sea-ink`}
            >
              <MessageCircle className="size-5 flex-none text-success" />
              WhatsApp
            </a>
          </>
        )}

        <button
          type="button"
          disabled={flagged}
          onClick={() => {
            onClose()
            onFlag()
          }}
          className={`${row} text-danger disabled:opacity-60`}
        >
          <Flag className="size-5 flex-none" />
          {flagged ? 'Reporte enviado' : 'Reportar contenido'}
        </button>
      </div>
    </div>
  )
}
