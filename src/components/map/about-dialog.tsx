import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ExternalLink, Github, Heart, Mail, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createSuggestion } from '../../suggestions/suggestions.functions'

// ponytail: correo y repo del proyecto. Cambia CONTACT_EMAIL por el alias real
// una vez configures Cloudflare Email Routing (reenvía a tu Gmail sin exponerlo)
// o un Gmail dedicado. NO uses el personal.
const CONTACT_EMAIL = 'contacto@ayudave.com'
const REPO_URL = 'https://github.com/rogazth/ayuda-ve'

// "Acerca de": buzón de sugerencias (se guardan en D1) + nota de open source +
// créditos. Mismo <dialog> nativo que HelpDialog (backdrop/Esc/foco gratis).
export function AboutDialog({
  open,
  onClose,
  onBack,
}: {
  open: boolean
  onClose: () => void
  onBack: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [text, setText] = useState('')
  const [contact, setContact] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>(
    'idle',
  )

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  const submit = async () => {
    if (!text.trim() || status === 'sending') return
    setStatus('sending')
    try {
      await createSuggestion({ data: { text, contact } })
      setText('')
      setContact('')
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
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
          <Button
            variant="ghost"
            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border-0 bg-[#f1f4f2] text-[#416166] hover:bg-[#e7ebe9] hover:text-[#416166]"
            onClick={onBack}
            aria-label="Volver"
          >
            <ArrowLeft className="size-[18px]" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 flex items-center gap-[8px] text-[19px] font-extrabold">
              <Heart className="h-[20px] w-[20px] text-[#0e9c8f]" /> Acerca de
            </h2>
            <p className="mt-[3px] text-[13px] text-[#737f82]">
              Proyecto comunitario y de código abierto
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
          {/* Sugerencias: acción principal, va primero */}
          <p className="mb-[8px] text-[11.5px] font-extrabold tracking-[0.6px] text-[#737f82] uppercase">
            Sugerencias
          </p>
          <p className="mb-[12px] text-[13px] leading-[1.55] text-[#737f82]">
            ¿Qué mejorarías? ¿Qué falta? Cuéntanos y lo revisamos.
          </p>

          {status === 'done' ? (
            <div className="flex items-start gap-[10px] rounded-[14px] bg-[rgba(14,156,143,0.1)] p-[14px]">
              <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-[#0e9c8f] text-white">
                <Check className="size-[16px]" />
              </span>
              <div className="min-w-0">
                <b className="block text-[14.5px] text-[#173a40]">
                  ¡Gracias! Recibimos tu sugerencia.
                </b>
                <button
                  type="button"
                  className="mt-[4px] text-[13px] font-semibold text-[#0e9c8f]"
                  onClick={() => setStatus('idle')}
                >
                  Enviar otra
                </button>
              </div>
            </div>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Tu sugerencia…"
                className="w-full resize-y rounded-[12px] border border-[#ededeb] bg-white p-[12px] text-[15px] leading-[1.5] text-[#173a40] outline-none focus:border-[#0e9c8f]"
              />
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={200}
                placeholder="Tu correo (opcional, para responderte)"
                className="mt-[10px] h-[48px] w-full rounded-[12px] border border-[#ededeb] bg-white px-[14px] text-[15px] text-[#173a40] outline-none focus:border-[#0e9c8f]"
              />
              {status === 'error' && (
                <p className="mt-[8px] text-[13px] font-semibold text-[#e03131]">
                  No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.
                </p>
              )}
              <Button
                variant="ghost"
                type="button"
                disabled={!text.trim() || status === 'sending'}
                onClick={submit}
                className="mt-[12px] flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[14px] border-0 bg-[#0e9c8f] text-[15.5px] font-bold text-white hover:bg-[#0c8a7e] hover:text-white disabled:opacity-50"
              >
                <Send className="size-[18px]" />
                {status === 'sending' ? 'Enviando…' : 'Enviar sugerencia'}
              </Button>
            </>
          )}

          {/* Código abierto */}
          <p className="mt-[24px] mb-[8px] text-[11.5px] font-extrabold tracking-[0.6px] text-[#737f82] uppercase">
            Código abierto
          </p>
          <p className="mb-[12px] text-[13px] leading-[1.6] text-[#737f82]">
            AyudaVE es software libre bajo licencia <b>MIT</b>: puedes usarlo,
            copiarlo y adaptarlo. ¿Una idea o un arreglo? Abre un issue o un pull
            request en GitHub.
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-[12px] rounded-[14px] border border-[#ededeb] p-[14px] text-inherit no-underline hover:border-[#0e9c8f]"
          >
            <span className="grid h-[40px] w-[40px] flex-none place-items-center rounded-[10px] bg-[#173a40] text-white">
              <Github className="size-[20px]" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">
                Ver el repositorio
              </b>
              <span className="block truncate text-[13px] text-[#737f82]">
                github.com/rogazth/ayuda-ve
              </span>
            </span>
            <ExternalLink className="size-[18px] flex-none text-[#0e9c8f]" />
          </a>

          {/* Créditos */}
          <p className="mt-[24px] mb-[8px] text-[11.5px] font-extrabold tracking-[0.6px] text-[#737f82] uppercase">
            Créditos
          </p>
          <p className="text-[14px] leading-[1.6] text-[#173a40]">
            Hecho por <b>Gabriel Rodriguez</b>.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-[8px] inline-flex items-center gap-[8px] text-[14px] font-semibold text-[#0e9c8f] no-underline"
          >
            <Mail className="size-[16px]" /> {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </dialog>
  )
}
