// ponytail: SW mínimo, solo para que la PWA sea instalable. Sin precaching ni
// offline (no pedido). El handler de fetch existe para cumplir el criterio de
// instalación; ya queda registrado para colgarle el evento `push` después.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
