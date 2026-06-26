// Lógica pura de avisos (sin D1 ni React) — compartida por las server fns, la
// pantalla y los tests. Espejo de contacts.ts. Los íconos (lucide) viven en la
// pantalla; aquí solo el dato puro: categorías, labels y color por categoría.

import { safeUrl } from '../reports/reports'

export const ANNOUNCEMENT_CATEGORIES = [
  'salud',
  'conectividad',
  'rescate',
  'insumos',
  'refugio',
  'transporte',
] as const
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  salud: 'Salud',
  conectividad: 'Conectividad',
  rescate: 'Rescate',
  insumos: 'Insumos',
  refugio: 'Refugio',
  transporte: 'Transporte',
}

// Color por categoría = misma idea que TYPES en reports.ts: una sola fuente que
// consumen chip, ícono y texto. 6 hues distinguibles sobre blanco.
export const CATEGORY_COLORS: Record<AnnouncementCategory, string> = {
  salud: '#0e9c8f',
  conectividad: '#1f6feb',
  rescate: '#c2410c',
  insumos: '#7c3aed',
  refugio: '#1f5a3a',
  transporte: '#b45309',
}

// Todo opcional/nullable: es lo que llega por la red (trust boundary), no lo que
// nos gustaría. cleanAnnouncement garantiza category/title válidos en la salida.
export type SuggestAnnouncementInput = {
  category?: string | null
  title?: string | null
  body?: string | null
  contact?: string | null
  url?: string | null
}

// Valida una sugerencia de aviso (trust boundary). Espejo de cleanSuggestion:
// recorta longitudes, exige categoría conocida y normaliza la url con safeUrl
// (solo http(s), sin credenciales). El handler fuerza source/status.
export function cleanAnnouncement(input: SuggestAnnouncementInput) {
  const category = input.category?.trim()
  const title = input.title?.trim().slice(0, 200)
  const body = input.body?.trim().slice(0, 2000) || ''
  const contact = input.contact?.trim().slice(0, 50) || null
  const url = safeUrl(input.url)

  if (!title) throw new Error('título requerido')
  if (!ANNOUNCEMENT_CATEGORIES.includes(category as AnnouncementCategory))
    throw new Error('categoría inválida')

  // tras el guard, category es una categoría válida (includes no narrowea solo).
  return { category: category as AnnouncementCategory, title, body, contact, url }
}
