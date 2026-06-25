import { expect, test } from 'vitest'
import {
  backfillWindow,
  normalize as normalizePerson,
} from './sources/desaparecidosterremoto'
import { parseCards, parsePageCount } from './sources/huellascan'
import { geocode } from './gazetteer'
import { imageSize } from './image'
import {
  type Building,
  buildingToReport,
  proxyPhoto,
} from './sources/terremotovenezuela'

const building = (over: Partial<Building> = {}): Building => ({
  id: 'b1',
  name: 'Edificio Lander',
  lat: 10.5,
  lng: -66.9,
  status: 'verificado',
  damageLevel: 'severo',
  hasMissingPersons: false,
  mediaUrls: [],
  ...over,
})

test('buildingToReport salta los edificios sin coords', () => {
  expect(buildingToReport(building({ lat: null }))).toBeNull()
  expect(buildingToReport(building({ lng: null }))).toBeNull()
})

test('buildingToReport mapea a tipo danger, verified y meta de daño', () => {
  const m = buildingToReport(building({ generalSource: 'Medios' }))!
  expect(m.report.type).toBe('danger')
  expect(m.report.verified).toBe(true)
  expect(m.report.externalSource).toBe('terremotovenezuela')
  const meta = JSON.parse(m.report.meta)
  expect(meta.damageLevel).toBe('severo')
  expect(meta.source).toBe('Medios')
})

test('buildingToReport dedup fotos con la principal primero', () => {
  const x = 'https://x/a.jpg'
  const m = buildingToReport(
    building({ mainPhotoUrl: x, mediaUrls: [x, 'https://x/b.jpg'] }),
  )!
  expect(m.photos).toEqual([x, 'https://x/b.jpg'])
})

test('proxyPhoto reescribe el bucket privado de Supabase al proxy de la web', () => {
  expect(
    proxyPhoto(
      'https://x.supabase.co/storage/v1/object/public/damage-media/reports/abc.jpg',
    ),
  ).toBe('https://terremotovenezuela.com/api/public/media/reports/abc.jpg')
  expect(proxyPhoto(null)).toBeUndefined()
})

test('normalize (desaparecidos) mapea campos y exige id+nombre', () => {
  expect(normalizePerson({ nombre: 'Ana' })).toBeNull() // sin id
  expect(normalizePerson({ id: 'p1' })).toBeNull() // sin nombre
  const p = normalizePerson({
    id: 'p1',
    nombre: 'Ana Pérez',
    edad: 26,
    ubicacion: 'La guaira',
    fecha: '2026-06-24',
    foto: 'https://x/a.jpg',
    estado: 'sin-contacto',
  })!
  expect(p.status).toBe('missing')
  expect(p.age).toBe(26)
  expect(p.locationText).toBe('La guaira')
  expect(p.lastSeen).toBe('2026-06-24')
})

test('normalize traduce localizado → encontrado (el pipeline lo oculta)', () => {
  const p = normalizePerson({ id: 'p1', nombre: 'Ana', estado: 'localizado' })!
  expect(p.status).toBe('encontrado')
  expect(/encontrad|hallad/i.test(p.status)).toBe(true)
})

// Fixture: 2 cards con la estructura real de huellascan (img → badge → tel →
// bloque share con &quot; e id/nombre/ubicación), una Perdida y una Encontrada.
const HUELLASCAN_HTML = `
  <button wire:click="gotoPage(3, 'page')">3</button>
  <img src="https://media.huellascan.com/uploads/earthquake/aaaa1111-2222-3333-4444-555566667777.webp">
  <span>🔴 Perdido</span>
  <a href="https://wa.me/04123456789">WhatsApp</a>
  <div x-data="{ share() {
    const id = 101;
    const name = &quot;Mish\\u00ed&quot;;
    const location = &quot;Catia la mar&quot;;
  } }"></div>
  <img src="https://media.huellascan.com/uploads/earthquake/8888aaaa-bbbb-cccc-dddd-eeeeffff0000.webp">
  <span>🟢 Encontrado</span>
  <a href="https://wa.me/04147778899">WhatsApp</a>
  <div x-data="{ share() {
    const id = 100;
    const name = &quot;&quot;;
    const location = &quot;&quot;;
  } }"></div>
`

