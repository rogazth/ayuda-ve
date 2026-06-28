import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

// Helpers de request compartidos por las server fns (reportes, comentarios,
// moderación). Antes vivían en reports.functions; se extrajeron para reusarlos
// sin arrastrar todo ese módulo.

export function clientIp(): string {
  // CF-Connecting-IP en Workers; getRequestIP() en dev local
  return getRequestHeader('cf-connecting-ip') ?? getRequestIP() ?? ''
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Nunca persistimos la IP cruda: guardamos un SHA-256 con pepper de env. Sirve
// igual para dedupe/self-confirm/throttle (hash==hash) pero no es PII reversible.
// El salt vive en el secret IP_SALT (wrangler); fallback fijo solo para dev/local.
export async function clientIpHash(): Promise<string> {
  const ip = clientIp()
  if (!ip) return ''
  const salt = (env as { IP_SALT?: string }).IP_SALT ?? 'ave-dev-salt'
  return sha256Hex(salt + ip)
}

export function clientUa(): string {
  return (getRequestHeader('user-agent') ?? '').slice(0, 250)
}

// País del visitante (ISO-3166 alpha-2) según Cloudflare. '' en dev local.
export function clientCountry(): string {
  return (getRequestHeader('cf-ipcountry') ?? '').toUpperCase()
}

export async function clientUaHash(): Promise<string> {
  const ua = clientUa()
  if (!ua) return ''
  return sha256Hex(ua)
}
