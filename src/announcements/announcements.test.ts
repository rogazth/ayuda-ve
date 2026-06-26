import { expect, test } from 'vitest'
import { cleanAnnouncement } from './announcements'

test('cleanAnnouncement normaliza y rechaza basura', () => {
  const ok = cleanAnnouncement({
    category: 'conectividad',
    title: ' Punto Starlink ',
    body: ' gratis hasta las 6pm ',
    contact: ' 0212-555 ',
    url: 'https://instagram.com/foo',
  })
  expect(ok).toMatchObject({
    category: 'conectividad',
    title: 'Punto Starlink',
    body: 'gratis hasta las 6pm',
    contact: '0212-555',
    url: 'https://instagram.com/foo',
  })

  // url no http(s) → safeUrl la descarta
  expect(cleanAnnouncement({ category: 'salud', title: 'x', url: 'javascript:alert(1)' }).url).toBeNull()
  // opcionales vacíos → body '' / contact null
  const bare = cleanAnnouncement({ category: 'salud', title: 'x' })
  expect(bare.body).toBe('')
  expect(bare.contact).toBeNull()

  expect(() => cleanAnnouncement({ category: 'hacker', title: 'x' })).toThrow()
  expect(() => cleanAnnouncement({ category: 'salud', title: '   ' })).toThrow()
})
