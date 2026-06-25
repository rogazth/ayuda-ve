// Datos + utils puros (sin Leaflet) — compartidos por el mapa, la lista y los tests.

type TypeMeta = { label: string; color: string; svg: string }

// svg = markup interno (icono blanco) para divIcon del pin y para el cuadro de la lista.
export const TYPES: Record<string, TypeMeta> = {
  heridos: {
    label: 'Persona herida',
    color: '#E03131',
    svg: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="#fff"/>',
  },
  derrumbe: {
    label: 'Derrumbe / daño',
    color: '#F08C00',
    svg: '<path d="M12 4 22 20H2Z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><path d="M12 10v4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  },
  servicios: {
    label: 'Corte de servicios',
    color: '#F2B705',
    svg: '<path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="#fff"/>',
  },
  albergue: {
    label: 'Albergue / ayuda',
    color: '#2F7BD6',
    svg: '<path d="M12 3 21 11h-2v9H5v-9H3z" fill="#fff"/>',
  },
  otro: {
    label: 'Otro',
    color: '#868E96',
    svg: '<path d="M10 3h4v5h5v4h-5v5h-4v-5H5v-4h5z" fill="#fff"/>',
  },
}

export function typeOf(t: string): TypeMeta {
  return TYPES[t] ?? TYPES.otro
}

// ponytail: 171 (VEN911) es el número nacional verificado — policía, bomberos y
// emergencia médica. Solo publicamos números confirmados: NO inventar teléfonos
// en una app de emergencia. Agregar más con su fuente verificada.
export const EMERGENCY: { name: string; phone: string; note?: string }[] = [
  { name: 'Emergencias (VEN911)', phone: '171', note: 'Policía · Bomberos · Médica' },
  { name: 'Bomberos', phone: '171' },
]

export function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const la1 = (aLat * Math.PI) / 180
  const la2 = (bLat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
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

export function fmtDist(m: number) {
  return m < 1000 ? `a ${Math.round(m / 10) * 10} m` : `a ${(m / 1000).toFixed(1)} km`
}
