import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { newFreshPins, typeOf } from '../../reports/reports'
import {
  fetchReport,
  fetchReportsInBounds,
} from '../../reports/reports.functions'
import { StackDrawer } from './stack-drawer'
import type { ReportDetail } from '../../reports/reports.functions'
import { reverseEstado } from '../../geo/geo.functions'
import { fetchQuakes } from '../../quakes/quakes.functions'
import type { QuakeData } from '../../quakes/quakes.functions'
import { VE_BOUNDS, inVenezuela } from '../../quakes/quakes'
import type { Pin, Data } from './types'
import { MapChrome, mainAndLatest } from './map-chrome'
import type { Tab } from './map-chrome'
import { FeedScreen } from './feed-screen'
import { AvisosScreen } from './avisos-screen'
import { MasScreen } from './mas-screen'
import { ComoAyudarScreen } from './como-ayudar-screen'
import { ExteriorDialog } from './exterior-dialog'
import { MapSearch } from './map-search'
import { QuakeDrawer } from './quake-drawer'
import { EmergenciasDialog } from './emergencias-dialog'
import { AboutDialog } from './about-dialog'
import { ReportWizard } from './report-wizard'
import { LocationPicker } from './location-picker'
import { ReportDetailScreen } from './report-detail'
import { toast } from 'sonner'

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
// Sin límite práctico: el mapa vivo es libre (la diáspora navega a su país a ver
// acopios). El límite VE solo se aplica al elegir ubicación de un reporte.
const WORLD_BOUNDS: L.LatLngBoundsExpression = [
  [-85, -180],
  [85, 180],
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

// Icono cacheado por tipo: el divIcon es config inmutable y se comparte entre
// marcadores sin problema. Así 5000 pines reusan ~una docena de iconos en vez de
// reconstruir el string HTML en cada render. (El contador de confirmaciones se
// quitó del pin — "Lo confirmo" ya no es una acción.)
const iconCache = new Map<string, L.DivIcon>()
function pinIcon(p: Pin) {
  const cached = iconCache.get(p.type)
  if (cached) return cached
  const t = typeOf(p.type)
  const icon = L.divIcon({
    className: '!bg-none !border-none',
    html: `<div class="w-[38px] h-[38px] [filter:drop-shadow(0_4px_4px_rgba(0,0,0,0.28))]"><div class="w-[38px] h-[38px] rounded-[50%_50%_50%_0] -rotate-45 grid place-items-center border-[2.5px] border-white [&_svg]:rotate-45 [&_svg]:w-[19px] [&_svg]:h-[19px]" style="background:${t.color}"><svg viewBox="0 0 24 24">${t.svg}</svg></div></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 40],
  })
  iconCache.set(p.type, icon)
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
  // Área (con buffer) + modo para el que ya tenemos pines montados. Mientras el
  // viewport quepa dentro y el modo no cambie, no re-pedimos ni reconstruimos el cluster.
  const loaded = useRef<{ bounds: L.LatLngBounds; supportOnly: boolean } | null>(null)

  const load = useCallback(
    (announce: boolean, force = false) => {
      const c = map.getCenter()
      const center: [number, number] = [c.lat, c.lng]
      // Zoom-out: traer SOLO centros de acopio (677, liviano, cobertura mundial)
      // en vez de blanquear el mapa. A zoom de detalle, todos los tipos del viewport
      // (los ~52k desaparecidos no tienen sentido —ni rinden— a escala continental).
      const supportOnly = map.getZoom() < MIN_ZOOM
      const vb = map.getBounds()
      // Viewport dentro del buffer ya cargado y mismo modo → solo paneamos sobre los
      // marcadores existentes. Sin fetch ni rebuild: esto hace fluido el drag.
      if (
        !force &&
        loaded.current?.supportOnly === supportOnly &&
        loaded.current.bounds.contains(vb)
      )
        return
      const area = vb.pad(BUFFER)
      const id = ++reqId.current
      fetchReportsInBounds({
        data: {
          s: area.getSouth(),
          n: area.getNorth(),
          w: area.getWest(),
          e: area.getEast(),
          types: supportOnly ? ['support'] : undefined,
        },
      })
        .then((pins) => {
          if (id !== reqId.current) return
          loaded.current = { bounds: area, supportOnly }
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
  // El cluster se remonta SOLO al cambiar de "scope": todo-tipos (detalle) ↔ solo
  // acopios (zoom-out global). react-leaflet-cluster no purga limpio los marcadores
  // viejos al intercambiar dataset entero → dejaba un cluster fantasma. La key estable
  // dentro de un scope conserva el pan fluido (no remonta al panear).
  const scope = pins.length > 0 && pins.every((p) => p.type === 'support') ? 'support' : 'mixed'
  return (
    <MarkerClusterGroup
      key={scope}
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

export default function MapScreen({
  initialPins = [],
  initialQuakes = null,
}: {
  initialPins?: Pin[]
  initialQuakes?: QuakeData | null
}) {
  // Sin modos. El mapa muestra los pines de reporte; los sismos ya NO se pintan
  // en el mapa vivo (van como infografía estática en el boletín). El banner abre
  // el boletín (infoOpen) y "Reportar" siempre disponible. Ayuda y Acerca de son
  // dialogs aparte.
  const [infoOpen, setInfoOpen] = useState(false)
  // Tab activo: overlay sobre el mapa montado, no una ruta. 'mapa' = sin panel.
  const [tab, setTab] = useState<Tab>('mapa')
  // initialPins/initialQuakes vienen del loader SSR → los pines se pintan al
  // montar el mapa, sin round-trip; quakes alimenta el badge + boletín (no el
  // mapa). El bbox del viewport reemplaza los pines; el poll de 60s refresca quakes.
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
  // Buscador de lugares del mapa (lupa del topbar) → recenter vía Mapbox.
  const [searchOpen, setSearchOpen] = useState(false)
  // Dialog del exterior: "no volver a mostrar" persiste en localStorage;
  // ?exterior=1 lo fuerza para revisarlo en preview sin GPS fuera de VE.
  const [exteriorDismissed, setExteriorDismissed] = useState(() => {
    try {
      return localStorage.getItem('ave-exterior-dismissed') === '1'
    } catch {
      return false
    }
  })
  const [forceExterior] = useState(() => {
    try {
      return new URLSearchParams(location.search).get('exterior') === '1'
    } catch {
      return false
    }
  })
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

  // Límite de navegación a Venezuela SOLO al elegir ubicación de un reporte (crear
  // reporte es VE-only, y el backend igual rechaza coords fuera de rango). Fuera de
  // ese flujo el mapa es libre. Si entrás al picker desde el exterior, recentra a VE.
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    if (reportFlow === 'picking') {
      const c = m.getCenter()
      if (!inVenezuela(c.lat, c.lng)) m.setView(QUAKE_ZONE, QUAKE_ZOOM)
      m.setMaxBounds(VE_MAX_BOUNDS)
    } else {
      m.setMaxBounds(WORLD_BOUNDS)
    }
  }, [reportFlow])

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
        minZoom={2}
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
        {/* Los sismos ya no se pintan en el mapa vivo: van como infografía
            estática en el boletín (QuakeDrawer). Aquí solo pines + ubicación. */}
        {user && <Marker position={user} icon={youIcon} />}
      </MapContainer>

      {/* Paneles de tab: overlays sobre el mapa vivo (no desmontan Leaflet). El
          bottom-nav (en MapChrome, z-840) queda por encima. */}
      {tab === 'reportes' && <FeedScreen onSelect={setSelectedId} />}
      {/* Etapa 1: el CTA "Ver reporte" de una notificación lleva al feed (los
          reportId mock no existen en DB); E2 lo abre directo con setSelectedId. */}
      {tab === 'avisos' && <AvisosScreen onOpenReport={() => setTab('reportes')} />}
      {tab === 'ayudar' && <ComoAyudarScreen />}
      {tab === 'mas' && (
        <MasScreen
          onComoAyudar={() => setTab('ayudar')}
          onHelp={() => setHelpOpen(true)}
          onAbout={() => setAboutOpen(true)}
        />
      )}

      {(outsideVE || forceExterior) && !exteriorDismissed && (
        <ExteriorDialog
          onHelp={() => {
            setExteriorDismissed(true)
            setTab('ayudar')
          }}
          onDismiss={() => {
            try {
              localStorage.setItem('ave-exterior-dismissed', '1')
            } catch {
              /* sin localStorage: se descarta solo esta sesión */
            }
            setExteriorDismissed(true)
          }}
          onClose={() => setExteriorDismissed(true)}
        />
      )}

      {/* Elegir ubicación sobre el mapa vivo: el chrome se oculta y aparece la
          búsqueda + X + pin central + botón confirmar. El mapa no se mueve. */}
      {reportFlow !== 'picking' && (
        <MapChrome
          quakes={quakes}
          satellite={satellite}
          outsideVE={outsideVE}
          infoOpen={infoOpen}
          searchOpen={searchOpen && tab === 'mapa'}
          tab={tab}
          onTab={setTab}
          onBanner={() => setInfoOpen(true)}
          onEmergency={() => setHelpOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onToggleSatellite={() => setSatellite((s) => !s)}
          onRecenter={recenter}
          onReport={() => {
            // Elegir ubicación es sobre el mapa vivo: si estás en otra tab, el
            // panel taparía el mapa → volvemos a "mapa" antes de abrir el picker.
            setTab('mapa')
            setReportFlow('picking')
          }}
        />
      )}

      {searchOpen && tab === 'mapa' && reportFlow !== 'picking' && (
        <MapSearch mapRef={mapRef} onClose={() => setSearchOpen(false)} />
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
          imageUrl={quakes?.imageUrl ?? null}
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
        <ReportDetailScreen
          report={detail}
          user={user}
          onClose={closeDetail}
          onViewOnMap={(lat, lng) => {
            mapRef.current?.setView([lat, lng], 16)
            closeDetail()
          }}
        />
      )}

      <EmergenciasDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        userEstado={userEstado}
      />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}
