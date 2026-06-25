// Datos + utils puros (sin Leaflet) — compartidos por el mapa, la lista y los tests.

type TypeMeta = { label: string; color: string; svg: string }

// svg = markup interno (icono blanco) para divIcon del pin.
export const TYPES: Record<string, TypeMeta> = {
  trapped: {
    label: 'Persona atrapada',
    color: '#E03131',
    svg: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="#fff"/>',
  },
  missing: {
    label: 'Persona desaparecida',
    color: '#F08C00',
    svg: '<circle cx="12" cy="7" r="4" fill="#fff"/><path d="M5 21v-1a7 7 0 0 1 14 0v1" fill="#fff"/>',
  },
  danger: {
    label: 'Estructura dañada',
    color: '#E8590C',
    svg: '<path d="M5 21V6h14v15z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><path d="M11 6l-2 6 3 1.5-2 7.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  need: {
    label: 'Necesito ayuda',
    color: '#2F7BD6',
    svg: '<circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="2" fill="none"/><path d="M9 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="12" cy="17" r="1.5" fill="#fff"/>',
  },
  offer: {
    label: 'Ofrezco ayuda',
    color: '#2F9E44',
    svg: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#fff"/>',
  },
  support: {
    label: 'Centro de acopio',
    color: '#7048E8',
    svg: '<path d="M12 3 21 11h-2v9H5v-9H3z" fill="#fff"/>',
  },
  lostpet: {
    label: 'Mascota desaparecida',
    color: '#0CA678',
    svg: '<path d="M5.5 11a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zm4-3a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zm5 0a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zm4 3a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM12 11.5c-2.6 0-5 2.8-5 5 0 1.6 1.2 2.5 2.7 2.5 1 0 1.6-.5 2.3-.5s1.3.5 2.3.5c1.5 0 2.7-.9 2.7-2.5 0-2.2-2.4-5-5-5z" fill="#fff"/>',
  },
  wifi: {
    label: 'Señal / Internet',
    color: '#1971C2',
    svg: '<path d="M12 21l1.5-1.5A9 9 0 0 0 3 10.5L1.5 12A11 11 0 0 1 12 3a11 11 0 0 1 10.5 9L21 10.5a9 9 0 0 0-9.5 9L12 21zm0 0l1.5-1.5a5 5 0 0 0-3 0L12 21zm0-4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0-4a6 6 0 0 1 4.5 2L15 16.5A4 4 0 0 0 12 15a4 4 0 0 0-3 1.5L7.5 15A6 6 0 0 1 12 13z" fill="#fff"/>',
  },
  road: {
    label: 'Vía bloqueada',
    color: '#B45309',
    svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/><path d="M7 12h10" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>',
  },
  security: {
    label: 'Alerta de seguridad',
    color: '#9F1239',
    svg: '<path d="M12 2L4 6v6c0 4.4 3.5 8.5 8 9.5 4.5-1 8-5.1 8-9.5V6l-8-4z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M12 8v4.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="15.5" r="1.3" fill="#fff"/>',
  },
  flood: {
    label: 'Zona inundada',
    color: '#1D4ED8',
    svg: '<path d="M3 10c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0M3 15c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M7 6l2-3 2 3M13 6l2-3 2 3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
}

export function typeOf(t: string): TypeMeta {
  return TYPES[t] ?? TYPES.otro
}

// ponytail: Solo publicamos números verificados con fuente. NO inventar teléfonos
// en una app de emergencia. Cada entrada lleva su URL comprobable.
export type ContactSource = { label: string; url?: string }
export type ContactEntry = {
  name: string
  phone: string
  note?: string
  source: ContactSource
}

const EE =
  'https://www.elespectador.com/mundo/venezuela/sismo-en-venezuela-hoy-lineas-de-atencion-y-emergencia-nacional-en-zonas-afectadas/'
const PJ = 'https://x.com/Pr1meroJusticia/status/2069958385726902674'

export const EMERGENCY: ContactEntry[] = [
  {
    name: 'Emergencias Nacionales',
    phone: '911',
    note: 'Policía · Bomberos · Médica',
    source: { label: 'Primero Justicia, jun. 2026', url: PJ },
  },
  {
    name: 'Bomberos',
    phone: '167',
    note: 'Código corto nacional',
    source: { label: 'Primero Justicia, jun. 2026', url: PJ },
  },
  {
    name: 'Protección Civil',
    phone: '166',
    note: 'Desastres · línea larga: 0800-724-8451',
    source: { label: 'Primero Justicia, jun. 2026', url: PJ },
  },
  {
    name: 'CORPOELEC',
    phone: '0500-502-0000',
    note: 'Fallas del sistema eléctrico',
    source: {
      label: 'El Diario, abr. 2024',
      url: 'https://eldiario.com/2024/04/10/numeros-reportar-averias-sistema-electrico-corpoelec/',
    },
  },
]

// Anuncios activos: líneas abiertas en respuesta a un evento específico.
// Quitar una vez pase la emergencia.
export type FeaturedAlert = {
  org: string
  headline: string
  phone: string
  url: string // fuente / más info
}

export const FEATURED_ALERTS: FeaturedAlert[] = [
  {
    org: 'NueveOnce',
    headline:
      'Telemedicina gratuita ante el sismo · Médicos y paramédicos disponibles',
    phone: '0800-4662400',
    url: 'https://www.instagram.com/gruponueveonce',
  },
]

// Fuentes base para contactos regionales
const EC =
  'https://efectococuyo.com/la-humanidad/numeros-de-emergencia-de-bomberos-y-proteccion-civil/'
const CR = 'https://cruzroja.ve/nuestra-presencia/'

export const REGIONAL: Partial<Record<string, ContactEntry[]>> = {
  'Distrito Capital': [
    {
      name: 'Bomberos Metropolitanos',
      phone: '0212-545-4545',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
    {
      name: 'Protección Civil DC',
      phone: '0212-575-3332',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
  ],
  'La Guaira': [
    {
      name: 'Bomberos La Guaira',
      phone: '0212-332-2165',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
    {
      name: 'Protección Civil La Guaira',
      phone: '0424-207-5335',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
  ],
  Miranda: [
    {
      name: 'Bomberos Los Teques',
      phone: '0212-322-9038',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Protección Civil Miranda',
      phone: '0212-383-7849',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
    {
      name: 'Cruz Roja — Charallave',
      phone: '0414-276-6421',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  Aragua: [
    {
      name: 'Bomberos de Aragua',
      phone: '0243-235-1346',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Protección Civil Aragua',
      phone: '0243-247-4940',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
    {
      name: 'Cruz Roja — Maracay',
      phone: '0243-553-2629',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  Carabobo: [
    {
      name: 'Bomberos de Valencia',
      phone: '0241-838-7372',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
    {
      name: 'Bomberos Puerto Cabello',
      phone: '0242-362-2461',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
    {
      name: 'Protección Civil Carabobo',
      phone: '0241-859-2171',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
    {
      name: 'Cruz Roja — Valencia',
      phone: '0241-825-6436',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  Yaracuy: [
    {
      name: 'Bomberos San Felipe',
      phone: '0254-234-5533',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
    {
      name: 'Protección Civil Yaracuy',
      phone: '0424-781-7515',
      source: { label: 'El Espectador, jun. 2026', url: EE },
    },
  ],
  Zulia: [
    {
      name: 'Bomberos San Francisco',
      phone: '0800-233-5787',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Protección Civil Zulia',
      phone: '0261-757-6761',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Cruz Roja — Maracaibo',
      phone: '0261-798-6455',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  Táchira: [
    {
      name: 'Bomberos de Táchira',
      phone: '0276-353-4344',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Protección Civil Táchira',
      phone: '0276-516-5460',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Cruz Roja — San Cristóbal',
      phone: '0276-343-4214',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  Mérida: [
    {
      name: 'Bomberos Mérida',
      phone: '0274-266-3612',
      note: 'Alternativo — principal: 171',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Cruz Roja — Mérida',
      phone: '0274-263-2219',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  Bolívar: [
    {
      name: 'Cruz Roja — Ciudad Bolívar',
      phone: '0285-654-7001',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  Falcón: [
    {
      name: 'Bomberos Carirubana',
      phone: '0269-245-8246',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Protección Civil Falcón',
      phone: '0268-252-4449',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Cruz Roja — Coro',
      phone: '0268-252-3427',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
    {
      name: 'Cruz Roja — Punto Fijo',
      phone: '0269-245-9434',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  'Nueva Esparta': [
    {
      name: 'Bomberos Nueva Esparta',
      phone: '0295-264-1445',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Protección Civil Nueva Esparta',
      phone: '0295-263-8052',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Cruz Roja — Porlamar',
      phone: '0295-417-5560',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  Anzoátegui: [
    {
      name: 'Bomberos Barcelona',
      phone: '0281-276-0066',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Protección Civil Anzoátegui',
      phone: '0281-277-0791',
      source: { label: 'Efecto Cocuyo', url: EC },
    },
    {
      name: 'Cruz Roja — Barcelona',
      phone: '0281-274-2090',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
  Lara: [
    {
      name: 'Cruz Roja — Barquisimeto',
      phone: '0251-808-9694',
      source: { label: 'Cruz Roja Venezolana', url: CR },
    },
  ],
}

export function haversine(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const R = 6371000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const la1 = (aLat * Math.PI) / 180
  const la2 = (bLat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Pines que aparecieron desde la última vez Y son recientes (createdAt < freshMs):
// el filtro de frescura evita sonar por reportes viejos que entran al viewport al
// hacer pan. Muta `seen` con los ids actuales. [[map-screen]]
export function newFreshPins<T extends { id: string; createdAt: number }>(
  pins: T[],
  seen: Set<string>,
  now: number,
  freshMs: number,
): T[] {
  const fresh = pins.filter(
    (p) => !seen.has(p.id) && now - p.createdAt < freshMs,
  )
  for (const p of pins) seen.add(p.id)
  return fresh
}

export function fmtAge(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000)
  if (s < 60) return 'recién'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

// Fecha y hora local de Venezuela (UTC-4). USGS entrega UTC; mostramos VET
// para que la hora coincida con la que vivió la gente. ponytail: VE no usa DST.
const VE_DTF = new Intl.DateTimeFormat('es-VE', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'America/Caracas',
})
export function fmtDateTime(ms: number) {
  return VE_DTF.format(ms)
}

export function fmtDist(m: number) {
  return m < 1000
    ? `a ${Math.round(m / 10) * 10} m`
    : `a ${(m / 1000).toFixed(1)} km`
}

// --- detalle del reporte: campos del meta + acciones (puros, testeables) ---

// Qué campos de `meta` mostrar por tipo y su etiqueta, en orden. Las claves que
// no estén acá (p.ej. photos) no se renderizan como dato. ponytail: agregar fila
// = una entrada acá; ningún tipo nuevo crashea, solo no muestra meta.
const META_SPECS: Record<string, [key: string, label: string][]> = {
  trapped: [
    ['count', 'Personas'],
    ['state', 'Estado'],
    ['accessible', 'Acceso'],
  ],
  missing: [
    ['missingName', 'Nombre'],
    ['age', 'Edad'],
    ['location', 'Última ubicación'],
  ],
  danger: [
    ['dangerType', 'Tipo de peligro'],
    ['damageLevel', 'Nivel de daño'],
    ['address', 'Dirección'],
    ['zone', 'Sector'],
    ['peopleAtRisk', 'Personas en riesgo'],
    ['source', 'Fuente'],
  ],
  need: [
    ['items', 'Necesita'],
    ['count', 'Personas'],
  ],
  offer: [
    ['items', 'Ofrece'],
    ['capacity', 'Cantidad / capacidad'],
  ],
  support: [
    ['available', 'Disponible'],
    ['schedule', 'Horario'],
  ],
  lostpet: [
    ['petName', 'Nombre'],
    ['species', 'Especie'],
  ],
  wifi: [
    ['available', 'Disponible'],
    ['wifiPassword', 'Contraseña WiFi'],
    ['schedule', 'Horario'],
  ],
  road: [
    ['roadCause', 'Causa'],
    ['passable', 'Transitable'],
  ],
  security: [
    ['securityType', 'Tipo'],
    ['stillActive', 'Situación actual'],
  ],
  flood: [
    ['floodLevel', 'Nivel'],
    ['passable', 'Transitable'],
  ],
}

export type MetaField = { label: string; text?: string; chips?: string[] }

export function metaFields(
  type: string,
  meta: Record<string, unknown>,
): MetaField[] {
  const out: MetaField[] = []
  for (const [key, label] of META_SPECS[type] ?? []) {
    const v = meta[key]
    if (Array.isArray(v) && v.length) out.push({ label, chips: v.map(String) })
    else if (typeof v === 'string' && v.trim()) out.push({ label, text: v })
    else if (typeof v === 'number') out.push({ label, text: String(v) })
  }
  return out
}

// El wizard guarda el número sin prefijo; anteponemos 58 (Venezuela) salvo que ya
// venga. Devuelve solo dígitos (formato wa.me / tel:).
export function phoneIntl(contact: string | null | undefined): string | null {
  const d = (contact ?? '').replace(/\D/g, '')
  if (!d) return null
  return d.startsWith('58') ? d : `58${d}`
}

// Zonas a evitar o alertas sin persona responsable contactable.
const NO_CONTACT_TYPES = new Set(['danger', 'road', 'security', 'flood'])
export function canContact(
  type: string,
  contact: string | null | undefined,
): boolean {
  return !NO_CONTACT_TYPES.has(type) && phoneIntl(contact) != null
}

export function mapsDir(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

// --- teléfono venezolano (input del wizard) ---
// Forzado a Venezuela: el +58 es fijo en la UI, guardamos solo los 10 dígitos
// locales. Móviles empiezan en 4, fijos en 2. [[phone-intl]]
export function veDigits(input: string): string {
  let d = input.replace(/\D/g, '')
  // Pegaron el número completo con prefijo país (+58…): lo quitamos. Los locales
  // empiezan en 2/4 (nunca 5), así que un 58 inicial sobrante es el código país.
  if (d.startsWith('58') && d.length > 10) d = d.slice(2)
  return d.slice(0, 10)
}

export function formatVePhone(input: string): string {
  const d = veDigits(input)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)]
    .filter(Boolean)
    .join(' ')
}

export function isValidVePhone(input: string): boolean {
  return /^[24]\d{9}$/.test(veDigits(input))
}
