// Geocodificación offline para Venezuela. Sin geocoder remoto en batch:
// Nominatim limita a 1 req/s y nos banearía. Matcheamos contra esta tabla;
// si no hay match con precisión suficiente, el pipeline hace SKIP (geo buena
// o nada). Esta tabla ES la superficie de calidad: crecerla mejora cobertura.
//
// ponytail: substring con límites de palabra, no parser de direcciones. Si la
// fuente trae sectores/parroquias finas, se añaden aquí como ciudades nuevas.

export type Precision = 'city' | 'state'
export type Geo = { lat: number; lng: number; precision: Precision }

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos (no los vuelve espacio)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Ciudades y poblaciones (centro aprox., ±1-2km, suficiente para un pin).
// Solo coords en las que confío; ante la duda, se omite (mejor skip).
const CITIES: Array<[string, number, number]> = [
  // capitales de estado (también sirven de centroide del estado)
  ['Caracas', 10.4806, -66.9036],
  ['Maracaibo', 10.6427, -71.6125],
  ['Valencia', 10.162, -68.0077],
  ['Barquisimeto', 10.0678, -69.3467],
  ['Maracay', 10.2469, -67.5958],
  ['Ciudad Bolivar', 8.1222, -63.5497],
  ['Maturin', 9.7457, -63.1832],
  ['Barcelona', 10.134, -64.6963],
  ['Cumana', 10.454, -64.1769],
  ['Merida', 8.5897, -71.1561],
  ['San Cristobal', 7.7669, -72.225],
  ['Barinas', 8.6226, -70.2076],
  ['Coro', 11.4045, -69.6734],
  ['San Felipe', 10.3402, -68.7425],
  ['Guanare', 9.0419, -69.7424],
  ['San Juan de los Morros', 9.9118, -67.3548],
  ['San Fernando de Apure', 7.8939, -67.473],
  ['Trujillo', 9.3667, -70.435],
  ['La Asuncion', 11.0333, -63.8628],
  ['Tucupita', 9.0606, -62.0451],
  ['Puerto Ayacucho', 5.6639, -67.6236],
  ['San Carlos', 9.6611, -68.5859],
  ['Los Teques', 10.3417, -67.0417],
  ['La Guaira', 10.6, -66.9333],
  // otras poblaciones importantes
  ['Ciudad Guayana', 8.3533, -62.6528],
  ['Puerto Ordaz', 8.3019, -62.7197],
  ['Puerto La Cruz', 10.214, -64.6307],
  ['Lecheria', 10.1869, -64.6783],
  ['Cabimas', 10.4017, -71.4628],
  ['Ciudad Ojeda', 10.2003, -71.3119],
  ['Punto Fijo', 11.7167, -70.2056],
  ['Acarigua', 9.5597, -69.2019],
  ['Araure', 9.5667, -69.2167],
  ['Valera', 9.3189, -70.6039],
  ['El Vigia', 8.6128, -71.65],
  ['Ejido', 8.5453, -71.2392],
  ['El Tigre', 8.8853, -64.2536],
  ['Anaco', 9.4297, -64.4636],
  ['Porlamar', 10.9577, -63.8486],
  ['Pampatar', 10.9989, -63.795],
  ['Guarenas', 10.4717, -66.6111],
  ['Guatire', 10.4761, -66.5408],
  ['Petare', 10.4769, -66.8061],
  ['Charallave', 10.2433, -66.8597],
  ['Cua', 10.1631, -66.8881],
  ['Ocumare del Tuy', 10.1136, -66.7806],
  ['Santa Teresa del Tuy', 10.2386, -66.6636],
  ['Santa Lucia', 10.2867, -66.6606],
  ['Turmero', 10.2289, -67.4736],
  ['Cagua', 10.1869, -67.4608],
  ['La Victoria', 10.2272, -67.3306],
  ['Villa de Cura', 10.0386, -67.4894],
  ['Guacara', 10.2306, -67.8772],
  ['San Joaquin', 10.2667, -67.7167],
  ['Mariara', 10.2706, -67.7028],
  ['Puerto Cabello', 10.4731, -68.0125],
  ['Moron', 10.4856, -68.1928],
  ['Carupano', 10.6678, -63.2581],
  ['Calabozo', 8.9242, -67.4292],
  ['Valle de la Pascua', 9.2128, -66.0103],
  ['Zaraza', 9.3503, -65.3211],
  ['Altagracia de Orituco', 9.8597, -66.3797],
  ['Carora', 10.1747, -70.0814],
  ['El Tocuyo', 9.7869, -69.7917],
  ['Cabudare', 10.0306, -69.2611],
  ['Quibor', 9.9286, -69.5786],
  ['Yaritagua', 10.0817, -69.1264],
  ['Chivacoa', 10.1597, -68.9008],
  ['Tinaquillo', 9.9181, -68.305],
  ['Machiques', 10.0631, -72.5519],
  ['Santa Barbara del Zulia', 9.0019, -71.9214],
  ['Upata', 8.0086, -62.3992],
  ['Santa Elena de Uairen', 4.6033, -61.11],
  ['Caripito', 10.1083, -63.1006],
  ['Tucacas', 10.7967, -68.3197],
  ['Rubio', 7.7, -72.35],
  ['Tariba', 7.8167, -72.2167],
  ['La Fria', 8.2092, -72.2469],
  ['San Juan de Colon', 8.0269, -72.2606],
  ['Guasdualito', 7.2436, -70.7322],
]

