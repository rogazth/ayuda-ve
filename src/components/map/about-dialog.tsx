import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { ExternalLink, Github, Heart, Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ponytail: correo y repo del proyecto. Cambia CONTACT_EMAIL por el alias real
// una vez configures Cloudflare Email Routing (reenvía a tu Gmail sin exponerlo)
// o un Gmail dedicado. NO uses el personal.
export const CONTACT_EMAIL = 'contacto@ayudave.com'
const REPO_URL = 'https://github.com/rogazth/ayuda-ve'

// Fuentes públicas de donde recopilamos datos (las mismas que alimentan los
// scrapers + los feeds de sismos). Una sola lista → se muestra como links
// comprobables; nada de prosa larga. [[ui-redesign-poc]]
const SOURCES: Array<{ name: string; what: string; url: string }> = [
  {
    name: 'Desaparecidos Terremoto Venezuela',
    what: 'Personas desaparecidas',
    url: 'https://desaparecidosterremotovenezuela.com',
  },
  {
    name: 'HuellaScan',
    what: 'Mascotas perdidas',
    url: 'https://www.huellascan.com/terremoto',
  },
  {
    name: 'terremotovenezuela.com',
    what: 'Estructuras dañadas',
    url: 'https://terremotovenezuela.com',
  },
  {
    name: 'USGS',
    what: 'Sismos · servicio geológico de EE. UU.',
    url: 'https://earthquake.usgs.gov',
  },
  {
    name: 'FUNVISIS',
    what: 'Sismos · en hora de Venezuela',
    url: 'http://www.funvisis.gob.ve',
  },
]

// "Acerca de": qué es el proyecto, su filosofía, y de dónde sale cada dato — con
// los enlaces de origen a la vista (recopilamos datos públicos; nunca decimos que
// los inventamos). Las sugerencias salieron a su propio buzón en "Más"
// (SuggestionDialog). Mismo <dialog> nativo que EmergenciasDialog (backdrop/Esc/foco gratis).
export function AboutDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="m-0 h-dvh max-h-dvh w-full max-w-full border-0 bg-transparent p-0 text-ink backdrop:bg-[rgba(20,32,28,0.45)] open:animate-dialog-slide motion-reduce:open:animate-none"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // click en el backdrop
      }}
    >
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <header className="flex items-center gap-[12px] border-b border-line px-[18px] pt-[18px] pb-[14px]">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 flex items-center gap-[8px] text-[19px] font-extrabold">
              <Heart className="h-[20px] w-[20px] text-lagoon" /> Acerca de Ayuda
              Venezuela
            </h2>
            <p className="mt-[3px] text-[13px] text-ink-muted">
              Proyecto comunitario y de código abierto
            </p>
          </div>
          <Button
            variant="ghost"
            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border-0 bg-surface-muted text-sea-ink-soft hover:bg-line hover:text-sea-ink-soft"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="size-[18px]" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-[18px] pt-[16px] pb-[24px]">
          {/* Qué es */}
          <Section title="Qué es esto">
            Un mapa para encontrarse y ayudarse en una emergencia: personas
            desaparecidas, daños, vías bloqueadas, quién necesita y quién ofrece
            ayuda. Gratis, sin cuentas y sin publicidad. Lo hizo gente que quería
            ayudar, no una empresa.
          </Section>

          {/* Filosofía */}
          <Section title="No inventamos datos">
            Cada cosa que ves tiene una fuente comprobable o está marcada como{' '}
            <b>reporte de la comunidad</b>. Nunca disfrazamos un rumor de dato
            oficial.
          </Section>

          {/* Fuentes con links */}
          <p className="mt-[24px] mb-[8px] text-[11.5px] font-extrabold tracking-[0.6px] text-ink-muted uppercase">
            Fuentes
          </p>
          <p className="mb-[12px] text-[13.5px] leading-[1.6] text-ink-body">
            Parte la publica la comunidad desde la app. El resto lo recopilamos de
            sitios públicos y guardamos el enlace de origen para que puedas
            comprobarlo:
          </p>
          <div className="flex flex-col gap-[8px]">
            {SOURCES.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center gap-[12px] rounded-[14px] border border-line p-[12px] text-inherit no-underline hover:border-lagoon"
              >
                <span className="min-w-0 flex-1">
                  <b className="block text-[14.5px] font-semibold">{s.name}</b>
                  <span className="block text-[12.5px] text-ink-muted">
                    {s.what}
                  </span>
                </span>
                <ExternalLink className="size-[16px] flex-none text-lagoon" />
              </a>
            ))}
          </div>

          {/* Verificado vs comunidad */}
          <Section title="Verificado vs. comunidad">
            Un reporte es <b>verificado</b> cuando lo publicamos desde una fuente
            confiable o cuando varias personas lo confirman; el resto vive como
            reporte de la comunidad. Si algo es falso o peligroso, cualquiera puede
            reportarlo y, al juntar varios reportes, se oculta del mapa.
          </Section>

          {/* Código abierto */}
          <Section title="Código abierto">
            Software libre bajo licencia <b>MIT</b>: puedes usarlo, copiarlo y
            adaptarlo. ¿Una idea o un arreglo? Abre un issue o un pull request.
          </Section>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-[8px] flex items-center gap-[12px] rounded-[14px] border border-line p-[14px] text-inherit no-underline hover:border-lagoon"
          >
            <span className="grid h-[40px] w-[40px] flex-none place-items-center rounded-[10px] bg-ink text-white">
              <Github className="size-[20px]" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">
                Ver el repositorio
              </b>
              <span className="block truncate text-[13px] text-ink-muted">
                github.com/rogazth/ayuda-ve
              </span>
            </span>
            <ExternalLink className="size-[18px] flex-none text-lagoon" />
          </a>

          {/* Créditos */}
          <Section title="Créditos">
            Hecho por <b>Gabriel Rodriguez</b>.
          </Section>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-[4px] inline-flex items-center gap-[8px] text-[14px] font-semibold text-lagoon-ink no-underline"
          >
            <Mail className="size-[16px]" /> {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </dialog>
  )
}

// Bloque de "Acerca de": título en versalitas + párrafo. Una sola forma para todas
// las secciones (consistencia).
function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <>
      <p className="mt-[24px] mb-[8px] text-[11.5px] font-extrabold tracking-[0.6px] text-ink-muted uppercase first:mt-0">
        {title}
      </p>
      <p className="text-[13.5px] leading-[1.6] text-ink-body">{children}</p>
    </>
  )
}
