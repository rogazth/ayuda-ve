import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy, useEffect, useState } from 'react'

export const Route = createFileRoute('/')({ component: App })

// Leaflet toca window: el mapa es cliente puro. lazy() evita importarlo en SSR.
const MapScreen = lazy(() => import('../components/map/map-screen'))

function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return <Splash />
  return (
    <Suspense fallback={<Splash />}>
      <MapScreen />
    </Suspense>
  )
}

function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center text-sea-ink-soft">
      Cargando mapa…
    </div>
  )
}
