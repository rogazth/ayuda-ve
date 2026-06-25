import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './ayuda-map.css'
import { Drawer } from 'vaul'
import {
  Activity,
  ChevronRight,
  ExternalLink,
  Info,
  LocateFixed,
  Phone,
  Plus,
  X,
} from 'lucide-react'
import { EMERGENCY, fmtAge, typeOf } from '../../lib/reports'
import { fetchReportsInBounds } from '../../reports.functions'
import { reverseEstado } from '../../geo.functions'
import { fetchQuakes } from '../../quakes.functions'
import type { Quake, QuakeData } from '../../quakes.functions'
import {
  VE_BOUNDS,
  buildSources,
  esPlace,
  inVenezuela,
  magColor,
} from '../../lib/quakes'
import type { SourceRef } from '../../lib/quakes'

// Hoja del terremoto: media pantalla por defecto, expandible arrastrando.
const QSNAPS: (number | string)[] = [0.55, 0.92]

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

type Pin = {
  id: string
  type: string
  title: string
  lat: number
  lng: number
  confirms: number
  createdAt: number
}
// Reportes = capa por defecto del mapa. Sismos = capa que se enciende con el
// banner. Ayuda ya no es una "vista": es un dialog aparte (helpOpen).
type View = 'reportes' | 'sismos'
type Data = { pins: Pin[]; center: [number, number]; tooFar: boolean }

function pinIcon(p: Pin) {
  const t = typeOf(p.type)
  const cnt = p.confirms > 0 ? `<span class="cnt">${p.confirms}</span>` : ''
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin"><div class="m" style="background:${t.color}"><svg viewBox="0 0 24 24">${t.svg}</svg></div>${cnt}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 40],
  })
}

