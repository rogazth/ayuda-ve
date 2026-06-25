import { useEffect, useRef, useState } from 'react'
import { Phone, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EMERGENCY } from '../../reports/reports'
import type { SourceRef } from '../../quakes/quakes'
import { Sources } from './sources'

const HELP_SOURCES: SourceRef[] = [
  {
    key: 'ven911',
    cite: 'Sistema Integrado de Emergencias 1-1-1 (VEN911). Números de emergencia nacionales.',
    url: 'https://www.ven911.gob.ve/',
  },
  {
    key: 'osm',
    cite: 'OpenStreetMap contributors. Cartografía base © OpenStreetMap.',
    url: 'https://www.openstreetmap.org/copyright',
  },
]

// Estados de Venezuela (selector del directorio de contactos por zona).
const VE_ESTADOS = [
  'Amazonas',
  'Anzoátegui',
  'Apure',
  'Aragua',
  'Barinas',
  'Bolívar',
  'Carabobo',
  'Cojedes',
  'Delta Amacuro',
  'Distrito Capital',
  'Falcón',
  'Guárico',
  'La Guaira',
  'Lara',
  'Mérida',
  'Miranda',
  'Monagas',
  'Nueva Esparta',
  'Portuguesa',
  'Sucre',
  'Táchira',
  'Trujillo',
  'Yaracuy',
  'Zulia',
]

// Normaliza el estado que devuelve Nominatim al nombre de la lista (quita el
// prefijo "Estado", mapea el alias Vargas→La Guaira). null si no calza.
function matchEstado(raw: string): string | null {
  const n = raw.replace(/^estado\s+/i, '').trim()
  const target = /^vargas$/i.test(n) ? 'La Guaira' : n
  return (
    VE_ESTADOS.find((e) => e.toLowerCase() === target.toLowerCase()) ?? null
  )
}

// Ayuda = dialog de contactos (no un "modo"). Números nacionales + directorio
// por estado (preseleccionado por GPS). UI-only: la zona aún no tiene datos.
export function HelpDialog({
  open,
  onClose,
  userEstado,
}: {
  open: boolean
  onClose: () => void
  userEstado: string | null
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const matched = userEstado ? matchEstado(userEstado) : null
  const [estado, setEstado] = useState('Yaracuy')

  // <dialog> nativo: backdrop, Esc y trampa de foco gratis. Sincronizamos su
  // estado abierto con la prop.
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  // Cuando el GPS resuelve el estado del usuario, lo dejamos preseleccionado.
  useEffect(() => {
    if (matched) setEstado(matched)
  }, [matched])

  return (
    <dialog
      ref={ref}
      className="m-auto mb-0 h-[92%] max-h-[92%] w-full max-w-[560px] border-0 bg-transparent p-0 text-[#173a40] backdrop:bg-[rgba(20,32,28,0.45)] open:animate-dialog-slide motion-reduce:open:animate-none"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // click en el backdrop
      }}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-t-[20px] bg-white">
        <header className="flex items-center gap-[12px] border-b border-[#ededeb] px-[18px] pt-[18px] pb-[14px]">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 flex items-center gap-[8px] text-[19px] font-extrabold">
              <Phone className="h-[20px] w-[20px] text-[#0e9c8f]" /> Ayuda
            </h2>
            <p className="mt-[3px] text-[13px] text-[#737f82]">
              Contactos de emergencia y de tu zona
            </p>
          </div>
          <Button
            variant="ghost"
            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border-0 bg-[#f1f4f2] text-[#416166] hover:bg-[#e7ebe9] hover:text-[#416166]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="size-[18px]" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-[18px] pt-[16px] pb-[24px]">
          <p className="mb-[8px] text-[11.5px] font-extrabold tracking-[0.6px] text-[#737f82] uppercase">
            Nacional
          </p>
          {EMERGENCY.map((e) => (
            <a
              key={e.name}
              className="flex items-center gap-[12px] border-t border-[#ededeb] py-[13px] text-inherit no-underline first-of-type:border-t-0"
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
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%23737f82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 8 5 5 5-5'/%3E%3C/svg%3E\")",
                backgroundPosition: 'right 14px center',
              }}
            >
              {VE_ESTADOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <div className="px-[16px] py-[26px] text-center">
            <span className="mx-auto mb-[12px] grid h-[46px] w-[46px] place-items-center rounded-full bg-[rgba(14,156,143,0.1)] text-[#0e9c8f]">
              <Plus className="h-[23px] w-[23px]" />
            </span>
            <b className="block text-[15px] font-bold text-[#173a40]">
              Aún no hay contactos verificados aquí
            </b>
            <p className="mx-auto mt-[6px] max-w-[280px] text-[13px] leading-[1.55] text-[#737f82]">
              Refugios, salud, agua, electricidad. ¿Conoces uno en {estado}?
              Sugiérelo.
            </p>
          </div>

          {/* TODO(sugerir): formulario de contacto. */}
          <Button
            variant="ghost"
            className="mt-[8px] flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[14px] border-0 bg-[rgba(14,156,143,0.1)] text-[15.5px] font-bold text-[#0e9c8f] hover:bg-[rgba(14,156,143,0.16)] hover:text-[#0e9c8f]"
            type="button"
          >
            <Plus className="size-[19px]" /> Sugerir un contacto
          </Button>

          <Sources
            refs={HELP_SOURCES}
            note="Números de emergencia de fuentes oficiales."
          />
        </div>
      </div>
    </dialog>
  )
}
