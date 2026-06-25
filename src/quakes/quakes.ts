// Lógica pura de sismos: color/tamaño por magnitud y extracción del pronóstico
// oficial USGS. Sin Cloudflare ni react-leaflet → testeable directo (vitest).

// Escala tipo USGS: color por severidad, radio crece con la energía.
export function magColor(m: number) {
  if (m >= 6) return '#d7263d'
  if (m >= 5) return '#f4511e'
  if (m >= 4) return '#fb8c00'
  if (m >= 3) return '#fdd835'
  return '#9ccc65'
}
export const magRadius = (m: number) => Math.max(4, m * 2.2)

// Opacidad de un sismo en el mapa = "qué tan vivo se ve". La oleada de réplicas
// de FUNVISIS necesita contar la secuencia sin tapar el epicentro: grande O
// reciente se mantiene nítido, chico Y viejo se va al fondo (piso 0.3). La
// recencia cae en ~4 días; de M3 (sin aporte) a M6+ (nunca se desvanece). El
// sismo principal se dibuja aparte, siempre a 1.
export function quakeOpacity(mag: number, ageMs: number): number {
  const recency = 1 - ageMs / (96 * 3_600_000) // 96 h
  const magKeep = (mag - 3) / 3 // M3=0 … M6=1
  return Math.min(1, Math.max(0.3, recency, magKeep))
}

// Pronóstico oficial USGS: PROBABILIDADES, no certezas. m5 = prob. de réplica
// M5+ por ventana (0–1). Solo existe para sismos significativos (~M5+).
export type Forecast = {
  windows: { label: string; m5: number }[]
  updated: number
}

// Forma cruda del producto `oaf` de USGS (forecast.json).
export type OafForecast = {
  creationTime?: number
  forecast?: Array<{
    label: string
    bins?: Array<{ magnitude: number; probability: number }>
  }>
}

export function parseForecast(oaf: OafForecast): Forecast {
  return {
    windows: (oaf.forecast ?? []).map((w) => ({
      label: w.label,
      m5: w.bins?.find((b) => b.magnitude === 5)?.probability ?? 0,
    })),
    updated: oaf.creationTime ?? 0,
  }
}

// Venezuela: bbox país y fuente única (la usa el feed USGS y el cliente).
// Rectángulo a propósito — alcanza para "¿el usuario está en Venezuela?" y
// para encerrar el mapa. ponytail: polígono solo si algún día importa la frontera.
export const VE_BOUNDS = {
  minLat: 0.6,
  maxLat: 12.2,
  minLng: -73.4,
  maxLng: -59.8,
} as const

// USGS describe el lugar en inglés ("16 km NNW of Morón, Venezuela"). Lo
// traducimos a español para los dos formatos dominantes; el resto pasa tal cual.
// ponytail: añadir más patrones ("near the coast of…") solo si aparecen.
export function esPlace(place: string): string {
  const m = place.match(/^(\d+(?:\.\d+)?)\s*km\s+([NSEW]+)\s+of\s+(.+)$/i)
  if (m) return `a ${m[1]} km al ${m[2].toUpperCase().replace(/W/g, 'O')} de ${m[3]}`
  const r = place.match(/^(.+)\s+region$/i)
  if (r) return `región de ${r[1]}`
  return place
}

export function inVenezuela(lat: number, lng: number) {
  return (
    lat >= VE_BOUNDS.minLat &&
    lat <= VE_BOUNDS.maxLat &&
    lng >= VE_BOUNDS.minLng &&
    lng <= VE_BOUNDS.maxLng
  )
}

// Un sismo, venga del catálogo global (USGS) o de la red local (FUNVISIS).
// `source` es procedencia: cada dato debe poder atribuirse a quién lo registró
// [[no-misinformation]]. `url` apunta a la página comprobable del evento (USGS)
// o, a falta de página por evento, a la lista de FUNVISIS.
export type Quake = {
  id: string
  mag: number
  place: string
  time: number
  depth: number
  lat: number
  lng: number
  url: string
  source: 'usgs' | 'funvisis'
}

// FUNVISIS publica los ~20 sismos más recientes en maravilla.json: trae las
// réplicas chicas (M2–4) que USGS/EMSC NO catalogan en Venezuela (cobertura
// teleseísmica). El JSON reusa un template ajeno (store locator), de ahí los
// nombres absurdos: phone=magnitud, state=profundidad ("X km"), postalCode=
// fecha DD-MM-YYYY, city=hora HH:MM en hora local de Venezuela (VET=UTC-4 fijo,
// sin horario de verano), address=lugar, coordinates=[lng,lat]. Sin id ni URL
// por evento.
export const FUNVISIS_URL = 'http://www.funvisis.gob.ve/recientes.php'

