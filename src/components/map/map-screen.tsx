import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { fmtAge, newFreshPins, typeOf } from '../../reports/reports'
import {
  fetchReport,
  fetchReportsInBounds,
} from '../../reports/reports.functions'
import { StackDrawer } from './stack-drawer'
import type { ReportDetail } from '../../reports/reports.functions'
import { reverseEstado } from '../../geo/geo.functions'
import { fetchQuakes } from '../../quakes/quakes.functions'
import type {
  Quake,
  QuakeData,
  MmiContours,
} from '../../quakes/quakes.functions'
import {
  VE_BOUNDS,
  esPlace,
  inVenezuela,
  magColor,
  quakeOpacity,
} from '../../quakes/quakes'
import type { Pin, Data } from './types'
import { MapChrome, mainAndLatest } from './map-chrome'
import type { Tab } from './map-chrome'
import { FeedScreen } from './feed-screen'
import { AvisosScreen } from './avisos-screen'
import { QuakeDrawer } from './quake-drawer'
import { HelpDialog } from './help-dialog'
import { AboutDialog } from './about-dialog'
import { ReportWizard } from './report-wizard'
import { LocationPicker } from './location-picker'
import { ReportDetailScreen } from './report-detail'
import { toast } from 'sonner'

// Renderiza los contornos MMI como anillos (evenodd) en canvas → imageOverlay.
// Cada zona se pinta UNA sola vez (outer contour - inner contour) → sin opacidad apilada.
// El bbox se deriva de los datos → sin bordes rectangulares.
function ShakemapLayer({ shakemap }: { shakemap: MmiContours }) {
  const map = useMap()
  useEffect(() => {
    // Bbox de todos los contornos
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity
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
    const H = Math.round((W * (maxLat - minLat)) / (maxLng - minLng))
    const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * W
    const toY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * H

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Cada zona se pinta como anillo (outer - inner) con evenodd para no apilar capas.
    // Ordenado por MMI ascendente: sorted[i] es el outer, sorted[i+1] el inner cutout.
    const sorted = [...shakemap.features].sort(
      (a, b) => a.properties.value - b.properties.value,
    )
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

    const overlay = L.imageOverlay(canvas.toDataURL(), [
      [minLat, minLng],
      [maxLat, maxLng],
    ])
    overlay.addTo(map)
    return () => {
      overlay.remove()
    }
  }, [map, shakemap])
  return null
}

// Beep corto vía Web Audio: sin assets ni fetch. Contexto nuevo por beep, se
// cierra al terminar (los navegadores limitan ~6 contextos vivos).
// ponytail: el navegador exige un gesto previo del usuario para sonar; en esta
// app el usuario ya toca el mapa, así que para cuando llega un poll suele estar
// desbloqueado. Si no suena en frío, gatear tras el primer click.
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    osc.start(t)
    osc.stop(t + 0.42)
    osc.onended = () => ctx.close()
  } catch {
    /* sin Web Audio o bloqueado: el toast sigue avisando */
  }
}

// Reportes nuevos en viewport: refresco y ventana de frescura. La ventana > el
// intervalo para no perder uno que llegó justo entre polls.
const POLL_MS = 30_000
const FRESH_NEW_MS = 2 * 60_000

const DEFAULT_ZOOM = 15
const MIN_ZOOM = 6 // ponytail: bbox ilimitado es fine — la tabla es pequeña y el índice cubre todo
// Pedimos un área 50% mayor que el viewport: pans cortos quedan dentro del buffer
// → sin refetch ni rebuild del cluster, el drag se siente fluido.
const BUFFER = 0.5

