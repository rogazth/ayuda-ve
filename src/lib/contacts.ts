// Lógica pura de contactos por zona (sin D1) — compartida por las server fns y los tests.
import { haversine } from './reports'

export const CONTACT_CATEGORIES = [
  'bomberos',
  'policia',
  'hospital',
  'proteccion_civil',
  'otro',
] as const
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]

// Radio para considerar un contacto "de tu zona". Fuera de esto → fallback nacional.
export const ZONE_RADIUS_M = 50_000

type Located = { zone: string; lat: number; lng: number }

// Zona del contacto visible más cercano dentro del radio. null = sin cobertura.
export function nearestZone(rows: Located[], lat: number, lng: number): string | null {
  let best: { zone: string; d: number } | null = null
  for (const r of rows) {
    const d = haversine(lat, lng, r.lat, r.lng)
    if (!best || d < best.d) best = { zone: r.zone, d }
  }
  return best && best.d <= ZONE_RADIUS_M ? best.zone : null
}

export type SuggestionInput = {
  zone: string
  category: string
  name: string
  phone: string
  lat: number
  lng: number
  sourceUrl?: string | null
}

// Valida una sugerencia de la comunidad (trust boundary). Limpia y normaliza, o
// lanza. No se confía en el cliente: un teléfono de emergencia malo es peligroso.
export function cleanSuggestion(input: SuggestionInput) {
  const zone = input.zone?.trim()
  const name = input.name?.trim()
  const phone = input.phone?.trim()
  const category = input.category?.trim()
  const lat = Number(input.lat)
  const lng = Number(input.lng)
  const sourceUrl = input.sourceUrl?.trim() || null

  if (!zone) throw new Error('zona requerida')
  if (!name) throw new Error('nombre requerido')
  if (!phone) throw new Error('teléfono requerido')
  if (!CONTACT_CATEGORIES.includes(category as ContactCategory))
    throw new Error('categoría inválida')
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('lat inválida')
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('lng inválida')

  return { zone, name, phone, category, lat, lng, sourceUrl }
}
