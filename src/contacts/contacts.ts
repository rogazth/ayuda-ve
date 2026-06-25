// Lógica pura de contactos por zona (sin D1) — compartida por las server fns y los tests.

export const CONTACT_CATEGORIES = [
  'bomberos',
  'policia',
  'hospital',
  'proteccion_civil',
  'otro',
] as const
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<ContactCategory, string> = {
  bomberos: 'Bomberos',
  policia: 'Policía',
  hospital: 'Hospital / Salud',
  proteccion_civil: 'Protección Civil',
  otro: 'Otro',
}

export type SuggestionInput = {
  zone: string
  category: string
  name: string
  phone: string
  sourceUrl?: string | null
}

// Valida una sugerencia de la comunidad (trust boundary).
export function cleanSuggestion(input: SuggestionInput) {
  const zone = input.zone?.trim()
  const name = input.name?.trim().slice(0, 200)
  const phone = input.phone?.trim().slice(0, 50)
  const category = input.category?.trim()
  const sourceUrl = input.sourceUrl?.trim().slice(0, 500) || null

  if (!zone) throw new Error('zona requerida')
  if (!name) throw new Error('nombre requerido')
  if (!phone) throw new Error('teléfono requerido')
  if (!CONTACT_CATEGORIES.includes(category as ContactCategory))
    throw new Error('categoría inválida')

  return { zone, name, phone, category, sourceUrl }
}
