import { Mail, MessageCircle } from 'lucide-react'
import { CONTACT_EMAIL } from './about-dialog'

// Número para wa.me (sin signos) y su versión legible (formato EE.UU.).
const WHATSAPP_NUMBER = '17868163954'
const WHATSAPP_DISPLAY = '+1 (786) 816-3954'

// Invitación a sumarse (moderar / aportar contenido) + contacto directo. Se reusa
// en el buzón de sugerencias, al final de "Más" y en "Cómo ayudar". Email y
// WhatsApp son tap-to-open.
export function HelpUsCard() {
  return (
    <div className="rounded-2xl bg-lagoon-wash p-[14px]">
      <b className="block text-[14.5px] text-ink">
        ¿Quieres ayudar a mantener esto?
      </b>
      <p className="mt-[3px] text-[13px] leading-[1.5] text-ink-muted">
        Buscamos moderadores y gente que aporte contenido (avisos, contactos,
        correcciones). Escríbenos directo:
      </p>
      <div className="mt-[12px] flex flex-col gap-2">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="flex h-[44px] items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 text-[14px] font-semibold text-ink no-underline"
        >
          <Mail className="size-[18px] flex-none text-lagoon-ink" />
          {CONTACT_EMAIL}
        </a>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[44px] items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 text-[14px] font-semibold text-ink no-underline"
        >
          <MessageCircle className="size-[18px] flex-none text-[#25d366]" />
          WhatsApp {WHATSAPP_DISPLAY}
        </a>
      </div>
    </div>
  )
}
