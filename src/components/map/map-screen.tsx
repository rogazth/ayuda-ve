import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixed, Phone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtAge, typeOf } from '../../reports/reports'
import { fetchReportsInBounds } from '../../reports/reports.functions'
import { reverseEstado } from '../../geo/geo.functions'
import { fetchQuakes } from '../../quakes/quakes.functions'
import type { Quake, QuakeData, MmiContours } from '../../quakes/quakes.functions'
import { VE_BOUNDS, esPlace, inVenezuela, magColor } from '../../quakes/quakes'
import type { Pin, View, Data } from './types'
import { QuakeDrawer } from './quake-drawer'
import { HelpDialog } from './help-dialog'

// Renderiza los contornos MMI como anillos (evenodd) en canvas → imageOverlay.
// Cada zona se pinta UNA sola vez (outer contour - inner contour) → sin opacidad apilada.
// El bbox se deriva de los datos → sin bordes rectangulares.
function ShakemapLayer({ shakemap }: { shakemap: MmiContours }) {
  const map = useMap()
  useEffect(() => {
    // Bbox de todos los contornos
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
    for (const f of shakemap.features) {
      for (const line of f.geometry.coordinates) {
        for (const [lng, lat] of line as [number, number][]) {
          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        }
      }
    }

    const W = 512
    const H = Math.round(W * (maxLat - minLat) / (maxLng - minLng))
    const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * W
    const toY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * H

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Cada zona se pinta como anillo (outer - inner) con evenodd para no apilar capas.
    // Ordenado por MMI ascendente: sorted[i] es el outer, sorted[i+1] el inner cutout.
    const sorted = [...shakemap.features].sort((a, b) => a.properties.value - b.properties.value)
    const drawContour = (f: MmiContours['features'][number]) => {
      for (const line of f.geometry.coordinates) {
        const coords = line as [number, number][]
        ctx.moveTo(toX(coords[0][0]), toY(coords[0][1]))
        for (let i = 1; i < coords.length; i++)
          ctx.lineTo(toX(coords[i][0]), toY(coords[i][1]))
        ctx.closePath()
      }
    }
    for (let i = 0; i < sorted.length; i++) {
      ctx.beginPath()
      drawContour(sorted[i])
      if (i + 1 < sorted.length) drawContour(sorted[i + 1]) // recorta el interior
      const hex = sorted[i].properties.color || '#888'
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      ctx.fillStyle = `rgba(${r},${g},${b},0.5)`
      ctx.fill('evenodd')
    }

    const overlay = L.imageOverlay(canvas.toDataURL(), [[minLat, minLng], [maxLat, maxLng]])
    overlay.addTo(map)
    return () => { overlay.remove() }
  }, [map, shakemap])
  return null
}

const DEFAULT_ZOOM = 15
const MIN_ZOOM = 12 // bajo esto el bbox es medio país: no cargamos

const VE_MAX_BOUNDS: L.LatLngBoundsExpression = [
  [VE_BOUNDS.minLat - 0.5, VE_BOUNDS.minLng - 0.5],
  [VE_BOUNDS.maxLat + 0.5, VE_BOUNDS.maxLng + 0.5],
]

// Arranque directo en la zona del terremoto. Cacheamos el último epicentro en
// localStorage para abrir exacto en visitas siguientes.
const QUAKE_ZONE: [number, number] = [10.4, -68.5]
const QUAKE_ZOOM = 7
const EPI_KEY = 'ave-epi'
function seedCenter(): [number, number] {
  try {
    const s = localStorage.getItem(EPI_KEY)
    if (s) return JSON.parse(s) as [number, number]
  } catch {
    /* sin localStorage: usamos la zona conocida */
  }
  return QUAKE_ZONE
}

