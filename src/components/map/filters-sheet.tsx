import { Check, X } from 'lucide-react'
import { TYPES, typeOf } from '../../reports/reports'
import type { TypeCounts } from '../../reports/reports.functions'

// Hoja de filtros del feed: lista COMPLETA de tipos (con su conteo) + estado
// (Activos / Encontrados). La fila de chips del feed solo muestra los tipos con
// reportes; aquí están todos. Filtra en vivo (toca un tipo → el feed refetcha).
//
// ponytail: "buscar zona" queda fuera por ahora — el feed es cronológico global y
// `fetchFeed` no acepta bbox todavía; el filtro geográfico entra con Fase 3
// (cluster→zona), que ya pasa bounds al feed. Añadir aquí cuando exista.
export function FiltersSheet({
  counts,
  types,
  status,
  onTypes,
  onStatus,
  onClose,
}: {
  counts: TypeCounts
  types: string[]
  status: 'visible' | 'found'
  onTypes: (t: string[]) => void
  onStatus: (s: 'visible' | 'found') => void
  onClose: () => void
}) {
  const all = Object.keys(TYPES)
    .map((t) => [t, counts.counts[t] ?? 0] as const)
    .sort((a, b) => b[1] - a[1])
  const toggle = (t: string) =>
    onTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])
  const clean = !types.length && status === 'visible'

  return (
    <div
      className="fixed inset-0 z-[930] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[18px] font-bold text-ink">Filtrar reportes</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-[34px] place-items-center rounded-full bg-surface-muted text-sea-ink-soft"
          >
            <X className="size-[18px]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 text-[12px] font-bold tracking-[0.5px] text-ink-muted uppercase">
            Estado
          </p>
          <div className="mb-5 flex gap-2">
            <SegBtn active={status === 'visible'} onClick={() => onStatus('visible')}>
              Activos
            </SegBtn>
            <SegBtn active={status === 'found'} onClick={() => onStatus('found')}>
              Encontrados{counts.found > 0 ? ` · ${counts.found}` : ''}
            </SegBtn>
          </div>

          <p className="mb-2 text-[12px] font-bold tracking-[0.5px] text-ink-muted uppercase">
            Tipo
          </p>
          <div className="flex flex-col">
            {all.map(([t, n]) => {
              const meta = typeOf(t)
              const on = types.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  className="flex items-center gap-3 border-b border-surface-muted py-3 text-left last:border-0"
                >
                  <span
                    className="grid size-[30px] flex-none place-items-center rounded-lg"
                    style={{ background: meta.color }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-[18px]"
                      dangerouslySetInnerHTML={{ __html: meta.svg }}
                    />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">
                    {meta.label}
                  </span>
                  <span className="text-[13px] tabular-nums text-ink-muted">{n}</span>
                  <span
                    className={`grid size-[24px] flex-none place-items-center rounded-md border-2 ${
                      on
                        ? 'border-lagoon bg-lagoon text-white'
                        : 'border-line text-transparent'
                    }`}
                  >
                    <Check className="size-[15px]" strokeWidth={3} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <footer
          className="flex gap-3 border-t border-line px-5 pt-3"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            disabled={clean}
            onClick={() => {
              onTypes([])
              onStatus('visible')
            }}
            className="h-[48px] flex-1 rounded-2xl border border-line text-[15px] font-bold text-ink-body disabled:opacity-40"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[48px] flex-1 rounded-2xl bg-lagoon text-[15px] font-bold text-white"
          >
            Listo
          </button>
        </footer>
      </div>
    </div>
  )
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[44px] flex-1 rounded-xl text-[14px] font-bold ${
        active ? 'bg-lagoon text-white' : 'bg-surface-muted text-ink-body'
      }`}
    >
      {children}
    </button>
  )
}