test('parseCards mapea id/nombre/ubicación/foto/contacto y decodifica \\u y &quot;', () => {
  const cards = parseCards(HUELLASCAN_HTML)
  expect(cards.length).toBe(2)
  expect(cards[0]).toMatchObject({
    externalId: '101',
    name: 'Mishí', // í decodificado
    status: 'missing',
    locationText: 'Catia la mar',
    contact: '04123456789',
    sourceUrl: 'https://www.huellascan.com/terremoto/101',
  })
  expect(cards[0].photoUrl).toContain('aaaa1111')
})

test('parseCards: badge 🟢 → encontrado (el pipeline lo da de baja) y nombre vacío → Mascota', () => {
  const c = parseCards(HUELLASCAN_HTML)[1]
  expect(c.status).toBe('encontrado')
  expect(/encontrad|hallad/i.test(c.status)).toBe(true) // matchea el regex del pipeline
  expect(c.name).toBe('Mascota') // sin nombre no rompe el alta
  expect(c.photoUrl).toContain('8888aaaa') // foto correcta de su propia card
})

test('parsePageCount lee el máximo gotoPage del paginador', () => {
  expect(parsePageCount(HUELLASCAN_HTML)).toBe(3)
  expect(parsePageCount('<div>sin paginador</div>')).toBe(1)
})

test('backfillWindow cubre 2..totalPages sin huecos en un ciclo (span par incluido)', () => {
  for (const totalPages of [25, 21, 482, 2]) {
    const perRun = 2
    const numBlocks = Math.ceil((totalPages - 1) / perRun)
    const seen = new Set<number>()
    for (let run = 0; run < numBlocks; run++)
      for (const p of backfillWindow(totalPages, run, perRun)) seen.add(p)
    for (let p = 2; p <= totalPages; p++) expect(seen.has(p)).toBe(true) // sin huecos
    expect([...seen].every((p) => p >= 2 && p <= totalPages)).toBe(true) // nunca fuera de rango
  }
  expect(backfillWindow(1, 99, 2)).toEqual([]) // sin backlog
})

test('normalize descarta edad inválida (null o 0)', () => {
  expect(
    normalizePerson({ id: 'p1', nombre: 'Ana', edad: null })!.age,
  ).toBeUndefined()
  expect(
    normalizePerson({ id: 'p1', nombre: 'Ana', edad: 0 })!.age,
  ).toBeUndefined()
})

test('geocode matchea ciudad con precisión city', () => {
  const g = geocode('Lara', 'Barquisimeto centro')!
  expect(g.precision).toBe('city')
  expect(g.lat).toBeCloseTo(10.06, 1)
  expect(g.lng).toBeCloseTo(-69.34, 1)
})

test('geocode cae a estado (precisión gruesa) sin ciudad', () => {
  const g = geocode('Zulia', 'algún sector sin nombre conocido')!
  expect(g.precision).toBe('state')
  expect(g.lat).toBeCloseTo(10.64, 1) // Maracaibo
})

test('geocode ignora acentos y usa límite de palabra', () => {
  expect(geocode(undefined, 'San Cristóbal')!.precision).toBe('city')
  // "Cua" no debe colarse dentro de otra palabra
  expect(geocode(undefined, 'Evacuaron la zona')).toBeNull()
})

test('geocode devuelve null si no reconoce nada', () => {
  expect(geocode('Narnia', 'Ciudad Esmeralda')).toBeNull()
})

test('imageSize lee PNG y JPEG por la cabecera', () => {
  // PNG: firma + IHDR con width=640 (0x0280) height=400 (0x0190) big-endian
  const png = new Uint8Array(24)
  png.set([0x89, 0x50, 0x4e, 0x47], 0)
  new DataView(png.buffer).setUint32(16, 640)
  new DataView(png.buffer).setUint32(20, 400)
  expect(imageSize(png)).toEqual({ width: 640, height: 400 })

  // JPEG: SOI + SOF0 con height=400 width=640 (big-endian tras precisión)
  const jpg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x90, 0x02, 0x80,
  ])
  expect(imageSize(jpg)).toEqual({ width: 640, height: 400 })

  expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull()
})
