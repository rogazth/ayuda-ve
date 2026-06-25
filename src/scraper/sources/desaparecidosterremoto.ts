import type { RawPerson, Source } from '../types'

// Fuente: desaparecidosterremotovenezuela.com — desaparecidos del sismo. Tiene
// API REST pública propia (la que consume su frontend) con paginación de verdad,
// id estable por persona y fotos directas en S3. Reemplaza a venezuelatebusca,
// cuya paginación estaba rota y la web degradaba a 0.
const API = 'https://desaparecidos-terremoto-api.theempire.tech/api/personas'
const UA = 'AyudaVE-bot/0.1 (+https://ayudave.com; agregador de desaparecidos)'

// El orden por defecto de la API es createdAt desc (más recientes primero). Cada
// corrida trae la página 1 (lo más nuevo, flujo en vivo) MÁS un bloque rotatorio
// de páginas profundas que avanza con el reloj → barre las ~48k del backlog en
// vez de quedarse clavado en el tope. Ya no re-estampamos createdAt ni filtramos
// missing a 48h (ver pipeline.ts y reports.functions.ts): los descubiertos se
// quedan, los localizados se ocultan en el siguiente barrido.
const PAGE_SIZE = 100
// Páginas de backlog por corrida, ADEMÁS de la página 1. El backlog son altas
// (descarga foto + put R2 por persona), más pesado que re-scrapear el tope, así
// que el techo real es 1000 subrequests/invocación + Nominatim 1/s en lugares
// nuevos. 2 → ~300 personas/corrida (~600 subrequests peor caso); a */2 barre las
// ~482 páginas en ~8h. Subir si el log [scrape] queda verde; bajar si topa 1000.
// ponytail: cursor sin estado — aritmética sobre el tiempo, cero tabla/KV/migración.
const BACKFILL_PAGES = 2
const CRON_MS = 2 * 60 * 1000 // debe casar con triggers.crons en wrangler.jsonc

type Item = {
  id?: unknown
  nombre?: unknown
  edad?: unknown
  ubicacion?: unknown
  fecha?: unknown
  descripcion?: unknown
  contacto?: unknown
  foto?: unknown
  estado?: unknown // 'sin-contacto' | 'localizado'
  reportes?: unknown
}
type Payload = { items?: Array<Item>; totalPages?: number }

const str = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v)
  return s ? s : undefined
}

export function normalize(it: Item): RawPerson | null {
  const externalId = str(it.id)
  const name = str(it.nombre)
  if (!externalId || !name) return null // sin id/nombre no hay nada que mapear
  // El pipeline oculta a los encontrados por regex /encontrad|hallad/. La API
  // marca 'localizado', que no matchea: lo traducimos para que se oculten (y los
  // que ya teníamos como visibles pasen a hidden cuando los localicen).
  const status = str(it.estado) === 'localizado' ? 'encontrado' : 'missing'
  const edad = typeof it.edad === 'number' ? it.edad : Number(str(it.edad))
  const fecha = str(it.fecha)
  return {
    externalId,
    name,
    status,
    photoUrl: str(it.foto),
    locationText: str(it.ubicacion),
    description: str(it.descripcion),
    contact: str(it.contacto),
    age: Number.isFinite(edad) && edad > 0 ? edad : undefined,
    lastSeen: fecha,
    sourceUrl: 'https://desaparecidosterremotovenezuela.com',
    extra: { fecha, estado: str(it.estado) },
  }
}

// Una página, con un reintento: la API es intermitente (timeouts aleatorios).
async function fetchPage(page: number): Promise<Payload | null> {
  const url = `${API}?page=${page}&pageSize=${PAGE_SIZE}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(20_000), // que un page colgado no wedge el cron
      })
      if (res.ok) return (await res.json()) as Payload
    } catch {
      // timeout/red: reintentamos una vez, luego nos rendimos con esta corrida
    }
  }
  return null
}

export const desaparecidosterremoto: Source = {
  id: 'desaparecidosterremoto',
  label: 'Desaparecidos Terremoto Venezuela',
  async fetchPeople() {
    const out: Array<RawPerson> = []
    const collect = (data: Payload) => {
      for (const it of data.items ?? []) {
        const rp = normalize(it)
        if (rp) out.push(rp)
      }
    }

    // Página 1 siempre: los desaparecidos más recientes entran de inmediato y
    // nos da totalPages para situar el cursor.
    const first = await fetchPage(1)
    if (!first?.items?.length) return out // intermitencia o vacío: corta limpio
    collect(first)
    const totalPages = first.totalPages ?? 1
    if (totalPages <= 1) return out

    // Ventana rotatoria sobre las páginas 2..totalPages. Cubre todo el backlog
    // cada ceil(span/BACKFILL_PAGES) corridas y reinicia (re-chequea estados).
    const runIndex = Math.floor(Date.now() / CRON_MS)
    for (const p of backfillWindow(totalPages, runIndex, BACKFILL_PAGES)) {
      const data = await fetchPage(p)
      if (data?.items?.length) collect(data)
    }
    return out
  },
}

// Páginas profundas (2..totalPages) a barrer en la corrida `runIndex`. Bloques
// contiguos de `perRun` que avanzan una posición por corrida → en numBlocks
// corridas cubren todo sin huecos y reinician. Contiguo a propósito: un stride
// con módulo par se saltaría la mitad de las páginas. Pura para poder testearla.
export function backfillWindow(totalPages: number, runIndex: number, perRun: number): Array<number> {
  if (totalPages <= 1) return []
  const numBlocks = Math.ceil((totalPages - 1) / perRun)
  const block = ((runIndex % numBlocks) + numBlocks) % numBlocks
  const start = 2 + block * perRun
  const pages: Array<number> = []
  for (let p = start; p < start + perRun && p <= totalPages; p++) pages.push(p)
  return pages
}
