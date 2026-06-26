import { getDb } from '../db'
import { ingestPerson } from './pipeline'
import { desaparecidosterremoto } from './sources/desaparecidosterremoto'
import { huellascan } from './sources/huellascan'
import type { Source } from './types'

// Añadir un scraper = escribir su módulo y meterlo aquí.
const SOURCES: Array<Source> = [desaparecidosterremoto, huellascan]

type SourceSummary = {
  source: string
  fetched: number
  inserted: number
  updated: number
  skipped: number
  reasons: Record<string, number>
  error?: string
}

// Paralelismo por fuente: las fotos y el geo se solapan entre personas.
// Mapbox va a ~500/min (el throttle de geocode.ts serializa los slots, ya no es
// el cuello de 1 req/s de Nominatim); el resto (fetch foto, R2 put, D1 writes)
// corre concurrentemente.
// ponytail: 10 workers caben cómodo en el límite de 1000 subrequests/invocación.
const CONCURRENCY = 10

// Corre todos los scrapers. Aísla fallos por fuente y por persona para que un
// registro malo no tumbe la corrida. Loguea un resumen (visible en wrangler
// tail) con los motivos de skip — así se afina el gazetteer con datos reales.
export async function runScrape(): Promise<Array<SourceSummary>> {
  const db = getDb()
  const summary: Array<SourceSummary> = []

  for (const source of SOURCES) {
    const s: SourceSummary = {
      source: source.id,
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      reasons: {},
    }
    try {
      const people = await source.fetchPeople()
      s.fetched = people.length
      const queue = [...people]
      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, people.length) },
          async () => {
            while (queue.length) {
              const p = queue.shift()!
              try {
                const r = await ingestPerson(db, source, p)
                if (r.kind === 'inserted') s.inserted++
                else if (r.kind === 'updated') s.updated++
                else {
                  s.skipped++
                  s.reasons[r.reason] = (s.reasons[r.reason] ?? 0) + 1
                }
              } catch {
                s.skipped++
                s.reasons.error = (s.reasons.error ?? 0) + 1
              }
            }
          },
        ),
      )
    } catch (e) {
      s.error = e instanceof Error ? e.message : String(e)
    }
    summary.push(s)
  }

  console.log('[scrape]', JSON.stringify(summary))
  return summary
}
