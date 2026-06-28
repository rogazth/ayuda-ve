import { Send } from 'lucide-react'

// Grupo público de Telegram donde publicamos los reportes apenas llegan. CTA
// reusado en "Más", "Cómo ayudar" y las landings SEO. UI pura, sin backend:
// solo enlaza al grupo (la publicación automática de reportes es Fase 8.6).
export const TELEGRAM_URL = 'https://t.me/ayudave_reportes'

export function TelegramCta() {
  return (
    <div className="rounded-2xl bg-[#e9f5fb] p-[14px]">
      <b className="flex items-center gap-2 text-[14.5px] text-ink">
        <Send className="size-[17px] flex-none text-[#229ed9]" />
        Súmate a la comunidad
      </b>
      <p className="mt-[3px] text-[13px] leading-[1.5] text-ink-muted">
        Recibe los reportes apenas llegan y mantente al día con la emergencia en
        nuestro grupo de Telegram.
      </p>
      {/* color inline: la regla global `a {}` en styles.css (sin capa) pisa la
          utilidad text-white en Tailwind v4; inline gana al no ser !important. */}
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#fff' }}
        className="mt-[12px] flex h-[44px] items-center justify-center gap-2 rounded-xl bg-[#229ed9] px-3.5 text-[14px] font-semibold no-underline"
      >
        <Send className="size-[17px] flex-none" />
        Entrar al grupo
      </a>
    </div>
  )
}
