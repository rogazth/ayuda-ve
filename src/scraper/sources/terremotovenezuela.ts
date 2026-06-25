// Fuente: terremotovenezuela.com — daños estructurales del sismo. Es una app
// Supabase; consumimos su REST pública (PostgREST) directo, sin scrapear HTML.
// La key es "publishable"/anon: pública por diseño (viaja en su propio frontend).
const REST = 'https://jckifxsdlnsvbztxydes.supabase.co/rest/v1/buildings'
const KEY = 'sb_publishable_i7iEDrCVZcSt0k3RGFrY4g_WrtZBB4w'
const SELECT =
  'id,name,address,city,zone,lat,lng,damage_level,status,notes,general_source,casualties_notes,trapped_names,has_missing_persons,main_photo_url,media_urls'
const PAGE = 1000 // hoy hay ~718; paginamos por header Range por si crece

export const SOURCE_ID = 'terremotovenezuela'

// Edificio dañado, ya normalizado. lat/lng pueden ser null (la fuente marca
// "ubicación por confirmar"); el ingest las salta hasta que las geocodee.
export type Building = {
  id: string
  name: string
  address?: string
  city?: string
  zone?: string
  lat: number | null
  lng: number | null
  damageLevel?: string
  status?: string
  notes?: string
  generalSource?: string
  casualtiesNotes?: string
  trappedNames?: string
  hasMissingPersons: boolean
  mainPhotoUrl?: string
  mediaUrls: Array<string>
}

const str = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v)
  return s ? s : undefined
}

// Las fotos en la API apuntan al bucket PRIVADO de Supabase (`/object/public/
// damage-media/…` → 404 "Bucket not found"). La web las sirve por su propio
// proxy; reescribimos a esa ruta, que sí devuelve la imagen.
const MEDIA_PROXY = 'https://terremotovenezuela.com/api/public/media/'
export function proxyPhoto(v: unknown): string | undefined {
  const s = str(v)
  if (!s) return undefined
  const i = s.indexOf('/damage-media/')
  return i >= 0 ? MEDIA_PROXY + s.slice(i + '/damage-media/'.length) : s
}

function normalize(r: Record<string, unknown>): Building | null {
  const id = str(r.id)
  const name = str(r.name)
  if (!id || !name) return null
  return {
    id,
    name,
    address: str(r.address),
    city: str(r.city),
    zone: str(r.zone),
    lat: typeof r.lat === 'number' ? r.lat : null,
    lng: typeof r.lng === 'number' ? r.lng : null,
    damageLevel: str(r.damage_level),
    status: str(r.status),
    notes: str(r.notes),
    generalSource: str(r.general_source),
    casualtiesNotes: str(r.casualties_notes),
    trappedNames: str(r.trapped_names),
    hasMissingPersons: r.has_missing_persons === true,
    mainPhotoUrl: proxyPhoto(r.main_photo_url),
    mediaUrls: Array.isArray(r.media_urls)
      ? r.media_urls.map(proxyPhoto).filter((x): x is string => !!x)
      : [],
  }
}

export async function fetchBuildings(): Promise<Array<Building>> {
  const out: Array<Building> = []
  // ponytail: orden por last_updated_at puede mover filas entre páginas, pero
  // hoy todo entra en una; el tope es solo defensa si la tabla crece >PAGE.
  for (let offset = 0; offset < 50000; offset += PAGE) {
    const res = await fetch(
      `${REST}?select=${SELECT}&order=last_updated_at.desc`,
      {
        headers: {
          apikey: KEY,
          'accept-profile': 'public',
          'Range-Unit': 'items',
          Range: `${offset}-${offset + PAGE - 1}`,
        },
      },
    )
    if (!res.ok) break
    const rows = (await res.json())
    if (!Array.isArray(rows) || rows.length === 0) break
    for (const r of rows) {
      const b = normalize(r as Record<string, unknown>)
      if (b) out.push(b)
    }
    if (rows.length < PAGE) break
  }
  return out
}

// Mapea un edificio a los campos del reporte, o null si hay que saltarlo (sin
// coords reales — las null se "auto-curan" cuando la fuente las geocodea). Pura
// y sin imports de Worker/DB: vive aquí para poder testearla en node.
export function buildingToReport(b: Building) {
  if (b.lat == null || b.lng == null) return null
  const photos = [
    ...new Set(
      [b.mainPhotoUrl, ...b.mediaUrls].filter((u): u is string => !!u),
    ),
  ]
  const meta = JSON.stringify({
    source: b.generalSource,
    damageLevel: b.damageLevel,
    address: b.address,
    zone: b.zone,
    casualties: b.casualtiesNotes,
    trapped: b.trappedNames,
    hasMissingPersons: b.hasMissingPersons,
  })
  return {
    photos,
    report: {
      type: 'danger' as const,
      title: b.name,
      description: b.notes ?? '',
      contact: null,
      url: 'https://terremotovenezuela.com',
      status: 'visible' as const,
      verified: b.status === 'verificado',
      meta,
      externalSource: SOURCE_ID,
      externalId: b.id,
      lat: b.lat,
      lng: b.lng,
      // Re-estampado cada corrida: el mapa filtra a 48h; mientras la fuente lo
      // liste se mantiene fresco; si lo quita, envejece y cae solo.
      createdAt: new Date(),
    },
  }
}