// Alias de estado → ciudad capital (centroide aproximado del estado).
const STATE_TO_CAPITAL: Record<string, string> = {
  'distrito capital': 'Caracas',
  caracas: 'Caracas',
  miranda: 'Los Teques',
  'la guaira': 'La Guaira',
  vargas: 'La Guaira',
  zulia: 'Maracaibo',
  carabobo: 'Valencia',
  lara: 'Barquisimeto',
  aragua: 'Maracay',
  bolivar: 'Ciudad Bolivar',
  monagas: 'Maturin',
  anzoategui: 'Barcelona',
  sucre: 'Cumana',
  merida: 'Merida',
  tachira: 'San Cristobal',
  barinas: 'Barinas',
  falcon: 'Coro',
  yaracuy: 'San Felipe',
  portuguesa: 'Guanare',
  guarico: 'San Juan de los Morros',
  apure: 'San Fernando de Apure',
  trujillo: 'Trujillo',
  'nueva esparta': 'La Asuncion',
  'delta amacuro': 'Tucupita',
  amazonas: 'Puerto Ayacucho',
  cojedes: 'San Carlos',
}

// índice pre-normalizado: nombre → coords
const CITY_INDEX = CITIES.map(([name, lat, lng]) => ({ n: norm(name), lat, lng }))
const CAPITAL_COORD = new Map(CITY_INDEX.map((c) => [c.n, c]))

const wordRe = (n: string) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)

export function geocode(state?: string, place?: string): Geo | null {
  const hay = norm([place, state].filter(Boolean).join(' '))
  if (hay) {
    // ciudad: el match más largo gana (evita que "Cumana" pierda con "Cua")
    let best: { lat: number; lng: number; n: string } | null = null
    for (const c of CITY_INDEX) {
      if (wordRe(c.n).test(hay) && (!best || c.n.length > best.n.length)) best = c
    }
    if (best) return { lat: best.lat, lng: best.lng, precision: 'city' }
  }
  // solo estado: centroide de la capital (precisión gruesa)
  const stKey = state ? norm(state) : ''
  const cap = stKey ? STATE_TO_CAPITAL[stKey] : undefined
  if (cap) {
    const c = CAPITAL_COORD.get(norm(cap))
    if (c) return { lat: c.lat, lng: c.lng, precision: 'state' }
  }
  return null
}