const VE_MAX_BOUNDS: L.LatLngBoundsExpression = [
  [VE_BOUNDS.minLat - 6, VE_BOUNDS.minLng - 6],
  [VE_BOUNDS.maxLat + 6, VE_BOUNDS.maxLng + 6],
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

// Icono cacheado por (tipo, confirms): el divIcon es config inmutable y se
// comparte entre marcadores sin problema. Así 5000 pines reusan ~una docena de
// iconos en vez de reconstruir el string HTML en cada render.
const iconCache = new Map<string, L.DivIcon>()
function pinIcon(p: Pin) {
  const key = `${p.type}|${p.confirms}`
  const cached = iconCache.get(key)
  if (cached) return cached
  const t = typeOf(p.type)
  const cnt =
    p.confirms > 0
      ? `<span class="absolute -top-[6px] -right-[8px] bg-[#1a1c1e] text-white text-[11px] font-bold min-w-[19px] h-[19px] rounded-[10px] grid place-items-center px-[5px] border-2 border-white">${p.confirms}</span>`
      : ''
  const icon = L.divIcon({
    className: '!bg-none !border-none',
    html: `<div class="relative w-[38px] h-[38px] [filter:drop-shadow(0_4px_4px_rgba(0,0,0,0.28))]"><div class="w-[38px] h-[38px] rounded-[50%_50%_50%_0] -rotate-45 grid place-items-center border-[2.5px] border-white [&_svg]:rotate-45 [&_svg]:w-[19px] [&_svg]:h-[19px]" style="background:${t.color}"><svg viewBox="0 0 24 24">${t.svg}</svg></div>${cnt}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 40],
  })
  iconCache.set(key, icon)
  return icon
}

// Burbuja teal con la marca (no el skin azul por defecto de markercluster — por
// eso solo importamos MarkerCluster.css, no el .Default.css). La usan el cluster y
// los puntos apilados (n>1). Conteo "+N mil" (no "k": un venezolano común no lo
// lee); el "+" dice "más de" y redondea hacia abajo. 1.999 → "+1 mil".
const fmtCount = (n: number) => (n >= 1000 ? `+${Math.floor(n / 1000)} mil` : `${n}`)
function bubbleIcon(n: number) {
  const label = fmtCount(n)
  // "+10 mil" (7 chars) no entra a 13px en el círculo de 40px → baja la fuente.
  const size = label.length >= 5 ? 'text-[10px]' : 'text-[13px]'
  return L.divIcon({
    className: '!bg-none !border-none',
    html: `<div class="grid place-items-center w-[40px] h-[40px] rounded-full bg-[#173a40] text-white ${size} font-bold tabular-nums leading-none text-center border-[3px] border-white [filter:drop-shadow(0_3px_6px_rgba(0,0,0,0.3))]">${label}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

// Suma los `n` de los hijos (cada hijo es un punto que puede apilar varios
// reportes), no el nº de hijos: un cluster de 3 puntos con 800 c/u debe decir
// "2.4k", no "3". PinsLayer setea `count` en cada marker apilado; los pins
// sueltos no lo tienen → cuentan 1.
function clusterIcon(cluster: L.MarkerCluster) {
  let total = 0
  for (const m of cluster.getAllChildMarkers())
    total += (m.options as { count?: number }).count ?? 1
  return bubbleIcon(total)
}

const youIcon = L.divIcon({
  className: '!bg-none !border-none',
  html: '<div class="relative w-[18px] h-[18px]"><span class="absolute inset-[-15px] rounded-full bg-[rgba(47,123,214,0.16)]"></span><span class="absolute inset-0 rounded-full bg-[#2f7bd6] border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.35)]"></span></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function quakeIcon(q: Quake, main: boolean) {
  const size = Math.max(9, Math.round(q.mag * 6))
  // Recencia: el principal siempre nítido; el resto se desvanece con la edad
  // (grande o reciente resalta, chico y viejo se va al fondo). Se recalcula en
  // cada poll de 60s, de sobra para un fade medido en horas.
  const op = main ? 1 : quakeOpacity(q.mag, Date.now() - q.time)
  const ripple = main
    ? " before:content-[''] before:absolute before:inset-0 before:rounded-full before:border-2 before:border-[color:var(--c)] before:animate-epi-ripple before:motion-reduce:animate-none after:content-[''] after:absolute after:inset-0 after:rounded-full after:border-2 after:border-[color:var(--c)] after:animate-epi-ripple after:[animation-delay:1.3s] after:motion-reduce:animate-none"
    : ''
  return L.divIcon({
    className: '!bg-none !border-none',
    html: `<span class="block rounded-full bg-[var(--c)] shadow-[0_0_0_2px_#fff,0_1px_4px_rgba(0,0,0,0.35)] relative${ripple}" style="--c:${magColor(q.mag)};width:${size}px;height:${size}px;opacity:${op}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Vive dentro del MapContainer: tiene el mapa, dispara fetch por bbox (debounced) y GPS.
function MapController({
  onData,
  onUser,
  onOutside,
  onMap,
  refreshKey,
}: {
  onData: (d: Data) => void
  onUser: (pos: [number, number]) => void
  onOutside: () => void
  onMap: (map: L.Map) => void
  refreshKey: number
}) {
  const map = useMap()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqId = useRef(0)
  // Área (con buffer) para la que ya tenemos pines montados. Mientras el viewport
  // quepa dentro, no re-pedimos ni reconstruimos el cluster.
  const loaded = useRef<L.LatLngBounds | null>(null)

  const load = useCallback(
    (announce: boolean, force = false) => {
      const c = map.getCenter()
      const center: [number, number] = [c.lat, c.lng]
      if (map.getZoom() < MIN_ZOOM) {
        loaded.current = null
        onData({ pins: [], center, tooFar: true, announce })
        return
      }
      const vb = map.getBounds()
      // Viewport dentro del buffer ya cargado → solo paneamos sobre los
      // marcadores existentes. Sin fetch ni rebuild: esto hace fluido el drag.
      // Solo recargamos al salir del buffer (o forzado: poll / refresh).
      if (!force && loaded.current?.contains(vb)) return
      const area = vb.pad(BUFFER)
      const id = ++reqId.current
      fetchReportsInBounds({
        data: {
          s: area.getSouth(),
          n: area.getNorth(),
          w: area.getWest(),
          e: area.getEast(),
        },
      })
        .then((pins) => {
          if (id !== reqId.current) return
          loaded.current = area
          onData({ pins, center, tooFar: false, announce })
        })
        .catch(() => {
          // Fetch falló: dejamos los pines actuales, no blanqueamos el mapa.
        })
    },
    [map, onData],
  )

  // Pan/zoom: refresca pines en silencio (announce=false). load() decide si toca
  // refetch (fuera del buffer) o no hace nada (dentro).
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => load(false), 300)
  }, [load])

  useMapEvents({ moveend: schedule })

  useEffect(() => {
    onMap(map)
    load(false)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          if (inVenezuela(lat, lng)) {
            const here: [number, number] = [lat, lng]
            onUser(here)
            map.setView(here, DEFAULT_ZOOM)
          } else {
            onOutside()
          }
        },
        undefined,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      )
    }
  }, [])

  // Poll / refresh (refreshKey): fuerza refetch aunque el viewport esté dentro
  // del buffer (necesitamos datos frescos para detectar reportes nuevos → beep).
  useEffect(() => {
    load(true, true)
  }, [load, refreshKey])

  return null
}

// Capa de pines aislada y memoizada: solo se re-renderiza cuando cambian los
// pines, no cuando togglea satélite/intensidad u otro estado de MapScreen. Antes,
// cada toggle reconciliaba los hasta 5000 <Marker>.
const PinsLayer = memo(function PinsLayer({
  pins,
  onSelect,
  onStack,
}: {
  pins: Pin[]
  onSelect: (id: string) => void
  onStack: (p: Pin) => void
}) {
  return (
    <MarkerClusterGroup
      maxClusterRadius={50}
      showCoverageOnHover={false}
      chunkedLoading
      iconCreateFunction={clusterIcon}
    >
      {pins.map((p) => {
        const n = p.n ?? 1
        // Apilado: burbuja con conteo → abre el drawer (zoom no los separa, comparten
        // coordenada). `count` en el marker para que clusterIcon sume bien.
        if (n > 1)
          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={bubbleIcon(n)}
              ref={(m) => {
                if (m) (m.options as { count?: number }).count = n
              }}
              eventHandlers={{ click: () => onStack(p) }}
            />
          )
        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p)}
            eventHandlers={{ click: () => onSelect(p.id) }}
          />
        )
      })}
    </MarkerClusterGroup>
  )
})

// "Más" aún sin contenido (Fase 8). El nav ya es el final para no rehacerlo;
// el panel se rellena en su fase. ponytail: placeholder mínimo a propósito.
function TabPlaceholder({ title }: { title: string }) {
  return (
    <div className="fixed inset-0 z-[820] flex flex-col bg-surface-muted">
      <header
        className="flex-none border-b border-line bg-white"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <h1 className="px-4 pb-3 text-[20px] font-extrabold text-ink">{title}</h1>
      </header>
      <div className="grid flex-1 place-items-center px-8 text-center">
        <p className="text-[14px] text-ink-muted">Próximamente.</p>
      </div>
    </div>
  )
}

export default function MapScreen({
  initialPins = [],
  initialQuakes = null,
}: {
  initialPins?: Pin[]
  initialQuakes?: QuakeData | null
}) {
  // Sin modos. El mapa muestra siempre el terremoto (epicentro + heatmap) y los
  // pines de reporte. Encima, tres cosas independientes: el banner abre el
  // boletín (infoOpen), "Intensidad" prende/apaga el heatmap, y "Reportar"
  // siempre disponible. Ayuda y Acerca de son dialogs aparte.
  const [infoOpen, setInfoOpen] = useState(false)
  // Tab activo: overlay sobre el mapa montado, no una ruta. 'mapa' = sin panel.
  const [tab, setTab] = useState<Tab>('mapa')
  const [heatmap, setHeatmap] = useState(true)
  // initialPins/initialQuakes vienen del loader SSR → pines + heatmap se pintan
  // al montar el mapa, sin esperar el round-trip. El bbox del viewport reemplaza
  // los pines apenas resuelve; el poll de 60s refresca quakes.
  const [pins, setPins] = useState<Pin[]>(initialPins)
  const [user, setUser] = useState<[number, number] | null>(null)
  const [quakes, setQuakes] = useState<QuakeData | null>(initialQuakes)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [userEstado, setUserEstado] = useState<string | null>(null)
  const [seed] = useState<[number, number]>(seedCenter)
  const mapRef = useRef<L.Map | null>(null)
  // Flujo de reporte: 'picking' = elegir ubicación sobre el mapa vivo (oculta el
  // chrome); 'form' = wizard (tipo→detalle→contacto) ya con la ubicación elegida.
  const [reportFlow, setReportFlow] = useState<'idle' | 'picking' | 'form'>('idle')
  const [pickedLoc, setPickedLoc] = useState<[number, number] | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [satellite, setSatellite] = useState(false)
  // GPS confirmó al usuario fuera de Venezuela → ocultamos "Mi ubicación"
  // (centrar en su GPS no sirve aquí). Null hasta que el GPS resuelva.
  const [outsideVE, setOutsideVE] = useState(false)
  // Detalle de un reporte: id seleccionado (pin o deep-link ?r=) + fila cargada.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  // Punto apilado abierto (n>1): el drawer lista los reportes de esa coordenada.
  // Queda montado bajo el detalle, así cerrar el detalle vuelve a la lista.
  const [stack, setStack] = useState<Pin | null>(null)

  // Deep-link ?r=<id> → abre el detalle al montar (lo que comparte "Compartir").
  useEffect(() => {
    const r = new URLSearchParams(location.search).get('r')
    if (r) setSelectedId(r)
  }, [])

  // Trae el detalle al seleccionar; null mientras carga (la pantalla muestra spinner).
  useEffect(() => {
    if (!selectedId) return setDetail(null)
    setDetail(null)
    let alive = true
    fetchReport({ data: { id: selectedId } })
      .then((r) => alive && setDetail(r))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [selectedId])

  // Al cerrar: refresca pines para reflejar confirms/flags (un voto pudo ocultarlo).
  const closeDetail = useCallback(() => {
    setSelectedId(null)
    setRefreshKey((k) => k + 1)
  }, [])

  // Estable para que PinsLayer (memo) no se re-renderice por identidad del handler.
  const onSelect = useCallback((id: string) => setSelectedId(id), [])
  const onStack = useCallback((p: Pin) => setStack(p), [])

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

  // Detección de reportes nuevos en el viewport para el beep. `seen` acumula los
  // ids ya mostrados; `seeded` evita sonar en la primera carga (acabas de llegar,
  // ya ves los pines).
  const seenRef = useRef<Set<string>>(new Set())
  const seededRef = useRef(false)
  const onData = useCallback((d: Data) => {
    setPins(d.pins)
    const seen = seenRef.current
    if (!seededRef.current) {
      for (const p of d.pins) seen.add(p.id)
      seededRef.current = true
      return
    }
    // newFreshPins siembra `seen` con todos los pines visibles (también en pan),
    // así un pan silencioso no deja que el siguiente poll los re-anuncie.
    const fresh = newFreshPins(d.pins, seen, Date.now(), FRESH_NEW_MS)
    if (d.announce && fresh.length) {
      beep()
      toast(
        fresh.length === 1
          ? `Nuevo reporte: ${fresh[0].title}`
          : `${fresh.length} reportes nuevos en el mapa`,
      )
    }
  }, [])

  // Poll: refresca los pines del viewport cada POLL_MS reusando refreshKey, que
  // el MapController ya escucha. onData detecta los nuevos y suena.
  useEffect(() => {
    const t = setInterval(() => setRefreshKey((k) => k + 1), POLL_MS)
    return () => clearInterval(t)
  }, [])

  const handleLocated = useCallback((pos: [number, number]) => {
    setUser(pos)
    // Preselecciona el estado del usuario en Ayuda (best-effort, no bloquea).
    reverseEstado({ data: { lat: pos[0], lng: pos[1] } })
      .then((s) => s && setUserEstado(s))
      .catch(() => {})
  }, [])

  const { main } = mainAndLatest(quakes)
  const mainRef = useRef(main)
  mainRef.current = main

  // Centra el epicentro al cargar (o cambiar) el sismo principal, salvo que el
  // GPS ya haya ubicado al usuario. Depende de `main?.id` (estable entre los
  // refrescos de 60s) para no recentrar el mapa bajo el usuario. Lee de mainRef
  // para no re-disparar por la nueva identidad del objeto en cada refresco.
  useEffect(() => {
    const map = mapRef.current
    const m = mainRef.current
    if (!map || !m || user) return
    map.setView([m.lat, m.lng], QUAKE_ZOOM, { animate: false })
  }, [main?.id, user])

  const recenter = () => {
    const m = mapRef.current
    if (!m) return
    if (user) return void m.setView(user, DEFAULT_ZOOM)
    if (!main) return void m.fitBounds(VE_MAX_BOUNDS, { animate: false })
    m.setView([main.lat, main.lng], QUAKE_ZOOM, { animate: false })
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      <MapContainer
        className="absolute inset-0 h-full w-full z-0 bg-[#ebe8e0]"
        center={seed}
        zoom={QUAKE_ZOOM}
        minZoom={5}
        maxBounds={VE_MAX_BOUNDS}
        maxBoundsViscosity={0.5}
        zoomControl={false}
        attributionControl={false}
        preferCanvas
      >
        {satellite ? (
          <>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            {/* etiquetas (calles/lugares) encima del satélite para orientarse */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </>
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}
        <MapController
          onData={onData}
          onUser={handleLocated}
          onOutside={() => setOutsideVE(true)}
          onMap={(m) => {
            mapRef.current = m
          }}
          refreshKey={refreshKey}
        />
        <PinsLayer pins={pins} onSelect={onSelect} onStack={onStack} />
        {quakes && (
          <>
            {heatmap && quakes.shakemap != null && (
              <ShakemapLayer shakemap={quakes.shakemap} />
            )}
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
                  · {esPlace(q.place) || 'sin lugar'}
                  <br />
                  {fmtAge(q.time)} · {Math.round(q.depth)} km prof.
                </Tooltip>
              </Marker>
            ))}
          </>
        )}
        {user && <Marker position={user} icon={youIcon} />}
      </MapContainer>

      {/* Paneles de tab: overlays sobre el mapa vivo (no desmontan Leaflet). El
          bottom-nav (en MapChrome, z-840) queda por encima. */}
      {tab === 'reportes' && <FeedScreen onSelect={setSelectedId} />}
      {tab === 'avisos' && <AvisosScreen />}
      {tab === 'mas' && <TabPlaceholder title="Más" />}

      {/* Elegir ubicación sobre el mapa vivo: el chrome se oculta y aparece la
          búsqueda + X + pin central + botón confirmar. El mapa no se mueve. */}
      {reportFlow !== 'picking' && (
        <MapChrome
          quakes={quakes}
          satellite={satellite}
          heatmap={heatmap}
          outsideVE={outsideVE}
          infoOpen={infoOpen}
          tab={tab}
          onTab={setTab}
          onBanner={() => setInfoOpen(true)}
          onHelp={() => setHelpOpen(true)}
          onEmergency={() => setHelpOpen(true)}
          onToggleSatellite={() => setSatellite((s) => !s)}
          onToggleHeatmap={() => setHeatmap((h) => !h)}
          onRecenter={recenter}
          onReport={() => setReportFlow('picking')}
        />
      )}

      {reportFlow === 'picking' && (
        <LocationPicker
          mapRef={mapRef}
          onConfirm={(loc) => {
            setPickedLoc(loc)
            setReportFlow('form')
          }}
          onCancel={() => setReportFlow('idle')}
        />
      )}

      <ReportWizard
        open={reportFlow === 'form'}
        location={pickedLoc}
        onClose={() => setReportFlow('idle')}
        onBack={() => setReportFlow('picking')}
        onSubmitDone={(id) => {
          setRefreshKey((k) => k + 1)
          setReportFlow('idle')
          toast.success('Reporte enviado', {
            description:
              'Gracias por reportar. Tu reporte ya es visible en el mapa.',
          })
          setSelectedId(id)
        }}
      />

      {infoOpen && (
        <QuakeDrawer
          data={quakes}
          main={main}
          onClose={() => setInfoOpen(false)}
        />
      )}

      {stack && (
        <StackDrawer
          point={stack}
          onSelect={setSelectedId}
          onClose={() => setStack(null)}
        />
      )}

      {selectedId && (
        <ReportDetailScreen report={detail} user={user} onClose={closeDetail} />
      )}

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onAbout={() => {
          setHelpOpen(false)
          setAboutOpen(true)
        }}
        userEstado={userEstado}
      />

      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onBack={() => {
          setAboutOpen(false)
          setHelpOpen(true)
        }}
      />
    </div>
  )
}