export type FunvisisGeo = {
  features?: Array<{
    geometry?: { coordinates?: number[] | null } | null
    properties?: Record<string, unknown> | null
  } | null>
}

const num = (v: unknown) => parseFloat(String(v ?? '').replace(',', '.'))

// "DD-MM-YYYY" + "HH:MM" en VET (UTC-4 fijo) → epoch ms UTC. NaN si no parsea.
export function funvisisTime(date: string, time: string): number {
  const d = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec((date ?? '').trim())
  const t = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim())
  if (!d || !t) return NaN
  return Date.UTC(+d[3], +d[2] - 1, +d[1], +t[1] + 4, +t[2])
}

export function parseFunvisis(geo: FunvisisGeo): Quake[] {
  const out: Quake[] = []
  for (const f of geo.features ?? []) {
    const p = f?.properties ?? {}
    const c = f?.geometry?.coordinates
    const mag = num(p.phone)
    const time = funvisisTime(String(p.postalCode ?? ''), String(p.city ?? ''))
    const lat = Array.isArray(c) && c.length >= 2 ? c[1] : num(p.lat)
    const lng = Array.isArray(c) && c.length >= 2 ? c[0] : num(p.long)
    // dato incompleto/corrupto: lo saltamos, no inventamos
    if (![mag, time, lat, lng].every(Number.isFinite)) continue
    out.push({
      // sin id propio: uno sintético estable (tiempo+celda ~1km) para keys/dedup
      id: `fv-${time}-${Math.round(lat * 100)}-${Math.round(lng * 100)}`,
      mag,
      place: String(p.address ?? '').trim(),
      time,
      depth: num(p.state),
      lat,
      lng,
      url: FUNVISIS_URL,
      source: 'funvisis',
    })
  }
  return out
}

// Correlación: dos catálogos ven el MISMO sismo si coinciden en tiempo (~90 s,
// FUNVISIS solo da resolución de minuto) y epicentro (~0.5° ≈ 55 km). Si se
// solapan gana USGS (id oficial, página, ShakeMap, pronóstico); FUNVISIS solo
// aporta lo que USGS no tiene. Devuelve la unión, más nuevo primero.
// ponytail: caja en grados, no haversine; sobra para correlación gruesa. Subir
// a haversine solo si aparecen falsos pares cerca de la frontera del bbox.
const SAME_TIME_MS = 90_000
const SAME_DIST_DEG = 0.5

export function mergeQuakes(usgs: Quake[], funvisis: Quake[]): Quake[] {
  const extra = funvisis.filter(
    (fv) =>
      !usgs.some(
        (u) =>
          Math.abs(u.time - fv.time) <= SAME_TIME_MS &&
          Math.abs(u.lat - fv.lat) <= SAME_DIST_DEG &&
          Math.abs(u.lng - fv.lng) <= SAME_DIST_DEG,
      ),
  )
  return [...usgs, ...extra].sort((a, b) => b.time - a.time)
}

// Procedencia: cada dato publicado debe ser público y comprobable. Construimos
// las referencias en formato APA con su link. Las páginas /shakemap y
// /oaf/forecast son anclas estándar de la página de evento de USGS.
export type SourceRef = { key: string; cite: string; url: string }

export function buildSources(
  main: { mag: number; place: string; url: string; time: number } | null,
): SourceRef[] {
  const refs: SourceRef[] = []
  if (main?.url) {
    const year = new Date(main.time).getUTCFullYear()
    const title = `M ${main.mag.toFixed(1)} — ${main.place || 'Venezuela'}`
    refs.push(
      {
        key: 'usgs-event',
        cite: `U.S. Geological Survey. (${year}). ${title} [Conjunto de datos]. Earthquake Hazards Program.`,
        url: main.url,
      },
      {
        key: 'usgs-shakemap',
        cite: `U.S. Geological Survey. (${year}). ShakeMap: intensidad de sacudida (MMI), ${title}.`,
        url: `${main.url}/shakemap`,
      },
      {
        key: 'usgs-oaf',
        cite: `U.S. Geological Survey. (${year}). Pronóstico operacional de réplicas, ${title}.`,
        url: `${main.url}/oaf/forecast`,
      },
    )
  }
  refs.push(
    {
      key: 'funvisis',
      cite: 'FUNVISIS — Fundación Venezolana de Investigaciones Sismológicas. Sismicidad reciente.',
      url: 'http://www.funvisis.gob.ve/recientes.php',
    },
    {
      key: 'osm',
      cite: 'OpenStreetMap contributors. Cartografía base © OpenStreetMap.',
      url: 'https://www.openstreetmap.org/copyright',
    },
  )
  return refs
}
