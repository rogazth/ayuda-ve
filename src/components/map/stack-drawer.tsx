import { useEffect, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtAge, typeOf } from '../../reports/reports'
import { fetchReportsAtPoint } from '../../reports/reports.functions'
import type { StackItem } from '../../reports/reports.functions'
import type { Pin } from './types'

// Drawer de apilados: la fuente geocodifica por centroide, así que un punto puede
// tener miles de reportes. La burbuja del mapa los colapsa a un marcador; acá se
// listan todos para que sean alcanzables (sin esto, los apilados son invisibles —
// la queja original). Mismo chrome que QuakeDrawer / detalle.
//
// content-visibility:auto en cada fila: el navegador saltea layout/paint de las
// filas fuera de pantalla → miles de filas sin jank y sin librería de virtualización.
// ponytail native-feature; el upgrade (búsqueda/orden) va cuando se pida.
export function StackDrawer({
  point,
  onSelect,
  onClose,
}: {
  point: Pin
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<StackItem[] | null>(null)

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
    <div className="fixed inset-0 z-[900] flex flex-col bg-white text-[#1a1c1e]">
      <div
        className="flex flex-[0_0_auto] items-center gap-3 border-b border-[#f3f4f6] px-4"
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

      <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {items === null ? (
          <p className="px-4 py-6 text-[15px] text-[#6b7280]">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-[15px] text-[#6b7280]">
            No hay reportes en este punto.
          </p>
        ) : (
          <ul>
            {items.map((it) => {
              const t = typeOf(it.type)
              return (
                <li
                  key={it.id}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '64px' }}
                >
                  <button
                    className="flex w-full items-center gap-3 border-b border-[#f3f4f6] px-4 py-3 text-left active:bg-[#f6f8f7]"
                    onClick={() => onSelect(it.id)}
                  >
                    <span
                      className="grid size-9 flex-none place-items-center rounded-full border-2 border-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.2))] [&_svg]:size-[18px] [&_svg]:text-white"
                      style={{ background: t.color }}
                    >
                      <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: t.svg }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {it.title}
                      </span>
                      <span className="block text-[13px] text-[#6b7280]">
                        {t.label} · {fmtAge(it.createdAt)}
                      </span>
                    </span>
                    <ChevronRight className="size-[18px] flex-none text-[#9ca3af]" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
