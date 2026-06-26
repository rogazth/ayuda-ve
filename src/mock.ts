// Datos dummy de Etapa 1 (preview para PO). Lo "nuevo" con schema sin asentar
// (avisos, comentarios, cómo ayudar/acopio) se construye solo en UI contra estos
// mocks; el backend real se wirea en Etapa 2. Una variante de estado por URL
// (?mock=full|empty|loading) deja a PO revisar vacío/con-data/cargando sin rebuild.
// ponytail: un solo archivo, datos en memoria, cero deps — se borra al wirear.

import type { AnnouncementCategory } from './announcements/announcements'

export type MockVariant = 'full' | 'empty' | 'loading'

// Lee ?mock= una vez. SSR/Node → 'full' (no hay window). Cualquier valor no
// reconocido cae a 'full' para no romper el render.
export function mockVariant(): MockVariant {
  if (typeof window === 'undefined') return 'full'
  const v = new URLSearchParams(window.location.search).get('mock')
  return v === 'empty' || v === 'loading' ? v : 'full'
}

// Resuelve una lista mock a la forma {items, loading} que consumen las pantallas:
// full → data; empty → []; loading → [] + loading. La pantalla pinta su empty
// state cuando items=[] y !loading.
export function mockList<T>(
  data: T[],
  variant: MockVariant = mockVariant(),
): { items: T[]; loading: boolean } {
  if (variant === 'loading') return { items: [], loading: true }
  if (variant === 'empty') return { items: [], loading: false }
  return { items: data, loading: false }
}

const mins = (n: number) => Date.now() - n * 60_000

// ---- Avisos / Centro de notificaciones (POC I) ----------------------------
// Algunas notificaciones se relacionan con un reporte (reportId) → la card
// muestra un CTA "Ver reporte". El backend real se wirea en Etapa 2.
export type Announcement = {
  id: string
  category: AnnouncementCategory
  title: string
  body: string
  contact: string | null
  url: string | null
  createdAt: number
  verified: boolean
  reportId?: string // notificación ligada a un reporte → CTA "Ver reporte"
}

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a0',
    category: 'rescate',
    title: 'Un reporte cerca de ti fue confirmado por la comunidad',
    body: 'La búsqueda de María González (62) sumó 5 confirmaciones. Toca para ver el reporte.',
    contact: null,
    url: null,
    createdAt: mins(8),
    verified: true,
    reportId: 'demo-report',
  },
  {
    id: 'a1',
    category: 'rescate',
    title: 'Llegaron 30 rescatistas de El Salvador con perros de búsqueda',
    body: 'Equipo desplegado en Petare y El Valle. Coordinación con Protección Civil.',
    contact: null,
    url: 'https://pc.gob.ve',
    createdAt: mins(40),
    verified: true,
  },
  {
    id: 'a2',
    category: 'salud',
    title: 'Apoyo psicológico gratuito por teléfono, 24/7',
    body: 'Fundación Manos Amigas atiende crisis y duelo.',
    contact: '0800 123 4567',
    url: 'https://manosamigas.org',
    createdAt: mins(120),
    verified: true,
  },
  {
    id: 'a3',
    category: 'conectividad',
    title: 'Starlink ofrece internet gratis en 3 puntos de Caracas',
    body: '',
    contact: null,
    url: 'https://starlink.com/ve',
    createdAt: mins(180),
    verified: true,
  },
  {
    id: 'a4',
    category: 'insumos',
    title: 'Donación de agua potable en el sector La Pastora',
    body: 'Camión cisterna desde las 8am en la plaza. Lleva envases limpios.',
    contact: null,
    url: null,
    createdAt: mins(300),
    verified: true,
  },
]

// ---- Comentarios (POC B) --------------------------------------------------
export type Comment = {
  id: string
  authorName: string | null
  text: string
  createdAt: number
}

export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'c1',
    authorName: 'Rescate Valle',
    text: 'La vimos cerca de la plaza a las 3pm. Vamos para allá.',
    createdAt: mins(20),
  },
  {
    id: 'c2',
    authorName: 'Juán',
    text: 'Aviso a los vecinos del sector. 🙏',
    createdAt: mins(14),
  },
  {
    id: 'c3',
    authorName: null,
    text: 'Comparto en el grupo del edificio.',
    createdAt: mins(6),
  },
]

// ---- Cómo ayudar / Acopio (POC G) ----------------------------------------
export type AidCenter = {
  id: string
  flag: string // emoji bandera
  country: string
  city: string
  name: string
  address: string
  needs: string[]
  contact: string | null
  url: string | null
  lat: number
  lng: number
}

export const MOCK_AID_CENTERS: AidCenter[] = [
  {
    id: 'ac1',
    flag: '🇪🇸',
    country: 'España',
    city: 'Madrid',
    name: 'Casa de Venezuela Madrid',
    address: 'Calle de Alcalá 120 · Lun a Sáb 9–18h',
    needs: ['Medicinas', 'Alimentos no perecederos', 'Ropa de abrigo'],
    contact: '+34 600 000 000',
    url: null,
    lat: 40.4237,
    lng: -3.6796,
  },
  {
    id: 'ac2',
    flag: '🇺🇸',
    country: 'EE. UU.',
    city: 'Miami',
    name: 'Venezolanos en Miami',
    address: 'Doral, NW 41st St · 24h con cita',
    needs: ['Medicinas', 'Pañales', 'Agua'],
    contact: '+1 305 000 0000',
    url: null,
    lat: 25.8076,
    lng: -80.3432,
  },
  {
    id: 'ac3',
    flag: '🇨🇱',
    country: 'Chile',
    city: 'Santiago',
    name: 'Colectivo Venezolano en Chile',
    address: 'Providencia, Av. 11 de Septiembre · Mar a Dom 10–17h',
    needs: ['Medicinas', 'Útiles escolares'],
    contact: null,
    url: null,
    lat: -33.4263,
    lng: -70.6166,
  },
]
