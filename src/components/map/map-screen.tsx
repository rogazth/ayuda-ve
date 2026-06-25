import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  Eye,
  Layers,
  LocateFixed,
  Phone,
  TriangleAlert,
  Waves,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtAge, typeOf } from '../../reports/reports'
import {
  fetchReport,
  fetchReportsInBounds,
} from '../../reports/reports.functions'
import type { ReportDetail } from '../../reports/reports.functions'
import { reverseEstado } from '../../geo/geo.functions'
import { fetchQuakes } from '../../quakes/quakes.functions'
import type {
  Quake,
  QuakeData,
  MmiContours,
} from '../../quakes/quakes.functions'
import { VE_BOUNDS, esPlace, inVenezuela, magColor } from '../../quakes/quakes'
import type { Pin, Data } from './types'
import { QuakeDrawer } from './quake-drawer'
import { HelpDialog } from './help-dialog'
import { AboutDialog } from './about-dialog'
import { ReportWizard } from './report-wizard'
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

const DEFAULT_ZOOM = 15
const MIN_ZOOM = 6 // ponytail: bbox ilimitado es fine — la tabla es pequeña y el índice cubre todo

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

// Icono de cluster con la marca (teal oscuro), no el skin azul por defecto de
// markercluster — por eso solo importamos MarkerCluster.css, no el .Default.css.
function clusterIcon(cluster: L.MarkerCluster) {
  const n = cluster.getChildCount()
  return L.divIcon({
    className: '!bg-none !border-none',
    html: `<div class="grid place-items-center w-[40px] h-[40px] rounded-full bg-[#173a40] text-white text-[14px] font-bold tabular-nums border-[3px] border-white [filter:drop-shadow(0_3px_6px_rgba(0,0,0,0.3))]">${n}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
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

  const load = useCallback(() => {
    const c = map.getCenter()
    const center: [number, number] = [c.lat, c.lng]
    if (map.getZoom() < MIN_ZOOM) {
      onData({ pins: [], center, tooFar: true })
      return
    }
    const b = map.getBounds()
    const id = ++reqId.current
    fetchReportsInBounds({
      data: {
        s: b.getSouth(),
        n: b.getNorth(),
        w: b.getWest(),
        e: b.getEast(),
      },
    })
      .then((pins) => {
        if (id === reqId.current) onData({ pins, center, tooFar: false })
      })
      .catch(() => {
        if (id === reqId.current) onData({ pins: [], center, tooFar: false })
      })
  }, [map, onData])

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
          } else {
            onOutside()
          }
        },
        undefined,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      )
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  return null
}

export default function MapScreen() {
  // Sin modos. El mapa muestra siempre el terremoto (epicentro + heatmap) y los
  // pines de reporte. Encima, tres cosas independientes: el banner abre el
  // boletín (infoOpen), "Intensidad" prende/apaga el heatmap, y "Reportar"
  // siempre disponible. Ayuda y Acerca de son dialogs aparte.
  const [infoOpen, setInfoOpen] = useState(false)
  const [heatmap, setHeatmap] = useState(true)
  const [pins, setPins] = useState<Pin[]>([])
  const [user, setUser] = useState<[number, number] | null>(null)
  const [quakes, setQuakes] = useState<QuakeData | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [userEstado, setUserEstado] = useState<string | null>(null)
  const [seed] = useState<[number, number]>(seedCenter)
  const mapRef = useRef<L.Map | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [satellite, setSatellite] = useState(false)
  // GPS confirmó al usuario fuera de Venezuela → ocultamos "Mi ubicación"
  // (centrar en su GPS no sirve aquí). Null hasta que el GPS resuelva.
  const [outsideVE, setOutsideVE] = useState(false)
  // Detalle de un reporte: id seleccionado (pin o deep-link ?r=) + fila cargada.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReportDetail | null>(null)

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
    // Preselecciona el estado del usuario en Ayuda (best-effort, no bloquea).
    reverseEstado({ data: { lat: pos[0], lng: pos[1] } })
      .then((s) => s && setUserEstado(s))
      .catch(() => {})
  }, [])

  const main = quakes?.quakes.find((q) => q.id === quakes.mainId) ?? null
  // Sismo más reciente que NO es el principal: la réplica fresca para el badge.
  const latest =
    quakes?.quakes
      .filter((q) => q.id !== quakes.mainId)
      .reduce<Quake | null>((a, q) => (!a || q.time > a.time ? q : a), null) ??
    null
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
        minZoom={6}
        maxBounds={VE_MAX_BOUNDS}
        maxBoundsViscosity={1}
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
        <MarkerClusterGroup
          maxClusterRadius={50}
          showCoverageOnHover={false}
          chunkedLoading
          iconCreateFunction={clusterIcon}
        >
          {pins.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={pinIcon(p)}
              eventHandlers={{ click: () => setSelectedId(p.id) }}
            />
          ))}
        </MarkerClusterGroup>
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

      {/* Banner del terremoto: contexto vivo en el mapa + abre el boletín. Se
          oculta mientras el boletín (dialog full-screen) está abierto, que se
          cierra con la flecha de volver. */}
      {main && !infoOpen && (
        <Button
          variant="ghost"
          className="ave-quakebar absolute top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 z-[830] h-auto flex items-center gap-[10px] max-w-[min(92vw,360px)] py-[9px] px-4 border-none rounded-full text-left cursor-pointer bg-white text-[#1a1c1e] shadow-[0_3px_14px_rgba(23,58,64,0.18)] hover:bg-white hover:text-[#1a1c1e]"
          onClick={() => setInfoOpen(true)}
          style={{ ['--sev' as string]: magColor(main.mag) }}
          aria-expanded={false}
        >
          <span className="relative w-[14px] h-[14px] flex-[0_0_auto] grid place-items-center">
            <span className="absolute inset-0 rounded-full border-2 border-[color:var(--sev)] animate-pulse-ring motion-reduce:animate-none" />
            <span className="w-[10px] h-[10px] rounded-full bg-[var(--sev)] shadow-[0_0_0_2px_#fff]" />
          </span>
          <span className="flex flex-col leading-[1.15] min-w-0">
            <b className="text-[14px] font-bold">Ver información terremoto</b>
            <span className="text-[12px] opacity-85 whitespace-nowrap overflow-hidden text-ellipsis">
              {latest
                ? `Última réplica · M ${latest.mag.toFixed(1)} · ${fmtAge(latest.time)}`
                : `M ${main.mag.toFixed(1)} · ${fmtAge(main.time)} · ${esPlace(main.place) || 'Venezuela'}`}
            </span>
          </span>
          {/* Ojo = "ver el boletín". */}
          <span className="grid h-[24px] w-[24px] flex-[0_0_auto] place-items-center rounded-full bg-black/[0.06] text-[#1a1c1e]">
            <Eye className="size-[16px] opacity-70" />
          </span>
        </Button>
      )}

      {/* Riel flotante: Ayuda (abre dialog) + capas + ubicación */}
      <div className="absolute right-[14px] bottom-[calc(86px+env(safe-area-inset-bottom))] z-[805] flex flex-col items-end gap-3">
        <Button
          variant="ghost"
          className="inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 border-none rounded-[999px] bg-white text-[#173a40] text-[15px] font-bold shadow-[0_3px_12px_rgba(0,0,0,0.18)] cursor-pointer hover:bg-[#f3faf5] hover:text-[#173a40]"
          onClick={() => setHelpOpen(true)}
        >
          <Phone className="size-5 text-[#0e9c8f]" /> Ayuda
        </Button>
        <Button
          variant="ghost"
          className={`inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 rounded-[999px] text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,0.16)] border-none cursor-pointer ${
            satellite
              ? 'bg-[#173a40] text-white hover:bg-[#173a40] hover:text-white'
              : 'bg-white text-[#173a40] hover:bg-[#f3faf5] hover:text-[#173a40]'
          }`}
          aria-pressed={satellite}
          onClick={() => setSatellite((s) => !s)}
        >
          <Layers className="size-5" /> Vista
        </Button>
        {/* Intensidad: prende/apaga el mapa de calor (sacudida MMI del sismo) */}
        <Button
          variant="ghost"
          className={`inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 rounded-[999px] text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,0.16)] border-none cursor-pointer ${
            heatmap
              ? 'bg-[#173a40] text-white hover:bg-[#173a40] hover:text-white'
              : 'bg-white text-[#173a40] hover:bg-[#f3faf5] hover:text-[#173a40]'
          }`}
          aria-pressed={heatmap}
          onClick={() => setHeatmap((h) => !h)}
        >
          <Waves className="size-5" /> Intensidad
        </Button>
        {/* Centrar: oculto si el GPS confirmó al usuario fuera de Venezuela */}
        {!outsideVE && (
          <Button
            variant="ghost"
            className="inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 rounded-[999px] bg-white text-[#173a40] text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,0.16)] border-none cursor-pointer hover:bg-[#f3faf5] hover:text-[#173a40]"
            onClick={recenter}
          >
            <LocateFixed className="size-5 text-[#0e9c8f]" /> Mi ubicación
          </Button>
        )}
      </div>

      {/* Reportar: acción siempre disponible (el boletín la tapa al abrirse) */}
      <Button
        variant="ghost"
        className="absolute left-4 right-4 bottom-[calc(20px+env(safe-area-inset-bottom))] z-[800] h-[54px] border-none rounded-[16px] bg-[#0e9c8f] text-white text-[17px] font-bold flex items-center justify-center gap-[9px] shadow-[0_6px_18px_rgba(14,156,143,0.4)] cursor-pointer hover:bg-[#0c8a7e] hover:text-white"
        type="button"
        onClick={() => setWizardOpen(true)}
      >
        <TriangleAlert className="size-[21px]" /> Reportar
      </Button>

      <ReportWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        userLocation={user}
        onSubmitDone={(id) => {
            setRefreshKey((k) => k + 1)
            toast.success('Reporte enviado', { description: 'Gracias por reportar. Tu reporte ya es visible en el mapa.' })
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
