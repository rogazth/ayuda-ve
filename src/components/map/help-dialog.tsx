import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, ExternalLink, Info, Instagram, Phone, Plus, Send, Stethoscope, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EMERGENCY, REGIONAL, FEATURED_ALERTS } from '../../reports/reports'
import type { ContactSource } from '../../reports/reports'
import { hostOf } from './sources'
import { suggestContact } from '../../contacts/contacts.functions'
import { CONTACT_CATEGORIES, CATEGORY_LABELS } from '../../contacts/contacts'

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

function SuggestContactDialog({
  open,
  onClose,
  onCloseAll,
  estado: initialEstado,
}: {
  open: boolean
  onClose: () => void
  onCloseAll: () => void
  estado: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [estado, setEstado] = useState(initialEstado)
  const [form, setForm] = useState({ category: 'bomberos', name: '', phone: '', sourceUrl: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) { d.showModal(); setStatus('idle'); setEstado(initialEstado) }
    else if (!open && d.open) d.close()
  }, [open])

  const btnClass = 'grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-[#f1f4f2] text-[#416166]'
  const labelClass = 'mb-[6px] block text-[13px] font-semibold text-[#173a40]'

  return (
    <dialog
      ref={ref}
      className="m-0 h-dvh max-h-dvh w-full max-w-full border-0 bg-transparent p-0 text-[#173a40] backdrop:bg-[rgba(20,32,28,0.45)] open:animate-dialog-slide motion-reduce:open:animate-none"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
    >
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <header className="flex items-center gap-[12px] border-b border-[#ededeb] px-[18px] pt-[18px] pb-[14px]">
          <button type="button" onClick={onClose} aria-label="Volver" className={btnClass}>
            <ArrowLeft className="size-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[19px] font-extrabold">Sugerir contacto</h2>
            <p className="mt-[3px] text-[13px] text-[#737f82]">
              Pon el número que tienes y de dónde lo sacas. Lo publicamos cuanto antes.
            </p>
          </div>
          <button type="button" onClick={onCloseAll} aria-label="Cerrar" className={btnClass}>
            <X className="size-[18px]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-[18px] pt-[16px] pb-[8px] h-full">
          {status === 'done' ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-[16px] grid h-[64px] w-[64px] place-items-center rounded-full bg-[rgba(14,156,143,0.12)] text-[#0e9c8f]">
                <Check className="size-[30px]" strokeWidth={2.5} />
              </div>
              <h3 className="text-[18px] font-extrabold text-[#173a40]">¡Gracias!</h3>
              <p className="mt-[6px] max-w-[260px] text-[13px] leading-[1.55] text-[#737f82]">
                Lo revisamos y lo publicamos cuanto antes.
              </p>
              <button
                type="button"
                onClick={() => { setStatus('idle'); setForm({ category: 'bomberos', name: '', phone: '', sourceUrl: '' }) }}
                className="mt-[24px] h-[44px] rounded-[12px] border border-[#ededeb] px-[20px] text-[14px] font-semibold text-[#173a40]"
              >
                Sugerir otro contacto
              </button>
            </div>
          ) : (
            <>
              <label className={labelClass}>Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="mb-[14px] h-[48px] w-full appearance-none rounded-[12px] border border-[#ededeb] bg-white bg-no-repeat py-0 pr-[40px] pl-[14px] text-[15px] text-[#173a40] outline-none focus:border-[#0e9c8f]"
                style={SELECT_STYLE}
              >
                {VE_ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <label className={labelClass}>Categoría</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mb-[14px] h-[48px] w-full appearance-none rounded-[12px] border border-[#ededeb] bg-white bg-no-repeat py-0 pr-[40px] pl-[14px] text-[15px] text-[#173a40] outline-none focus:border-[#0e9c8f]"
                style={SELECT_STYLE}
              >
                {CONTACT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <label className={labelClass}>Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ej. Bomberos del Municipio Libertador"
                maxLength={200}
                className="mb-[14px] h-[48px] w-full rounded-[12px] border border-[#ededeb] bg-white px-[14px] text-[15px] text-[#173a40] outline-none focus:border-[#0e9c8f]"
              />
              <label className={labelClass}>Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="ej. 0212-483-2020"
                maxLength={50}
                type="tel"
                className="mb-[14px] h-[48px] w-full rounded-[12px] border border-[#ededeb] bg-white px-[14px] text-[15px] text-[#173a40] outline-none focus:border-[#0e9c8f]"
              />
              <label className={labelClass}>Fuente / enlace <span className="font-normal text-[#737f82]">(opcional)</span></label>
              <input
                value={form.sourceUrl}
                onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                placeholder="ej. https://twitter.com/BomberosCaracas"
                maxLength={500}
                type="url"
                className="h-[48px] w-full rounded-[12px] border border-[#ededeb] bg-white px-[14px] text-[15px] text-[#173a40] outline-none focus:border-[#0e9c8f]"
              />
            </>
          )}
        </div>
        {status !== 'done' && (
          <div className="px-[18px] pt-[12px] pb-[calc(16px+env(safe-area-inset-bottom))] border-t border-[#ededeb]">
            {status === 'error' && (
              <p className="mb-[8px] text-[13px] font-semibold text-[#e03131]">
                No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.
              </p>
            )}
            <button
              type="button"
              disabled={!form.name.trim() || !form.phone.trim() || status === 'sending'}
              onClick={async () => {
                setStatus('sending')
                try {
                  await suggestContact({ data: { zone: estado, ...form, sourceUrl: form.sourceUrl || null } })
                  setStatus('done')
                } catch {
                  setStatus('error')
                }
              }}
              className="flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[14px] bg-[#0e9c8f] text-[15.5px] font-bold text-white disabled:opacity-50"
            >
              <Send className="size-[16px]" />
              {status === 'sending' ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}

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

// Ayuda = dialog de contactos (no un "modo"). Números nacionales + directorio
// por estado (preseleccionado por GPS). UI-only: la zona aún no tiene datos.
export function HelpDialog({
  open,
  onClose,
  onAbout,
  userEstado,
}: {
  open: boolean
  onClose: () => void
  onAbout: () => void
  userEstado: string | null
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const matched = userEstado ? matchEstado(userEstado) : null
  const [estado, setEstado] = useState('Yaracuy')
  const [showSuggest, setShowSuggest] = useState(false)

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

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-[18px] pt-[16px] pb-[24px]">
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
                  Sugiérelo con su fuente (página oficial, RRSS o tweet).
                </p>
              </div>
            )}

            <Button
              variant="ghost"
              className="mt-[8px] flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[14px] border-0 bg-[rgba(14,156,143,0.1)] text-[15.5px] font-bold text-[#0e9c8f] hover:bg-[rgba(14,156,143,0.16)] hover:text-[#0e9c8f]"
              type="button"
              onClick={() => setShowSuggest(true)}
            >
              <Plus className="size-[19px]" /> Sugerir un contacto
            </Button>

            {/* Acerca de: vive aquí (no en el mapa) para no competir con el banner. */}
            <Button
              variant="ghost"
              type="button"
              onClick={onAbout}
              className="mt-[20px] flex h-auto w-full items-center gap-[12px] rounded-[14px] border border-[#ededeb] bg-white px-[14px] py-[13px] text-left hover:border-[#0e9c8f] hover:bg-white"
            >
              <span className="grid h-[36px] w-[36px] flex-none place-items-center rounded-[10px] bg-[rgba(14,156,143,0.1)] text-[#0e9c8f]">
                <Info className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold text-[#173a40]">
                  Acerca de AyudaVE
                </b>
                <span className="block text-[13px] text-[#737f82]">
                  Sugerencias, código abierto y créditos
                </span>
              </span>
              <ChevronRight className="size-[18px] flex-none text-[#b3bcbe]" />
            </Button>
          </div>
        </div>
      </dialog>
      <SuggestContactDialog
        open={showSuggest}
        onClose={() => setShowSuggest(false)}
        onCloseAll={() => { setShowSuggest(false); onClose() }}
        estado={estado}
      />
    </>
  )
}
