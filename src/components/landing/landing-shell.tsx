import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { TelegramCta } from '../telegram-cta'

// Chrome común de las landings SSR indexables (personas-desaparecidas,
// numeros-emergencia). Página de contenido liviana — no monta el mapa. Lleva
// links internos a las otras landings/mapa (SEO) y el CTA de Telegram al pie.
export function LandingShell({
  title,
  intro,
  updated,
  children,
}: {
  title: string
  intro?: string
  updated?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            aria-label="Volver al mapa"
            className="grid size-9 flex-none place-items-center rounded-full border border-line bg-white text-ink no-underline"
          >
            <ArrowLeft className="size-[18px]" />
          </Link>
          <span className="font-extrabold text-ink">AyudaVE</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-[24px] font-extrabold text-ink">{title}</h1>
        {intro && (
          <p className="mt-2 text-[15px] leading-[1.55] text-ink-muted">{intro}</p>
        )}
        {updated && (
          <p className="mt-1.5 text-[12.5px] text-ink-faint">Actualizado: {updated}</p>
        )}

        <div className="mt-5">{children}</div>

        <div className="mt-8">
          <TelegramCta />
        </div>

        <nav className="mt-7 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-5 text-[13.5px] font-semibold text-lagoon-ink">
          <Link to="/" className="no-underline">
            Mapa de reportes
          </Link>
          <Link to="/personas-desaparecidas" className="no-underline">
            Personas desaparecidas
          </Link>
          <Link to="/numeros-emergencia-venezuela" className="no-underline">
            Números de emergencia
          </Link>
        </nav>
      </main>
    </div>
  )
}