function pinIcon(p: Pin) {
  const t = typeOf(p.type)
  const cnt =
    p.confirms > 0
      ? `<span class="absolute -top-[6px] -right-[8px] bg-[#1a1c1e] text-white text-[11px] font-bold min-w-[19px] h-[19px] rounded-[10px] grid place-items-center px-[5px] border-2 border-white">${p.confirms}</span>`
      : ''
  return L.divIcon({
    className: '!bg-none !border-none',
    html: `<div class="relative w-[38px] h-[38px] [filter:drop-shadow(0_4px_4px_rgba(0,0,0,0.28))]"><div class="w-[38px] h-[38px] rounded-[50%_50%_50%_0] -rotate-45 grid place-items-center border-[2.5px] border-white [&_svg]:rotate-45 [&_svg]:w-[19px] [&_svg]:h-[19px]" style="background:${t.color}"><svg viewBox="0 0 24 24">${t.svg}</svg></div>${cnt}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 40],
  })
}

const youIcon = L.divIcon({
  className: '!bg-none !border-none',
  html: '<div class="relative w-[18px] h-[18px]"><span class="absolute inset-[-15px] rounded-full bg-[rgba(47,123,214,0.16)]"></span><span class="absolute inset-0 rounded-full bg-[#2f7bd6] border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.35)]"></span></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function quakeIcon(q: Quake, main: boolean) {
  const size = Math.max(14, Math.round(q.mag * 6))
  const ripple = main
    ? " before:content-[''] before:absolute before:inset-0 before:rounded-full before:border-2 before:border-[color:var(--c)] before:animate-epi-ripple before:motion-reduce:animate-none after:content-[''] after:absolute after:inset-0 after:rounded-full after:border-2 after:border-[color:var(--c)] after:animate-epi-ripple after:[animation-delay:1.3s] after:motion-reduce:animate-none"
    : ''
  return L.divIcon({
    className: '!bg-none !border-none',
    html: `<span class="block rounded-full bg-[var(--c)] shadow-[0_0_0_2px_#fff,0_1px_4px_rgba(0,0,0,0.35)] relative${ripple}" style="--c:${magColor(q.mag)};width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function rectTop(sel: string, fallback: number) {
  const el = document.querySelector(sel)
  return el ? el.getBoundingClientRect().top : fallback
}
function rectBottom(sel: string) {
  const el = document.querySelector(sel)
  return el ? el.getBoundingClientRect().bottom : 0
}

// Centra el epicentro en la franja de mapa visible: entre el borde inferior del
// banner y el tope real de la hoja. Se mide del DOM porque las fracciones del
// viewport no sirven — en iOS Safari el contenedor del mapa (fixed inset:0) se
// extiende detrás de la barra del navegador, así que getSize() ≠ pantalla visible.
// El contenedor arranca en y=0, igual que los getBoundingClientRect → mismo eje.
function centerAboveSheet(map: L.Map, lat: number, lng: number, zoom: number) {
  map.setView([lat, lng], zoom, { animate: false })
  const top = rectBottom('.ave-quakebar')
  const bottom = rectTop('.ave-drawer', map.getSize().y)
  const lift = map.getSize().y / 2 - (top + bottom) / 2
  if (lift !== 0) map.panBy([0, Math.round(lift)], { animate: false })
}

// Vive dentro del MapContainer: tiene el mapa, dispara fetch por bbox (debounced) y GPS.
function MapController({
  view,
  onData,
  onUser,
  onMap,
}: {
  view: View
  onData: (d: Data) => void
  onUser: (pos: [number, number]) => void
  onMap: (map: L.Map) => void
}) {
  const map = useMap()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqId = useRef(0)

  const load = useCallback(() => {
    const c = map.getCenter()
    const center: [number, number] = [c.lat, c.lng]
    if (view !== 'reportes') {
      onData({ pins: [], center, tooFar: false })
      return
    }
    if (map.getZoom() < MIN_ZOOM) {
      onData({ pins: [], center, tooFar: true })
      return
    }
    const b = map.getBounds()
    const id = ++reqId.current
    fetchReportsInBounds({
      data: { s: b.getSouth(), n: b.getNorth(), w: b.getWest(), e: b.getEast() },
    })
      .then((pins) => {
        if (id === reqId.current) onData({ pins, center, tooFar: false })
      })
      .catch(() => {
        if (id === reqId.current) onData({ pins: [], center, tooFar: false })
      })
  }, [map, view, onData])

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(load, 350)
  }, [load])

  useMapEvents({ moveend: schedule })

  useEffect(() => {
    onMap(map)
    load()
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          if (inVenezuela(lat, lng)) {
            const here: [number, number] = [lat, lng]
            onUser(here)
            map.setView(here, DEFAULT_ZOOM)
          }
        },
        undefined,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      )
    }
  }, [])

  useEffect(() => {
    load()
  }, [view, load])

  return null
}

