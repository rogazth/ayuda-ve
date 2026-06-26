import { Globe, Heart } from 'lucide-react'

// Dialog del exterior (POC F): NO fullscreen, sobre el mapa, cuando el país ≠ VE.
// No bloquea — todos caen al mapa. Descartable por sesión ("Seguir al mapa") o
// permanente ("No volver a mostrar", localStorage). Reabrible desde "Más".
export function ExteriorDialog({
  onHelp,
  onDismiss,
  onClose,
}: {
  onHelp: () => void // Ver cómo ayudar
  onDismiss: () => void // No volver a mostrar (persiste)
  onClose: () => void // Seguir al mapa (solo esta sesión)
}) {
  return (
    <div
      className="fixed inset-0 z-[880] flex items-center justify-center bg-[rgba(20,30,33,0.5)] p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-[22px] bg-white shadow-[0_24px_60px_rgba(10,20,22,0.4)] animate-dialog-slide motion-reduce:animate-none"
      >
        <div className="flex h-[120px] items-center justify-center bg-gradient-to-br from-lagoon to-lagoon-ink text-white">
          <Globe className="size-14" strokeWidth={1.7} />
        </div>
        <div className="px-5 pt-5 pb-5 text-center">
          <h2 className="text-[20px] font-extrabold text-ink">
            ¿Estás fuera de Venezuela?
          </h2>
          <p className="mx-auto mt-1.5 max-w-[280px] text-[14.5px] leading-relaxed text-ink-muted">
            Detectamos que nos visitas desde el exterior. Hay muchas formas de
            ayudar desde donde estás.
          </p>
          <button
            type="button"
            onClick={onHelp}
            className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-lagoon text-[16px] font-bold text-white"
          >
            <Heart className="size-5" /> Ver cómo ayudar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-1.5 h-[42px] w-full text-[14px] font-semibold text-ink-muted"
          >
            Seguir al mapa →
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-1 text-[12px] text-ink-faint"
          >
            No volver a mostrar
          </button>
        </div>
      </div>
    </div>
  )
}
