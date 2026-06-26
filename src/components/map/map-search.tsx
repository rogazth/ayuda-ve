import { X } from 'lucide-react'
import type { Map as LeafletMap } from 'leaflet'
import { LocationSearch } from './location-picker'

// Buscador de lugares del mapa (POC A: lupa del topbar). Reusa LocationSearch
// (Mapbox Search Box, server-side): al elegir un lugar, vuela el mapa ahí y
// cierra. Busca lugares (no reportes), sesgado a Venezuela.
export function MapSearch({
  mapRef,
  onClose,
}: {
  mapRef: React.RefObject<LeafletMap | null>
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-[850] flex items-start gap-2 px-3"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      <div className="flex-1">
        <LocationSearch mapRef={mapRef} onPicked={onClose} />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar búsqueda"
        className="grid size-[44px] flex-none place-items-center rounded-xl bg-white text-ink-muted shadow-[0_3px_12px_rgba(23,58,64,0.18)]"
      >
        <X className="size-5" />
      </button>
    </div>
  )
}
