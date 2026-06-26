import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Instagram, Phone, Plus, Stethoscope, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EMERGENCY, REGIONAL, FEATURED_ALERTS } from '../../reports/reports'
import type { ContactSource } from '../../reports/reports'
import { hostOf } from './sources'
import { SuggestionDialog } from './suggestion-dialog'

const SELECT_STYLE = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%23737f82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 8 5 5 5-5'/%3E%3C/svg%3E\")",
  backgroundPosition: 'right 14px center',
}

const VE_ESTADOS = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar',
  'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón',
  'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas',
  'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
]

// Procedencia de un contacto, alineada bajo su nombre. El dato suelto no basta:
// en emergencia hay que poder comprobar de dónde sale (oficial, RRSS, tweet…).
function SourceTag({ source }: { source: ContactSource }) {
  const label = source.label || (source.url ? hostOf(source.url) : '')
  return (
    <p className="mt-[5px] pl-[48px] text-[11.5px] leading-[1.5] text-[#9aa4a6]">
      <span className="font-semibold text-[#737f82]">Fuente: </span>
      {label}
      {source.url && (
        <>
          {'. '}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[3px] font-semibold text-[#0e9c8f] no-underline"
          >
            Ir al sitio <ExternalLink className="h-[11px] w-[11px]" />
          </a>
        </>
      )}
    </p>
  )
}

// Normaliza el estado que devuelve Nominatim al nombre de la lista (quita el
// prefijo "Estado", mapea el alias Vargas→La Guaira). null si no calza.
function matchEstado(raw: string): string | null {
  const n = raw.replace(/^estado\s+/i, '').trim()
  const target = /^vargas$/i.test(n) ? 'La Guaira' : n
  return (
    VE_ESTADOS.find((e) => e.toLowerCase() === target.toLowerCase()) ?? null
  )
}

// Emergencias = dialog de contactos (no un "modo"). Números nacionales +
// directorio por estado (preseleccionado por GPS). UI-only: la zona aún no tiene
// datos, por eso el CTA pide ayuda para completarlos.
export function EmergenciasDialog({
  open,
  onClose,
  userEstado,
}: {
  open: boolean
  onClose: () => void
  userEstado: string | null
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const matched = userEstado ? matchEstado(userEstado) : null
  const [estado, setEstado] = useState('Yaracuy')
  const [suggestOpen, setSuggestOpen] = useState(false)

  // <dialog> nativo: backdrop, Esc y trampa de foco gratis. Sincronizamos su
  // estado abierto con la prop.
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }
    else if (!open && d.open) d.close()
  }, [open])

  // Cuando el GPS resuelve el estado del usuario, lo dejamos preseleccionado.
  useEffect(() => {
    if (matched) setEstado(matched)
  }, [matched])

  return (
    <>
      <dialog
        ref={ref}
        className="m-0 h-dvh max-h-dvh w-full max-w-full border-0 bg-transparent p-0 text-[#173a40] backdrop:bg-[rgba(20,32,28,0.45)] open:animate-dialog-slide motion-reduce:open:animate-none"
        onClose={onClose}
        onClick={(e) => {
          if (e.target === ref.current) onClose() // click en el backdrop
        }}
      >
        <div className="flex h-full flex-col overflow-hidden bg-white">
          <header className="flex items-center gap-[12px] border-b border-line px-[18px] pt-[18px] pb-[14px]">
            <div className="min-w-0 flex-1">
              <h2 className="m-0 flex items-center gap-[8px] text-[19px] font-extrabold">
                <Phone className="h-[20px] w-[20px] text-lagoon" /> Emergencias
              </h2>
              <p className="mt-[3px] text-[13px] text-ink-muted">
                Contactos de emergencia y de tu zona
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

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-[18px] pt-[16px] pb-[24px]">
            {/* CTA: pedimos ayuda — faltan contactos de muchas zonas y la gente
                los conoce. Abre el buzón de sugerencias (mismo de "Más"). */}
            <button
              type="button"
              onClick={() => setSuggestOpen(true)}
              className="mb-[16px] flex w-full items-center gap-[11px] rounded-[14px] border border-line bg-lagoon-wash px-[14px] py-[12px] text-left"
            >
              <span className="grid size-[34px] flex-none place-items-center rounded-full bg-lagoon text-white">
                <Plus className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[14px] font-bold text-[#173a40]">
                  Ayúdanos a completar esta guía
                </b>
                <span className="block text-[12.5px] text-[#737f82]">
                  Faltan contactos de muchas zonas. ¿Conoces uno? Compártelo
                </span>
              </span>
            </button>
            {FEATURED_ALERTS.length > 0 && (
              <div className="mb-[16px] flex flex-col gap-[8px]">
                {FEATURED_ALERTS.map((a) => (
                  <div
                    key={a.phone}
                    className="overflow-hidden rounded-[14px] border border-[#fbbf24] bg-[#fffbeb]"
                  >
                    <div className="flex items-start gap-[10px] px-[14px] pt-[12px] pb-[10px]">
                      <span className="mt-[1px] flex-none text-[#f59e0b]">
                        <Stethoscope className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-[6px] text-[12px] font-extrabold tracking-[0.5px] text-[#92400e] uppercase">
                          <span className="h-[6px] w-[6px] flex-none animate-pulse rounded-full bg-[#f59e0b]" />
                          {a.org}
                        </p>
                        <p className="mt-[2px] text-[13px] leading-[1.45] text-[#78350f]">
                          {a.headline}
                        </p>
                      </div>
                    </div>
                    <div className="flex border-t border-[#fde68a]">
                      <a
                        href={`tel:${a.phone}`}
                        className="flex flex-1 items-center justify-center gap-[6px] py-[10px] text-[14px] font-extrabold text-[#b45309] no-underline active:bg-[#fef3c7]"
                      >
                        <Phone className="size-[15px]" /> {a.phone}
                      </a>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-[5px] border-l border-[#fde68a] px-[14px] py-[10px] text-[13px] font-semibold text-[#b45309] no-underline active:bg-[#fef3c7]"
                      >
                        <Instagram className="size-[13px]" /> Ver en Instagram
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mb-[8px] text-[11.5px] font-extrabold tracking-[0.6px] text-[#737f82] uppercase">
              Nacional
            </p>
            {EMERGENCY.map((e) => (
              <div
                key={e.name}
                className="border-t border-[#ededeb] py-[11px] first-of-type:border-t-0"
              >
                <a
                  className="flex items-center gap-[12px] text-inherit no-underline"
                  href={`tel:${e.phone}`}
                >
                  <span
                    className="grid h-[36px] w-[36px] flex-none place-items-center rounded-[10px] text-white"
                    style={{ background: '#0e9c8f' }}
                  >
                    <Phone className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] font-semibold">{e.name}</b>
                    {e.note && (
                      <span className="text-[13px] text-[#737f82]">{e.note}</span>
                    )}
                  </span>
                  <span className="ml-auto text-[17px] font-extrabold text-[#0e9c8f]">
                    {e.phone}
                  </span>
                </a>
                <SourceTag source={e.source} />
              </div>
            ))}

            <p className="mt-[20px] mb-[8px] text-[11.5px] font-extrabold tracking-[0.6px] text-[#737f82] uppercase">
              Contactos por zona
            </p>
            <label className="mb-[14px] flex items-center gap-[10px]">
              <span className="flex-none text-[14px] font-semibold text-[#173a40]">
                Estado:
              </span>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="h-[48px] min-w-0 flex-1 appearance-none rounded-[12px] border border-[#ededeb] bg-white bg-no-repeat py-0 pr-[40px] pl-[14px] text-[15px] font-semibold text-[#173a40]"
                style={SELECT_STYLE}
              >
                {VE_ESTADOS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>

            {REGIONAL[estado] ? (
              REGIONAL[estado].map((c) => (
                <div
                  key={c.phone}
                  className="border-t border-[#ededeb] py-[11px] first-of-type:border-t-0"
                >
                  <a
                    className="flex items-center gap-[12px] text-inherit no-underline"
                    href={`tel:${c.phone}`}
                  >
                    <span
                      className="grid h-[36px] w-[36px] flex-none place-items-center rounded-[10px] text-white"
                      style={{ background: '#0e9c8f' }}
                    >
                      <Phone className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[15px] font-semibold">{c.name}</b>
                      {c.note && (
                        <span className="text-[13px] text-[#737f82]">{c.note}</span>
                      )}
                    </span>
                    <span className="ml-auto text-[17px] font-extrabold text-[#0e9c8f]">
                      {c.phone}
                    </span>
                  </a>
                  <SourceTag source={c.source} />
                </div>
              ))
            ) : (
              <div className="px-[16px] py-[26px] text-center">
                <span className="mx-auto mb-[12px] grid h-[46px] w-[46px] place-items-center rounded-full bg-[rgba(14,156,143,0.1)] text-[#0e9c8f]">
                  <Plus className="h-[23px] w-[23px]" />
                </span>
                <b className="block text-[15px] font-bold text-[#173a40]">
                  Aún no hay contactos verificados aquí
                </b>
                <p className="mx-auto mt-[6px] max-w-[300px] text-[13px] leading-[1.55] text-[#737f82]">
                  Refugios, salud, agua, electricidad. ¿Conoces uno en {estado}?
                  Cuéntanoslo con su fuente desde <b>Más → Enviar una sugerencia</b>.
                </p>
              </div>
            )}
          </div>
        </div>
      </dialog>

      <SuggestionDialog
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
      />
    </>
  )
}
