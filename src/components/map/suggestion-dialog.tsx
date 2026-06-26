import { useEffect, useRef, useState } from 'react'
import { Check, Send, X } from 'lucide-react'
import { createSuggestion } from '../../suggestions/suggestions.functions'
import { HelpUsCard } from './help-us-card'

// Buzón único del público: avisos, contactos, datos, ideas o errores — todo entra
// como texto libre + contacto. Antes había 3 formularios separados (aviso/contacto/
// sugerencia); se unificaron aquí para no confundir. Se guarda en D1 vía
// createSuggestion. Mismo <dialog> nativo que Help/About (backdrop/Esc/foco gratis).
export function SuggestionDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
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
    if (open && !d.open) {
      d.showModal()
      setStatus('idle')
    } else if (!open && d.open) d.close()
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
      className="m-0 h-dvh max-h-dvh w-full max-w-full border-0 bg-transparent p-0 text-ink backdrop:bg-[rgba(20,32,28,0.45)] open:animate-dialog-slide motion-reduce:open:animate-none"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <header className="flex items-center gap-3 border-b border-line px-[18px] pt-[18px] pb-[14px]">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[19px] font-extrabold">Sumate o sugiere</h2>
            <p className="mt-[3px] text-[13px] text-ink-muted">
              ¿Quieres moderar, aportar contenido o tienes un dato? Escríbenos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-[34px] flex-none place-items-center rounded-full bg-surface-muted text-sea-ink-soft"
          >
            <X className="size-[18px]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-[18px] pt-[16px] pb-[24px]">
          {status === 'done' ? (
            <div className="flex items-start gap-2.5 rounded-2xl bg-lagoon-wash p-[14px]">
              <span className="grid size-[26px] flex-none place-items-center rounded-full bg-lagoon text-white">
                <Check className="size-[16px]" />
              </span>
              <div className="min-w-0">
                <b className="block text-[14.5px] text-ink">
                  ¡Gracias! Recibimos tu sugerencia.
                </b>
                <button
                  type="button"
                  className="mt-1 text-[13px] font-semibold text-lagoon-ink"
                  onClick={() => setStatus('idle')}
                >
                  Enviar otra
                </button>
              </div>
            </div>
          ) : (
            <>
              <HelpUsCard />

              <p className="mt-[18px] mb-2.5 text-[12px] font-extrabold tracking-[0.05em] text-ink-faint uppercase">
                O déjanos una sugerencia
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Un aviso, un contacto con su fuente, una corrección, una idea… Si hay algo que publicar en la web, lo gestionamos nosotros."
                className="w-full resize-y rounded-xl border border-line bg-white p-3 text-[15px] leading-[1.5] text-ink outline-none focus:border-lagoon"
              />
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={200}
                placeholder="Tu correo (opcional, para responderte)"
                className="mt-2.5 h-[48px] w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none focus:border-lagoon"
              />
              {status === 'error' && (
                <p className="mt-2 text-[13px] font-semibold text-danger">
                  No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.
                </p>
              )}
              <button
                type="button"
                disabled={!text.trim() || status === 'sending'}
                onClick={submit}
                className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-lagoon text-[15.5px] font-bold text-white disabled:opacity-50"
              >
                <Send className="size-[18px]" />
                {status === 'sending' ? 'Enviando…' : 'Enviar sugerencia'}
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
