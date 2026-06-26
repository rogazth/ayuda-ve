import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, SlidersHorizontal } from 'lucide-react'
import { fmtAge, typeOf } from '../../reports/reports'
import { fetchFeed, fetchTypeCounts } from '../../reports/reports.functions'
import type { FeedItem, TypeCounts } from '../../reports/reports.functions'
import { FiltersSheet } from './filters-sheet'

const PAGE = 20 // = FEED_LIMIT en reports.functions; página corta → done
const EMPTY: TypeCounts = { counts: {}, found: 0 }

// Feed cronológico de reportes (panel sobre el mapa, tab "Reportes"). Scroll
// infinito por cursor; chips = filtro + contador; hoja de Filtros con la lista
// completa. La card carga solo portada + nº de fotos (el detalle trae el resto).
export function FeedScreen({ onSelect }: { onSelect: (id: string) => void }) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [counts, setCounts] = useState<TypeCounts>(EMPTY)
  const [types, setTypes] = useState<string[]>([]) // [] = todos
  const [status, setStatus] = useState<'visible' | 'found'>('visible')
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  // reqId: una respuesta de un filtro viejo no pisa la del filtro actual.
  const reqId = useRef(0)

  const query = useCallback(
    (cursor?: number) => ({
      cursor,
      types: types.length ? types : undefined,
      status: status === 'found' ? ('found' as const) : undefined,
    }),
    [types, status],
  )

  // Primera página + reset al cambiar filtros.
  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setDone(false)
    fetchFeed({ data: query() })
      .then((page) => {
        if (id !== reqId.current) return
        setItems(page)
        setDone(page.length < PAGE)
        setLoading(false)
      })
      .catch(() => id === reqId.current && setLoading(false))
  }, [query])

  // Contadores de chips (una vez; cacheado en el borde).
  useEffect(() => {
    fetchTypeCounts()
      .then(setCounts)
      .catch(() => {})
  }, [])

  const loadMore = useCallback(() => {
    if (loading || done || !items.length) return
    const id = reqId.current
    setLoading(true)
    fetchFeed({ data: query(items[items.length - 1].createdAt) })
      .then((page) => {
        if (id !== reqId.current) return
        setItems((prev) => [...prev, ...page])
        setDone(page.length < PAGE)
        setLoading(false)
      })
      .catch(() => id === reqId.current && setLoading(false))
  }, [loading, done, items, query])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      (es) => es[0].isIntersecting && loadMore(),
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore])

  const toggleType = (t: string) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  // Chips inline: solo tipos con reportes, más poblados primero. La lista entera
  // vive en la hoja de Filtros.
  const chips = Object.entries(counts.counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  const filtered = types.length > 0 || status === 'found'

  return (
    <div className="fixed inset-0 z-[820] flex flex-col bg-surface-muted">
      <header
        className="flex-none border-b border-line bg-white"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <h1 className="px-4 pb-2 text-[20px] font-extrabold text-ink">Reportes</h1>
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="flex flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {counts.found > 0 && (
              <button
                type="button"
                onClick={() => setStatus((s) => (s === 'found' ? 'visible' : 'found'))}
                className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                  status === 'found'
                    ? 'border-success bg-success text-white'
                    : 'border-success-line bg-white text-success'
                }`}
              >
                <BadgeCheck className="size-[15px]" /> Encontrados
                <span className={status === 'found' ? 'opacity-90' : 'text-ink-muted'}>
                  {counts.found}
                </span>
              </button>
            )}
            {chips.map(([t, n]) => {
              const meta = typeOf(t)
              const on = types.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                    on ? 'text-white' : 'border-line bg-white text-ink-body'
                  }`}
                  style={on ? { background: meta.color, borderColor: meta.color } : undefined}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: on ? '#fff' : meta.color }}
                  />
                  {meta.label}
                  <span className={on ? 'opacity-90' : 'text-ink-muted'}>{n}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filtros"
            className={`relative grid size-[38px] flex-none place-items-center rounded-full border ${
              filtered ? 'border-lagoon text-lagoon-ink' : 'border-line text-ink-body'
            }`}
          >
            <SlidersHorizontal className="size-[18px]" />
            {filtered && (
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-lagoon ring-2 ring-white" />
            )}
          </button>
        </div>
      </header>

      <div
        className="flex-1 overflow-y-auto px-3 pt-3"
        style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        {items.map((it) => (
          <Card key={it.id} item={it} onClick={() => onSelect(it.id)} />
        ))}
        {!loading && !items.length && (
          <p className="mt-16 text-center text-[14px] text-ink-muted">
            No hay reportes con estos filtros.
          </p>
        )}
        {loading && (
          <p className="py-6 text-center text-[13px] text-ink-faint">Cargando…</p>
        )}
        <div ref={sentinel} className="h-px" />
      </div>

      {filtersOpen && (
        <FiltersSheet
          counts={counts}
          types={types}
          status={status}
          onTypes={setTypes}
          onStatus={setStatus}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  )
}

function Card({ item, onClick }: { item: FeedItem; onClick: () => void }) {
  const meta = typeOf(item.type)
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2.5 flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-[0_1px_3px_rgba(23,58,64,0.06)]"
    >
      <span
        className="grid size-[40px] flex-none place-items-center rounded-xl"
        style={{ background: meta.color }}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-[22px]"
          dangerouslySetInnerHTML={{ __html: meta.svg }}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-ink">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
          <span>{fmtAge(item.createdAt)}</span>
          {item.confirms > 0 && (
            <>
              <span className="text-ink-faint">·</span>
              <span>
                {item.confirms} {item.confirms === 1 ? 'confirma' : 'confirman'}
              </span>
            </>
          )}
          {item.verified && <BadgeCheck className="size-[15px] flex-none text-success" />}
        </p>
      </div>
      {item.cover && (
        <span className="relative flex-none">
          <img
            src={item.cover}
            alt=""
            loading="lazy"
            className="size-[64px] rounded-xl bg-surface-muted object-cover"
          />
          {item.mediaCount > 1 && (
            <span className="absolute right-1 bottom-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
              +{item.mediaCount - 1}
            </span>
          )}
        </span>
      )}
    </button>
  )
}