const youIcon = L.divIcon({
  className: 'pin-wrap',
  html: '<div class="ave-you"><span class="ring"></span><span class="dot"></span></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function quakeIcon(q: Quake, main: boolean) {
  const size = Math.max(14, Math.round(q.mag * 6))
  return L.divIcon({
    className: 'ave-epi-wrap',
    html: `<span class="ave-epi${main ? ' main' : ''}" style="--c:${magColor(q.mag)};width:${size}px;height:${size}px"></span>`,
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

// Color de severidad legible como texto: los tonos claros (amarillo/lima) se
// oscurecen para pasar contraste sobre blanco. ponytail: ajustar si cambia magColor.
function magInk(m: number) {
  const c = magColor(m)
  if (c === '#fdd835') return '#a8830a'
  if (c === '#9ccc65') return '#5f8f33'
  return c
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

export default function AyudaMap() {
  // Arranca en Reportes (mapa con pines + botones flotantes). El banner rojo
  // invita a abrir el terremoto; Ayuda es un dialog aparte.
  const [view, setView] = useState<View>('reportes')
  const [pins, setPins] = useState<Pin[]>([])
  const [user, setUser] = useState<[number, number] | null>(null)
  const [quakes, setQuakes] = useState<QuakeData | null>(null)
  const [snap, setSnap] = useState<number | string | null>(QSNAPS[0])
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
    setSnap(QSNAPS[0])
    const map = mapRef.current
    if (main && map) map.setView([main.lat, main.lng], QUAKE_ZOOM, { animate: false })
  }
  const closeSeismic = () => setView('reportes')
  const toggleSeismic = () => (view === 'sismos' ? closeSeismic() : openSeismic())

  return (
    <div className="ave-screen">
      <MapContainer
        className="ave-map"
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
            {quakes.shakemap != null && (
              <GeoJSON
                key={quakes.mainId}
                data={quakes.shakemap as GeoJSON.GeoJsonObject}
                style={(f) => ({
                  color: f?.properties?.color ?? '#888',
                  weight: f?.properties?.weight ?? 2,
                  opacity: 0.85,
                  fill: false,
                })}
              />
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
        <button
          className={`ave-quakebar${view === 'sismos' ? ' on' : ''}`}
          onClick={toggleSeismic}
          style={{ ['--sev' as string]: magColor(main.mag) }}
          aria-pressed={view === 'sismos'}
        >
          <span className="ave-pulse">
            <span className="ring" />
            <span className="dot" />
          </span>
          <span className="ave-qb-txt">
            <b>Información terremoto</b>
            <span>
              M {main.mag.toFixed(1)} · {fmtAge(main.time)} ·{' '}
              {esPlace(main.place) || 'Venezuela'}
            </span>
          </span>
        </button>
      )}

      {/* Riel flotante: Ayuda (abre dialog) + ubicación */}
      <div className="ave-rail">
        <button className="ave-efab" onClick={() => setHelpOpen(true)}>
          <Phone /> Ayuda
        </button>
        <button className="ave-fab" aria-label="Mi ubicación" onClick={recenter}>
          <LocateFixed />
        </button>
      </div>

      {/* Reportar: botón flotante (solo en el mapa de reportes) */}
      {view === 'reportes' && (
        // TODO(crear): flujo de reporte = siguiente entregable.
        <button className="ave-report-fab" type="button">
          <Plus /> Reportar
        </button>
      )}

      {/* Hoja Terremoto (Vaul, no-modal): el mapa sigue vivo arriba */}
      {view === 'sismos' && (
        <Drawer.Root
          open
          modal={false}
          dismissible
          handleOnly
          snapPoints={QSNAPS}
          activeSnapPoint={snap}
          setActiveSnapPoint={setSnap}
          onOpenChange={(o) => {
            if (!o) closeSeismic()
          }}
        >
          <Drawer.Portal>
            <Drawer.Content className="ave-drawer">
              <Drawer.Handle className="ave-handle" />
              <Drawer.Title className="ave-sr">Terremoto</Drawer.Title>
              <div className="ave-sheet-body">
                <QuakeSheet data={quakes} main={main} />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        userEstado={userEstado}
      />
    </div>
  )
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// Procedencia visible: todo dato publicado es público y comprobable. Referencias
// en formato APA, cada una con su link. Disclosure nativo (sin JS). [[no-misinformation]]
function Sources({ refs, note }: { refs: SourceRef[]; note: string }) {
  return (
    <details className="ave-src">
      <summary>
        <Info /> Fuentes y verificación
        <ChevronRight className="ave-src-caret" />
      </summary>
      <p className="ave-src-note">{note}</p>
      <ol>
        {refs.map((r) => (
          <li key={r.key}>
            {r.cite}
            {r.url && (
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {hostOf(r.url)}
                <ExternalLink />
              </a>
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}

const HELP_SOURCES: SourceRef[] = [
  {
    key: 'ven911',
    cite: 'Sistema Integrado de Emergencias 1-1-1 (VEN911). Números de emergencia nacionales.',
    url: 'https://www.ven911.gob.ve/',
  },
  {
    key: 'osm',
    cite: 'OpenStreetMap contributors. Cartografía base © OpenStreetMap.',
    url: 'https://www.openstreetmap.org/copyright',
  },
]

// Terremoto B — boletín: la magnitud como cifra protagonista, lenguaje de dato
// (sin juicios), probabilidades oficiales citadas. [[no-misinformation]]
function QuakeSheet({
  data,
  main,
}: {
  data: QuakeData | null
  main: Quake | null
}) {
  if (!data) return <p className="ave-empty">Cargando sismos…</p>
  const replicas = data.quakes
    .filter((q) => q.id !== data.mainId)
    .sort((a, b) => b.time - a.time)
  const fc = data.forecast
  const pct = (label: string) =>
    Math.round((fc?.windows.find((w) => w.label === label)?.m5 ?? 0) * 100)

  return (
    <>
      <h2>
        <Activity /> Terremoto
        <span className="ave-n">{data.quakes.length}</span>
      </h2>
      <p className="ave-meta">
        <span>Últimos 7 días en Venezuela</span>
        <span>Datos: USGS</span>
      </p>

      {data.quakes.length === 0 ? (
        <p className="ave-empty">Sin sismos registrados en este período.</p>
      ) : (
        <div className="ave-list">
          {/* Boletín: magnitud como cifra protagonista */}
          {main && (
            <div className="ave-bulletin">
              <div className="ave-bul-mag" style={{ color: magInk(main.mag) }}>
                <b>{main.mag.toFixed(1)}</b>
                <i>magnitud</i>
              </div>
              <div className="ave-bul-meta">
                <b>Terremoto · {fmtAge(main.time)}</b>
                <span>
                  {esPlace(main.place) || 'Venezuela'}
                  <br />
                  {Math.round(main.depth)} km de profundidad
                </span>
                <a href={main.url} target="_blank" rel="noopener noreferrer">
                  Ver en USGS <ExternalLink />
                </a>
              </div>
            </div>
          )}

          {/* Pronóstico de réplicas — probabilidad oficial, sin juicios */}
          <section className="ave-sec">
            <div className="ave-sec-h">
              <h3>Pronóstico de réplicas</h3>
              {fc && <span className="ave-sec-src">USGS · OAF</span>}
            </div>
            {fc ? (
              <>
                <p className="ave-lead">
                  Probabilidad de una réplica de <b>magnitud 5 o mayor</b>:
                </p>
                <div className="ave-probs">
                  <div className="p">
                    <b>{pct('1 Day')}%</b>
                    <span>en 24 h</span>
                  </div>
                  <div className="p">
                    <b>{pct('1 Week')}%</b>
                    <span>en 7 días</span>
                  </div>
                </div>
                <p className="ave-note">
                  Una réplica es un sismo posterior al evento principal. El
                  pronóstico es probabilístico: no indica su hora ni lugar
                  exacto.{' '}
                  {main && (
                    <a
                      href={`${main.url}/oaf/forecast`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver pronóstico <ExternalLink />
                    </a>
                  )}
                </p>
              </>
            ) : (
              <p className="ave-note">
                No hay un pronóstico oficial para estos sismos. Las réplicas no
                se pueden predecir con exactitud.
              </p>
            )}
          </section>

          {/* Zona afectada + escala MMI */}
          {data.shakemap && (
            <section className="ave-sec">
              <div className="ave-sec-h">
                <h3>Zona afectada</h3>
                {main && (
                  <a
                    className="ave-sec-lnk"
                    href={`${main.url}/shakemap`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ShakeMap <ExternalLink />
                  </a>
                )}
              </div>
              <p className="ave-body-p">
                Los contornos en el mapa marcan la intensidad de la sacudida
                (escala MMI de USGS), según la distancia al epicentro.
              </p>
              <div className="ave-mmi">
                <i style={{ background: '#a0e6b0' }} />
                <i style={{ background: '#f7f34f' }} />
                <i style={{ background: '#ffc100' }} />
                <i style={{ background: '#ff7100' }} />
                <i style={{ background: '#d7263d' }} />
              </div>
              <div className="ave-mmi-lbl">
                <span>Leve</span>
                <span>Moderada</span>
                <span>Severa</span>
              </div>
            </section>
          )}

          {replicas.length > 0 && (
            <section className="ave-sec">
              <div className="ave-sec-h">
                <h3>Réplicas registradas</h3>
                <span className="ave-n">{replicas.length}</span>
              </div>
              {replicas.map((q) => (
                <a
                  key={q.id}
                  className="ave-qrow"
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="ave-qm" style={{ color: magInk(q.mag) }}>
                    {q.mag.toFixed(1)}
                  </span>
                  <span className="t">
                    <b>{esPlace(q.place) || 'Venezuela'}</b>
                    <span>
                      {fmtAge(q.time)} · {Math.round(q.depth)} km prof.
                    </span>
                  </span>
                  <ExternalLink className="ave-qrow-ext" />
                </a>
              ))}
            </section>
          )}

          <Sources
            refs={buildSources(main)}
            note="Sismos registrados (no predichos) por la red sísmica de USGS. La zona afectada es el ShakeMap oficial; el pronóstico de réplicas es probabilístico."
          />
        </div>
      )}
    </>
  )
}

// Estados de Venezuela (selector del directorio de contactos por zona).
const VE_ESTADOS = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar',
  'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón',
  'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas',
  'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo',
  'Yaracuy', 'Zulia',
]

// Normaliza el estado que devuelve Nominatim al nombre de la lista (quita el
// prefijo "Estado", mapea el alias Vargas→La Guaira). null si no calza.
function matchEstado(raw: string): string | null {
  const n = raw.replace(/^estado\s+/i, '').trim()
  const target = /^vargas$/i.test(n) ? 'La Guaira' : n
  return VE_ESTADOS.find((e) => e.toLowerCase() === target.toLowerCase()) ?? null
}

// Ayuda = dialog de contactos (no un "modo"). Números nacionales + directorio
// por estado (preseleccionado por GPS). UI-only: la zona aún no tiene datos.
function HelpDialog({
  open,
  onClose,
  userEstado,
}: {
  open: boolean
  onClose: () => void
  userEstado: string | null
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const matched = userEstado ? matchEstado(userEstado) : null
  const [estado, setEstado] = useState('Yaracuy')

  // <dialog> nativo: backdrop, Esc y trampa de foco gratis. Sincronizamos su
  // estado abierto con la prop.
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  // Cuando el GPS resuelve el estado del usuario, lo dejamos preseleccionado.
  useEffect(() => {
    if (matched) setEstado(matched)
  }, [matched])

  return (
    <dialog
      ref={ref}
      className="ave-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // click en el backdrop
      }}
    >
      <div className="ave-dlg">
        <header className="ave-dlg-head">
          <div>
            <h2>
              <Phone /> Ayuda
            </h2>
            <p>Contactos de emergencia y de tu zona</p>
          </div>
          <button className="ave-dlg-x" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </header>

        <div className="ave-dlg-body">
          <p className="ave-dlg-sec">Nacional</p>
          {EMERGENCY.map((e) => (
            <a key={e.name} className="ave-crow" href={`tel:${e.phone}`}>
              <span className="ave-cic" style={{ background: '#0e9c8f' }}>
                <Phone />
              </span>
              <span className="t">
                <b>{e.name}</b>
                {e.note && <span>{e.note}</span>}
              </span>
              <span className="ph">{e.phone}</span>
            </a>
          ))}

          <p className="ave-dlg-sec">Contactos por zona</p>
          <label className="ave-zone">
            <span>Estado:</span>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              {VE_ESTADOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <div className="ave-empty-zone">
            <span className="mark">
              <Plus />
            </span>
            <b>Aún no hay contactos verificados aquí</b>
            <p>
              Refugios, salud, agua, electricidad. ¿Conoces uno en {estado}?
              Sugiérelo.
            </p>
          </div>

          {/* TODO(sugerir): formulario de contacto. */}
          <button className="ave-suggest" type="button">
            <Plus /> Sugerir un contacto
          </button>

          <Sources
            refs={HELP_SOURCES}
            note="Números de emergencia de fuentes oficiales."
          />
        </div>
      </div>
    </dialog>
  )
}
