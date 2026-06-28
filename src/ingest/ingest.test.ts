import { expect, test } from 'vitest'
import {
  checkAuth,
  insertValues,
  mapStatus,
  mediaToReplace,
  parseIngestBody,
  parseIngestRecord,
  resolveStatus,
  timingSafeEqual,
  updateValues,
} from './ingest'

const rec = (over: Record<string, unknown> = {}) => ({
  externalSource: 'desaparecidosterremoto',
  externalId: '123',
  type: 'missing',
  title: 'Juan Pérez',
  lat: 10.6,
  lng: -66.9,
  status: 'missing',
  media: [],
  meta: { missingName: 'Juan Pérez', location: 'La Guaira' },
  ...over,
})

test('mapStatus mapea variantes de encontrado → found', () => {
  expect(mapStatus('encontrado')).toBe('found')
  expect(mapStatus('localizado')).toBe('found')
  expect(mapStatus('FOUND')).toBe('found')
  expect(mapStatus('missing')).toBe('visible')
  expect(mapStatus('')).toBe('visible')
})

test('resolveStatus nunca revive un hidden', () => {
  expect(resolveStatus('hidden', 'visible')).toBe('hidden')
  expect(resolveStatus('hidden', 'found')).toBe('hidden')
  expect(resolveStatus('visible', 'found')).toBe('found')
  expect(resolveStatus('visible', 'visible')).toBe('visible')
  expect(resolveStatus('found', 'visible')).toBe('visible')
})

test('updateValues no toca confirms/flags/appeared/creatorIp/createdAt', () => {
  const r = parseIngestRecord(rec())
  if (!r.ok) throw new Error(r.error)
  const v = updateValues(r.value, 'visible')
  const keys = Object.keys(v)
  for (const owned of ['confirms', 'flags', 'appeared', 'creatorIp', 'createdAt', 'id'])
    expect(keys).not.toContain(owned)
  // sí escribe lo del origen
  for (const src of ['title', 'lat', 'lng', 'status', 'meta', 'verified'])
    expect(keys).toContain(src)
})

test('updateValues respeta hidden vía resolveStatus', () => {
  const r = parseIngestRecord(rec({ status: 'found' }))
  if (!r.ok) throw new Error(r.error)
  expect(updateValues(r.value, 'hidden').status).toBe('hidden')
  expect(updateValues(r.value, 'visible').status).toBe('found')
})

test('insertValues no incluye id (lo pone el caller) y serializa meta', () => {
  const r = parseIngestRecord(rec())
  if (!r.ok) throw new Error(r.error)
  const v = insertValues(r.value)
  expect(v).not.toHaveProperty('id')
  expect(JSON.parse(v.meta).missingName).toBe('Juan Pérez')
  expect(v.externalSource).toBe('desaparecidosterremoto')
})

test('mediaToReplace: vacío preserva (null), no vacío es autoritativo', () => {
  expect(mediaToReplace([])).toBeNull()
  const m = [{ key: 'ingest/x/1.jpg', contentType: 'image/jpeg', width: 10, height: 10, position: 0 }]
  expect(mediaToReplace(m)).toEqual(m)
})

test('parseIngestRecord rechaza payloads inválidos', () => {
  expect(parseIngestRecord(rec({ type: 'offer' })).ok).toBe(false) // tipo fuera de ingest
  expect(parseIngestRecord(rec({ lat: 'x' })).ok).toBe(false)
  expect(parseIngestRecord(rec({ lat: 200 })).ok).toBe(false)
  expect(parseIngestRecord(rec({ externalId: '' })).ok).toBe(false)
  expect(parseIngestRecord(rec({ title: '' })).ok).toBe(false)
})

test('parseIngestRecord sanea url y mete sourceCreatedAt en meta', () => {
  const r = parseIngestRecord(rec({ url: 'javascript:alert(1)', sourceCreatedAt: '2026-06-27T00:00:00Z' }))
  if (!r.ok) throw new Error(r.error)
  expect(r.value.url).toBeUndefined() // javascript: bloqueado por safeUrl
  expect(r.value.meta.sourceCreatedAt).toBe('2026-06-27T00:00:00Z')
})

test('parseIngestRecord valida media', () => {
  const bad = parseIngestRecord(rec({ media: [{ key: 'k', contentType: 'text/html', width: 1, height: 1, position: 0 }] }))
  expect(bad.ok).toBe(false)
  const ok = parseIngestRecord(rec({ media: [{ key: 'ingest/s/1.jpg', contentType: 'image/webp', width: 100, height: 80, position: 0 }] }))
  expect(ok.ok).toBe(true)
})

test('parseIngestBody valida el sobre y propaga el índice del record malo', () => {
  expect(parseIngestBody({}).ok).toBe(false)
  expect(parseIngestBody({ records: [] }).ok).toBe(false)
  const r = parseIngestBody({ records: [rec(), rec({ lat: 999 })] })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.error).toContain('record[1]')
  expect(parseIngestBody({ records: [rec()] }).ok).toBe(true)
})

test('checkAuth: fail-closed, bearer y allowlist de IP', () => {
  const base = { key: 'secret', allowed: '1.2.3.4, 5.6.7.8' }
  // fail-closed sin config
  expect(checkAuth({ authHeader: 'Bearer secret', ip: '1.2.3.4' })).toMatchObject({ status: 503 })
  // bearer malo
  expect(checkAuth({ ...base, authHeader: 'Bearer nope', ip: '1.2.3.4' })).toMatchObject({ status: 401 })
  // ip fuera de la lista
  expect(checkAuth({ ...base, authHeader: 'Bearer secret', ip: '9.9.9.9' })).toMatchObject({ status: 403 })
  // ok
  expect(checkAuth({ ...base, authHeader: 'Bearer secret', ip: '5.6.7.8' })).toEqual({ ok: true })
})

test('timingSafeEqual', () => {
  expect(timingSafeEqual('abc', 'abc')).toBe(true)
  expect(timingSafeEqual('abc', 'abd')).toBe(false)
  expect(timingSafeEqual('abc', 'abcd')).toBe(false)
})
