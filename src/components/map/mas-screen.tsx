import { useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Heart,
  Info,
  Lightbulb,
  Phone,
  Share2,
} from 'lucide-react'
import { SuggestionDialog } from './suggestion-dialog'
import { HelpUsCard } from './help-us-card'

// "Más" (POC H): menú que re-aloja Cómo ayudar, Emergencias, Acerca de y Compartir.
// Es una tab (panel sobre el mapa, sin back). Reusa los diálogos existentes
// (Help/About) vía handlers. "Enviar una sugerencia" es el único buzón: avisos,
// contactos, datos o errores entran por ahí (antes había 3 formularios separados).
export function MasScreen({
  onComoAyudar,
  onHelp,
  onAbout,
}: {
  onComoAyudar: () => void
  onHelp: () => void
  onAbout: () => void
}) {
  const [suggestOpen, setSuggestOpen] = useState(false)
  const shareApp = async () => {
    const url = location.origin
    try {
      if (navigator.share) await navigator.share({ title: 'Ayuda Venezuela', url })
      else await navigator.clipboard.writeText(url)
    } catch {
      /* compartir cancelado o sin soporte: nada que hacer */
    }
  }

  return (
    <div className="fixed inset-0 z-[820] flex flex-col bg-surface-muted">
      <header
        className="flex-none border-b border-line bg-white"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <h1 className="px-4 pb-3 text-[20px] font-extrabold text-ink">Más</h1>
      </header>

      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        <Group title="Ayudar" />
        <Row
          icon={<Heart className="size-5" />}
          title="Cómo ayudar"
          sub="Donaciones y centros de acopio"
          onClick={onComoAyudar}
        />
        <Row
          icon={<Phone className="size-5" />}
          title="Emergencias"
          sub="911 · Bomberos · Protección Civil"
          danger
          onClick={onHelp}
        />

        <Group title="La app" />
        <Row
          icon={<Info className="size-5" />}
          title="Acerca de Ayuda Venezuela"
          sub="Quiénes somos, fuentes y metodología"
          onClick={onAbout}
        />
        <Row
          icon={<Lightbulb className="size-5" />}
          title="Enviar una sugerencia"
          sub="Un aviso, un contacto, un dato, un error…"
          onClick={() => setSuggestOpen(true)}
        />
        <Row
          icon={<Share2 className="size-5" />}
          title="Compartir la app"
          onClick={shareApp}
        />

        <div className="px-4 pt-5">
          <HelpUsCard />
        </div>
      </div>

      <SuggestionDialog open={suggestOpen} onClose={() => setSuggestOpen(false)} />
    </div>
  )
}

function Group({ title }: { title: string }) {
  return (
    <p className="px-[18px] pt-[18px] pb-2 text-[12px] font-extrabold tracking-[0.05em] text-ink-faint uppercase">
      {title}
    </p>
  )
}

function Row({
  icon,
  title,
  sub,
  danger,
  onClick,
}: {
  icon: ReactNode
  title: string
  sub?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 border-b border-line bg-white px-[18px] py-[15px] text-left"
    >
      <span
        className={`grid size-[38px] flex-none place-items-center rounded-xl ${
          danger ? 'bg-[#fdeced] text-[#c2410c]' : 'bg-surface-muted text-lagoon-ink'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold text-ink">{title}</span>
        {sub && <span className="block text-[12.5px] text-ink-muted">{sub}</span>}
      </span>
      <ChevronRight className="size-[18px] flex-none text-ink-faint" />
    </button>
  )
}
