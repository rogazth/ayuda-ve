import { and, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { media, reports } from '../db/schema'
import { storeImage } from './pipeline'
import {
  buildingToReport,
  fetchBuildings,
  SOURCE_ID,
} from './sources/terremotovenezuela'
import type { Building } from './sources/terremotovenezuela'

type Db = ReturnType<typeof getDb>

// Diferencia clave vs. el pipeline de personas: aquí la imagen NO es obligatoria
// (un colapso verificado sin foto igual es válido) y NO geocodificamos: geo buena
// = la que trae la fuente, o se salta. El throttle de Nominatim (1/s global) se
// reserva para personas (40k registros). Por eso es un ingest aparte.

type IngestResult =
  | { kind: 'inserted' }
  | { kind: 'updated' }
  | { kind: 'skipped'; reason: string }

async function storePhotos(db: Db, reportId: string, urls: Array<string>) {
  let pos = 0
  for (const url of urls) {
    const img = await storeImage(reportId, url)
    if (img) {
      await db.insert(media).values({ ...img, reportId, position: pos })
      pos++
    }
  }
}

async function ingestBuilding(db: Db, b: Building): Promise<IngestResult> {
  const mapped = buildingToReport(b)
  if (!mapped) return { kind: 'skipped', reason: 'geo' }
  const { report, photos } = mapped

  const existing = (
    await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.externalSource, SOURCE_ID),
          eq(reports.externalId, b.id),
        ),
      )
      .limit(1)
  ).at(0)

  if (existing) {
    await db.update(reports).set(report).where(eq(reports.id, existing.id))
    const hasMedia = (
      await db
        .select({ id: media.id })
        .from(media)
        .where(eq(media.reportId, existing.id))
        .limit(1)
    ).length
    if (!hasMedia) await storePhotos(db, existing.id, photos) // backfill si quedó sin foto
    return { kind: 'updated' }
  }

  const id = crypto.randomUUID()
  await db.insert(reports).values({ id, ...report })
  await storePhotos(db, id, photos) // best-effort: el reporte vale sin foto
  return { kind: 'inserted' }
}

// Corre el scraper de daños. Aísla fallos por edificio. Loguea resumen (wrangler
// tail). Independiente de runScrape() (personas): comparten tablas, nada más.
export async function runDamageScrape() {
  const db = getDb()
  const s = {
    source: SOURCE_ID,
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    reasons: {} as Record<string, number>,
    error: undefined as string | undefined,
  }
  const tally = (r: IngestResult) => {
    if (r.kind === 'inserted') s.inserted++
    else if (r.kind === 'updated') s.updated++
    else {
      s.skipped++
      s.reasons[r.reason] = (s.reasons[r.reason] ?? 0) + 1
    }
  }
  try {
    const buildings = await fetchBuildings()
    s.fetched = buildings.length
    // Lotes concurrentes: la descarga de fotos es el cuello de botella. CONC
    // mantiene ~5 descargas a la vez (gentil con el proxy de la fuente) y baja
    // el wall-clock por corrida ~5x. Cada edificio aísla su propio fallo.
    const CONC = 5
    for (let i = 0; i < buildings.length; i += CONC) {
      const batch = buildings.slice(i, i + CONC)
      const results = await Promise.all(
        batch.map((b) =>
          ingestBuilding(db, b).catch(
            (): IngestResult => ({ kind: 'skipped', reason: 'error' }),
          ),
        ),
      )
      results.forEach(tally)
    }
  } catch (e) {
    s.error = e instanceof Error ? e.message : String(e)
  }
  console.log('[scrape:damage]', JSON.stringify(s))
  return s
}
