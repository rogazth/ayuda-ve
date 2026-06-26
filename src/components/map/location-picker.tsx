import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import type { Map as LeafletMap } from 'leaflet'
import { geoSuggest, geoRetrieve, type Suggestion } from '../../geo/geo.functions'

// Búsqueda de dirección (Mapbox Search Box, server-side). Mueve EL MAPA VIVO con
// flyTo; no captura la ubicación: el pin es el centro del mapa y se lee al
// confirmar. suggest+retrieve comparten session_token (un cobro) y rota tras pick.
function LocationSearch({ mapRef }: { mapRef: React.RefObject<LeafletMap | null> }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const skip = useRef(false)
  const session = useRef(crypto.randomUUID())

  useEffect(() => {
    // Salta la re-búsqueda que dispara pick() al escribir el label elegido en q.
    if (skip.current) {
      skip.current = false
      return
    }
    const query = q.trim()
    if (query.length < 3) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const c = mapRef.current?.getCenter()
        const res = await geoSuggest({
          data: {
            q: query,
            session: session.current,
            proximity: c ? `${c.lng},${c.lat}` : undefined,
          },
        })
        if (cancelled) return
        setResults(res)
        setOpen(true)
      } catch {
        /* offline — deja resultados previos */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, mapRef])

  const pick = async (r: Suggestion) => {
    skip.current = true
    setQ(r.name)
    setResults([])
    setOpen(false)
    const p = await geoRetrieve({ data: { id: r.id, session: session.current } })
    session.current = crypto.randomUUID() // retrieve cierra la sesión: rota el token
    if (!p) return
    mapRef.current?.flyTo(p, 16, { duration: 0.6 })
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-lg">
        <Search className="size-4 flex-shrink-0 text-[#6b7280]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar dirección, urbanización o estado…"
          className="flex-1 bg-transparent text-sm text-[#1a1c1e] outline-none"
        />
        {loading && <span className="text-xs text-[#9ca3af]">…</span>}
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('')
              setResults([])
              setOpen(false)
            }}
          >
            <X className="size-4 text-[#9ca3af]" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-[1001] mt-1.5 max-h-64 overflow-y-auto rounded-xl bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => pick(r)}
              className="flex w-full items-start gap-2 border-b border-[#f3f4f6] px-3 py-2.5 text-left last:border-0 hover:bg-[#f3f4f6]"
            >
              <MapPin className="mt-0.5 size-4 flex-shrink-0 text-[#0e9c8f]" />
              <span className="text-sm leading-snug text-[#1a1c1e]">
                <span className="font-medium">{r.name}</span>
                {r.place && <span className="text-[#6b7280]">, {r.place}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Selección de ubicación SOBRE el mapa vivo (no monta un segundo mapa ni recentra).
// MapScreen oculta el chrome mientras esto está activo: arriba la búsqueda + X,
// el pin fijo en el centro del viewport (= centro del mapa, que es full-screen), y
// abajo el botón que confirma. Al confirmar se lee el centro y abre el wizard.
export function LocationPicker({
  mapRef,
  onConfirm,
  onCancel,
}: {
  mapRef: React.RefObject<LeafletMap | null>
  onConfirm: (loc: [number, number]) => void
  onCancel: () => void
}) {
  const confirm = () => {
    const c = mapRef.current?.getCenter()
    if (c) onConfirm([c.lat, c.lng])
  }

  return (
    <>
      {/* búsqueda arriba + X a la derecha (cancela) */}
      <div
        className="fixed inset-x-0 top-0 z-[1000] flex items-start gap-2 px-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex-1">
          <LocationSearch mapRef={mapRef} />
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar"
          className="grid size-[44px] flex-none place-items-center rounded-xl bg-white text-[#6b7280] shadow-lg"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* pin fijo — la punta apunta al centro del mapa */}
      <div className="pointer-events-none fixed left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-full">
        <MapPin
          className="size-10 text-[#0e9c8f] drop-shadow-lg"
          fill="#0e9c8f"
          stroke="#fff"
          strokeWidth={1.5}
        />
      </div>

      {/* botón de confirmar (donde estaba el toolbar) */}
      <div
        className="fixed inset-x-0 bottom-0 z-[1000] px-4 pt-3"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <p className="mb-2.5 flex justify-center">
          <span className="rounded-full bg-black/75 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
            📍 Mueve el mapa para centrar el punto
          </span>
        </p>
        <button
          type="button"
          onClick={confirm}
          className="h-[54px] w-full rounded-2xl bg-[#0e9c8f] text-[17px] font-bold text-white shadow-lg active:bg-[#0c8a7e]"
        >
          Reportar aquí
        </button>
      </div>
    </>
  )
}
