import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchReportsAtPoint } from '../../reports/reports.functions'
import type { FeedItem } from '../../reports/reports.functions'
import { ReportCard } from './feed-screen'
import type { Pin } from './types'

// Drawer de apilados: la fuente geocodifica por centroide, así que un punto puede
// tener miles de reportes. La burbuja del mapa los colapsa a un marcador; acá se
// listan todos para que sean alcanzables (sin esto, los apilados son invisibles —
// la queja original). Mismo chrome que QuakeDrawer / detalle.
//
// content-visibility:auto en cada card: el navegador saltea layout/paint de las
// que están fuera de pantalla → miles de cards sin jank y sin librería de
// virtualización. Misma ReportCard que el tab Reportes; el upgrade (búsqueda/orden)
// va cuando se pida.
export function StackDrawer({
  point,
  onSelect,
  onClose,
}: {
  point: Pin
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<FeedItem[] | null>(null)

  useEffect(() => {
    let alive = true
    setItems(null)
    fetchReportsAtPoint({ data: { lat: point.lat, lng: point.lng } })
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [point.lat, point.lng])

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-surface-muted text-[#1a1c1e]">
      <div
        className="flex flex-[0_0_auto] items-center gap-3 border-b border-[#f3f4f6] bg-white px-4"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <span className="flex-1 truncate text-[17px] font-bold">
          {items ? `${items.length} reportes aquí` : 'Reportes aquí'}
        </span>
        <Button
          variant="ghost"
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border-0 bg-[#f1f4f2] text-[#416166] hover:bg-[#e7ebe9] hover:text-[#416166]"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X className="size-[18px]" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-[env(safe-area-inset-bottom)]">
        {items === null ? (
          <p className="px-1 py-6 text-[15px] text-[#6b7280]">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="px-1 py-6 text-[15px] text-[#6b7280]">
            No hay reportes en este punto.
          </p>
        ) : (
          items.map((it) => (
            // containIntrinsicSize aprox. la altura de una card con portada; basta
            // para que el navegador estime el scroll sin pintar las de fuera.
            <div key={it.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '320px' }}>
              <ReportCard item={it} onClick={() => onSelect(it.id)} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
