import type { RawPerson, Source } from '../types'

// Fuente: desaparecidosterremotovenezuela.com — desaparecidos del sismo. Tiene
// API REST pública propia (la que consume su frontend) con paginación de verdad,
// id estable por persona y fotos directas en S3. Reemplaza a venezuelatebusca,
// cuya paginación estaba rota y la web degradaba a 0.
const API = 'https://desaparecidos-terremoto-api.theempire.tech/api/personas'
const UA = 'AyudaVE-bot/0.1 (+https://ayudave.com; agregador de desaparecidos)'

// El orden por defecto de la API es createdAt desc (más recientes primero), que
// es justo la prioridad en una emergencia. Traemos las N más nuevas por corrida;
// el cron (cada 5 min) + el re-estampado de createdAt + la ventana de 48h del
// mapa mantienen el flujo fresco. Hay ~41k en total: NO caben todas a la vez en
// el modelo re-estampar+48h (re-estampar 41k/corrida no entra en presupuesto).
// ponytail: para barrer el backlog histórico haría falta un cursor persistente;
// YAGNI hasta que pidan backfill. Knobs: subir MAX_PAGES trae más por corrida
// (techo real = 1000 subrequests/invocación + Nominatim 1/s en misses de geo).
const PAGE_SIZE = 100
const MAX_PAGES = 3

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
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await fetchPage(page)
      if (!data?.items?.length) break // intermitencia o fin: corta limpio
      for (const it of data.items) {
        const rp = normalize(it)
        if (rp) out.push(rp)
      }
      if (data.totalPages && page >= data.totalPages) break
    }
    return out
  },
}
