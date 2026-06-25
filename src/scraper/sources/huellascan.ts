import type { RawPerson, Source } from '../types'
import { backfillWindow } from './desaparecidosterremoto'

// Fuente: huellascan.com/terremoto — mascotas perdidas/encontradas del sismo.
// Es Laravel + Livewire (sin API JSON), pero el listado /ver-todos pagina por
// GET plano ?page=N, 20 cards/página, id descendente (el más nuevo arriba). No
// hace falta replicar el protocolo Livewire. Cada card trae el correlativo (id
// numérico) + nombre + ubicación en el bloque x-data share(), más foto, badge de
// estado (🔴 Perdido / 🟢 Encontrado) y teléfono. NO hay coordenadas: la
// ubicación es texto libre → la resuelve resolveGeo igual que desaparecidos.
const LIST = 'https://www.huellascan.com/terremoto/ver-todos'
const UA = 'AyudaVE-bot/0.1 (+https://ayudave.com; agregador de desaparecidos)'

// Páginas de backlog por corrida ADEMÁS de la página 1 (lo más nuevo). Cada alta
// baja foto + put R2, y comparte el techo de 1000 subrequests/invocación con los
// otros scrapers del cron (desaparecidos es el pesado). 2 → ~60 cards/corrida; a
// */2 barre las ~43 páginas del histórico en ~45 min. Subir si el log [scrape]
// queda verde, bajar si topa 1000. ponytail: cursor sin estado, aritmética del reloj.
const BACKFILL_PAGES = 2
const CRON_MS = 2 * 60 * 1000 // debe casar con triggers.crons en wrangler.jsonc

// Decodifica entidades HTML y escapes \uXXXX de los string-literales JS que la
// web mete dentro del atributo x-data (por eso vienen como &quot;…&quot;).
function decode(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&') // último: no re-decodificar entidades ya resueltas
    .trim()
}

const last = (s: string, re: RegExp): string | undefined => {
  const m = s.match(re)
  return m ? m[m.length - 1] : undefined
}

// Cuántas páginas tiene el listado: el máximo gotoPage(N) que pinta el paginador.
export function parsePageCount(html: string): number {
  let max = 1
  for (const m of html.matchAll(/gotoPage\((\d+)/g))
    max = Math.max(max, Number(m[1]))
  return max
}

// Extrae las mascotas de una página del listado. Cada card: id/nombre/ubicación
// del bloque share(), y foto/estado/teléfono del cuerpo que lo precede (la web
// pinta img → badge → teléfono → share en ese orden dentro de cada card, así que
// el trozo entre el share anterior y este const id es justo esta card).
export function parseCards(html: string): Array<RawPerson> {
  const out: Array<RawPerson> = []
  const re =
    /const id = (\d+);\s*const name = &quot;([\s\S]*?)&quot;;\s*const location = &quot;([\s\S]*?)&quot;;/g
  let prevEnd = 0
  for (const m of html.matchAll(re)) {
    const body = html.slice(prevEnd, m.index)
    prevEnd = m.index! + m[0].length
    const id = m[1]
    const badge = last(body, /🟢\s*Encontrad[oa]|🔴\s*Perdid[oa]/g) ?? ''
    const phone =
      (last(body, /wa\.me\/\d+/g) ?? last(body, /tel:\d+/g) ?? '').replace(
        /\D/g,
        '',
      ) || undefined
    out.push({
      externalId: id,
      name: decode(m[2]) || 'Mascota',
      status: /Encontrad/.test(badge) ? 'encontrado' : 'missing',
      photoUrl: last(
        body,
        /https:\/\/media\.huellascan\.com\/uploads\/earthquake\/[a-f0-9-]+\.webp/g,
      ),
      locationText: decode(m[3]) || undefined,
      contact: phone,
      sourceUrl: `https://www.huellascan.com/terremoto/${id}`,
    })
  }
  return out
}

// Una página del listado como HTML, con un reintento (la web es intermitente).
async function fetchPage(page: number): Promise<string | null> {
  const url = `${LIST}?page=${page}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, accept: 'text/html' },
        signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) return await res.text()
    } catch {
      // timeout/red: reintentamos una vez, luego nos rendimos con esta corrida
    }
  }
  return null
}

export const huellascan: Source = {
  id: 'huellascan',
  label: 'HuellaScan — Mascotas Terremoto',
  type: 'lostpet',
  async fetchPeople() {
    const out: Array<RawPerson> = []
    const first = await fetchPage(1)
    if (!first) return out // intermitencia: corta limpio
    out.push(...parseCards(first))
    const totalPages = parsePageCount(first)
    if (totalPages <= 1) return out

    // Ventana rotatoria sobre 2..totalPages (misma estrategia que desaparecidos).
    const runIndex = Math.floor(Date.now() / CRON_MS)
    for (const p of backfillWindow(totalPages, runIndex, BACKFILL_PAGES)) {
      const html = await fetchPage(p)
      if (html) out.push(...parseCards(html))
    }
    return out
  },
}
