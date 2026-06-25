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
