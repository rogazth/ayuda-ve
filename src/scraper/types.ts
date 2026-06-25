// Forma normalizada de una persona, común a todos los scrapers. Cada fuente
// traduce su payload crudo a esto; el pipeline no sabe de dónde vino.
export type RawPerson = {
  externalId: string // id estable en la fuente (para upsert)
  name: string
  status: string // crudo; el pipeline mapea found/encontrado → oculto
  photoUrl?: string
  state?: string // estado venezolano, si la fuente lo da aparte
  locationText?: string // texto libre de ubicación (ciudad, sector…)
  description?: string
  contact?: string
  age?: number
  gender?: string
  lastSeen?: string
  sourceUrl?: string // link a la ficha original (atribución)
  extra?: Record<string, unknown> // campos extra de la fuente, van a meta
}

// Un scraper. Añadir uno = escribir el módulo y meterlo en SOURCES (run.ts).
export type Source = {
  id: string // ej. 'venezuelatebusca' — se guarda en reports.external_source
  label: string
  fetchPeople: () => Promise<Array<RawPerson>>
}