export default function MapScreen() {
  // Arranca en Reportes (mapa con pines + botones flotantes). El banner rojo
  // invita a abrir el terremoto; Ayuda es un dialog aparte.
  const [view, setView] = useState<View>('reportes')
  const [pins, setPins] = useState<Pin[]>([])
  const [user, setUser] = useState<[number, number] | null>(null)
  const [quakes, setQuakes] = useState<QuakeData | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [userEstado, setUserEstado] = useState<string | null>(null)
  const [seed] = useState<[number, number]>(seedCenter)
  const mapRef = useRef<L.Map | null>(null)

  // Carga siempre-activa: el banner necesita el sismo actual aunque estés en
  // Reportes. Refresco 60s, barato por la caché de borde.
  useEffect(() => {
    let alive = true
    const load = () =>
      fetchQuakes()
        .then((d) => {
          if (!alive) return
          setQuakes(d)
          const m = d.quakes.find((q) => q.id === d.mainId)
          if (m) {
            try {
              localStorage.setItem(EPI_KEY, JSON.stringify([m.lat, m.lng]))
            } catch {
              /* sin localStorage: no pasa nada */
            }
          }
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const onData = useCallback((d: Data) => {
    setPins(d.pins)
  }, [])

  const handleLocated = useCallback((pos: [number, number]) => {
    setUser(pos)
    setView('reportes')
    // Preselecciona el estado del usuario en Ayuda (best-effort, no bloquea).
    reverseEstado({ data: { lat: pos[0], lng: pos[1] } })
      .then((s) => s && setUserEstado(s))
      .catch(() => {})
  }, [])

  const main = quakes?.quakes.find((q) => q.id === quakes.mainId) ?? null
  const mainRef = useRef(main)
  mainRef.current = main

  // Al entrar a sismos: centra el epicentro en la franja visible una vez que la
  // hoja terminó de animar (ahí ya se puede medir su tope real). Depende solo de
  // `view` para no recentrar al refrescar datos cada 60s ni mientras el usuario
  // arrastra la hoja. Fallback de 450ms por si no hay transición (reduced motion).
  useEffect(() => {
    if (view !== 'sismos') return
    const map = mapRef.current
    const m = mainRef.current
    if (!map || !m) return
    const sheet = document.querySelector('.ave-drawer')
    let t = 0
    const once = (e?: Event) => {
      if (e && e.target !== sheet) return // ignora transiciones de hijos (burbujean)
      window.clearTimeout(t)
      sheet?.removeEventListener('transitionend', once)
      centerAboveSheet(map, m.lat, m.lng, QUAKE_ZOOM)
    }
    sheet?.addEventListener('transitionend', once)
    t = window.setTimeout(once, 450)
    return () => {
      window.clearTimeout(t)
      sheet?.removeEventListener('transitionend', once)
    }
  }, [view])

  const recenter = () => {
    const m = mapRef.current
    if (!m) return
    if (user) return void m.setView(user, DEFAULT_ZOOM)
    if (!main) return void m.fitBounds(VE_MAX_BOUNDS, { animate: false })
    // En sismos la hoja tapa la mitad inferior: centramos sobre ella, no detrás.
    if (view === 'sismos') centerAboveSheet(m, main.lat, main.lng, QUAKE_ZOOM)
    else m.setView([main.lat, main.lng], QUAKE_ZOOM, { animate: false })
  }

  // Banner = toggle de la capa sísmica. Centrado grueso ya (zona del sismo); el
  // fino lo hace el efecto de abajo cuando la hoja terminó de animar y se puede medir.
  const openSeismic = () => {
    setView('sismos')
    const map = mapRef.current
    if (main && map) map.setView([main.lat, main.lng], QUAKE_ZOOM, { animate: false })
  }
  const closeSeismic = () => setView('reportes')
  const toggleSeismic = () => (view === 'sismos' ? closeSeismic() : openSeismic())

  return (
    <div className="fixed inset-0 overflow-hidden">
      <MapContainer
        className="absolute inset-0 h-full w-full z-0 bg-[#ebe8e0] [font:inherit]"
        center={seed}
        zoom={QUAKE_ZOOM}
        minZoom={6}
        maxBounds={VE_MAX_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        attributionControl={false}
        preferCanvas
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapController
          view={view}
          onData={onData}
          onUser={handleLocated}
          onMap={(m) => {
            mapRef.current = m
          }}
        />
        {view === 'reportes' &&
          pins.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p)} />
          ))}
        {view === 'sismos' && quakes && (
          <>
            {quakes.shakemap != null && <ShakemapLayer shakemap={quakes.shakemap} />}
            {quakes.quakes.map((q) => (
              <Marker
                key={q.id}
                position={[q.lat, q.lng]}
                icon={quakeIcon(q, q.id === quakes.mainId)}
              >
                <Tooltip direction="top">
                  <b>
                    {q.id === quakes.mainId ? 'Terremoto' : 'Sismo'} M{' '}
                    {q.mag.toFixed(1)}
                  </b>{' '}
                  · {q.place || 'sin lugar'}
                  <br />
                  {fmtAge(q.time)} · {Math.round(q.depth)} km prof.
                </Tooltip>
              </Marker>
            ))}
          </>
        )}
        {user && <Marker position={user} icon={youIcon} />}
      </MapContainer>

      {/* Banner de estado sísmico: contexto vivo + toggle de la capa */}
      {main && (
        <Button
          variant="ghost"
          className={`ave-quakebar absolute top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 z-[830] h-auto flex items-center gap-[10px] max-w-[min(92vw,360px)] py-[9px] px-4 border-none rounded-full [font:inherit] text-left cursor-pointer transition-[background,color] duration-150 ease-[ease] ${
            view === 'sismos'
              ? 'bg-[var(--sev)] text-white hover:bg-[var(--sev)] hover:text-white'
              : 'bg-white text-[#1a1c1e] shadow-[0_3px_14px_rgba(23,58,64,0.18)] hover:bg-white hover:text-[#1a1c1e]'
          }`}
          onClick={toggleSeismic}
          style={{ ['--sev' as string]: magColor(main.mag) }}
          aria-pressed={view === 'sismos'}
        >
          <span className="relative w-[14px] h-[14px] flex-[0_0_auto] grid place-items-center">
            <span
              className={`absolute inset-0 rounded-full border-2 animate-pulse-ring motion-reduce:animate-none ${
                view === 'sismos' ? 'border-white' : 'border-[color:var(--sev)]'
              }`}
            />
            <span
              className={`w-[10px] h-[10px] rounded-full ${
                view === 'sismos'
                  ? 'bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.45)]'
                  : 'bg-[var(--sev)] shadow-[0_0_0_2px_#fff]'
              }`}
            />
          </span>
          <span className="flex flex-col leading-[1.15] min-w-0">
            <b className="text-[14px] font-bold">Información terremoto</b>
            <span className="text-[12px] opacity-85 whitespace-nowrap overflow-hidden text-ellipsis">
              M {main.mag.toFixed(1)} · {fmtAge(main.time)} ·{' '}
              {esPlace(main.place) || 'Venezuela'}
            </span>
          </span>
        </Button>
      )}

      {/* Riel flotante: Ayuda (abre dialog) + ubicación */}
      <div className="absolute right-[14px] bottom-[calc(86px+env(safe-area-inset-bottom))] z-[805] flex flex-col items-end gap-3">
        <Button
          variant="ghost"
          className="inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 border-none rounded-[999px] bg-white text-[#173a40] [font:inherit] text-[15px] font-bold shadow-[0_3px_12px_rgba(0,0,0,0.18)] cursor-pointer hover:bg-[#f3faf5] hover:text-[#173a40]"
          onClick={() => setHelpOpen(true)}
        >
          <Phone className="size-5 text-[#0e9c8f]" /> Ayuda
        </Button>
        <Button
          variant="ghost"
          className="w-[46px] h-[46px] rounded-full bg-white grid place-items-center shadow-[0_3px_10px_rgba(0,0,0,0.16)] border-none cursor-pointer text-[#1a1c1e] hover:bg-[#f3faf5] hover:text-[#1a1c1e]"
          aria-label="Mi ubicación"
          onClick={recenter}
        >
          <LocateFixed className="size-[22px]" />
        </Button>
      </div>

      {/* Reportar: botón flotante (solo en el mapa de reportes) */}
      {view === 'reportes' && (
        // TODO(crear): flujo de reporte = siguiente entregable.
        <Button
          variant="ghost"
          className="absolute left-4 right-4 bottom-[calc(20px+env(safe-area-inset-bottom))] z-[800] h-[54px] border-none rounded-[16px] bg-[#0e9c8f] text-white [font:inherit] text-[17px] font-bold flex items-center justify-center gap-[9px] shadow-[0_6px_18px_rgba(14,156,143,0.4)] cursor-pointer hover:bg-[#0c8a7e] hover:text-white"
          type="button"
        >
          <Plus className="size-[21px]" /> Reportar
        </Button>
      )}

      {view === 'sismos' && (
        <QuakeDrawer data={quakes} main={main} onClose={closeSeismic} />
      )}

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        userEstado={userEstado}
      />
    </div>
  )
}
