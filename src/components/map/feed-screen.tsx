import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { fmtAge, typeOf } from '../../reports/reports'
import { fetchFeed, fetchTypeCounts } from '../../reports/reports.functions'
import type { FeedItem, TypeCounts } from '../../reports/reports.functions'

const PAGE = 20 // = FEED_LIMIT en reports.functions; página corta → done
const EMPTY: TypeCounts = { counts: {}, found: 0 }

// Feed cronológico de reportes (panel sobre el mapa, tab "Reportes"). Scroll
// infinito por cursor; los chips son el único filtro (selección única, con
// contador) — flechas laterales avisan que la fila se desplaza. La card carga
// solo portada + nº de fotos (el detalle trae el resto).
export function FeedScreen({ onSelect }: { onSelect: (id: string) => void }) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [counts, setCounts] = useState<TypeCounts>(EMPTY)
  const [types, setTypes] = useState<string[]>([]) // [] = todos
  const [status, setStatus] = useState<'visible' | 'found'>('visible')
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  // reqId: una respuesta de un filtro viejo no pisa la del filtro actual.
  const reqId = useRef(0)
  // Flechas laterales de la fila de chips: solo se muestran cuando hay scroll
  // disponible en ese lado (affordance para que se note que es deslizable).
  const chipsRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ l: false, r: false })
  const updateEdges = useCallback(() => {
    const el = chipsRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setEdges({ l: scrollLeft > 4, r: scrollLeft + clientWidth < scrollWidth - 4 })
  }, [])
  const nudge = (dir: number) => {
    const el = chipsRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }

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

  // Chips: solo tipos con reportes, más poblados primero. Selección única.
  const chips = Object.entries(counts.counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  const filtered = types.length > 0 || status === 'found'

  // Recalcula las flechas cuando llegan los contadores (los chips aparecen) y al
  // redimensionar.
  useEffect(() => {
    updateEdges()
    window.addEventListener('resize', updateEdges)
    return () => window.removeEventListener('resize', updateEdges)
  }, [updateEdges, chips.length])

  return (
    <div className="fixed inset-0 z-[820] flex flex-col bg-surface-muted">
      <header
        className="flex-none border-b border-line bg-white"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <h1 className="px-4 pb-2 text-[20px] font-extrabold text-ink">Reportes</h1>
        {/* Chips de filtro (Todos · tipos · Encontrados), selección única: tocar
            uno reemplaza el filtro. Flechas laterales con degradado: solo salen
            cuando hay scroll en ese lado, para que se note que la fila desliza. */}
        <div className="relative px-4 pb-3">
          <div
            ref={chipsRef}
            onScroll={updateEdges}
            className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              onClick={() => {
                setTypes([])
                setStatus('visible')
              }}
              className={`inline-flex flex-none items-center rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${
                !filtered ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-body'
              }`}
            >
              Todos
            </button>
            {chips.map(([t, n]) => {
              const meta = typeOf(t)
              const on = status === 'visible' && types.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTypes([t])
                    setStatus('visible')
                  }}
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
            {counts.found > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStatus('found')
                  setTypes([])
                }}
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
          </div>
          {edges.l && (
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label="Ver filtros anteriores"
              className="absolute top-0 bottom-3 left-0 z-10 flex items-center bg-gradient-to-r from-white via-white to-transparent pr-7 pl-4"
            >
              <span className="grid size-7 place-items-center rounded-full border border-line bg-white shadow-[0_1px_3px_rgba(23,58,64,0.14)]">
                <ChevronLeft className="size-[18px] text-ink-body" />
              </span>
            </button>
          )}
          {edges.r && (
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label="Ver más filtros"
              className="absolute top-0 bottom-3 right-0 z-10 flex items-center bg-gradient-to-l from-white via-white to-transparent pr-4 pl-7"
            >
              <span className="grid size-7 place-items-center rounded-full border border-line bg-white shadow-[0_1px_3px_rgba(23,58,64,0.14)]">
                <ChevronRight className="size-[18px] text-ink-body" />
              </span>
            </button>
          )}
        </div>
      </header>

      <div
        className="flex-1 overflow-y-auto px-3 pt-3"
        style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        {items.map((it) => (
          <ReportCard key={it.id} item={it} onClick={() => onSelect(it.id)} />
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
    </div>
  )
}

// Card del feed: fila superior (marca + tipo + dirección + tiempo), título y
// portada a ancho completo. La procedencia (verificado/comunidad) vive en el
// detalle, no en la lista. La dirección sale del meta (feedAddress). El conteo de
// comentarios por card se omite hasta que fetchFeed lo devuelva real (no mock).
// Compartida con StackDrawer (apilados de un punto).
export function ReportCard({ item, onClick }: { item: FeedItem; onClick: () => void }) {
  const meta = typeOf(item.type)
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 block w-full overflow-hidden rounded-2xl border border-line bg-white text-left shadow-[0_1px_3px_rgba(23,58,64,0.07)]"
    >
      <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
        <span
          className="grid size-9 flex-none place-items-center rounded-full"
          style={{ background: meta.color }}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[18px]"
            dangerouslySetInnerHTML={{ __html: meta.svg }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-extrabold tracking-[0.04em] uppercase"
            style={{ color: meta.color }}
          >
            {meta.label}
          </p>
          {item.address && (
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
              <MapPin className="size-[13px] flex-none" />
              <span className="truncate">{item.address}</span>
            </p>
          )}
        </div>
        <span className="flex-none text-[12px] text-ink-muted">
          {fmtAge(item.createdAt)}
        </span>
      </div>

      <p className="px-3 text-[16px] leading-snug font-bold text-ink">
        {item.title}
      </p>

      {item.cover && (
        <div className="relative mt-2.5">
          <img
            src={item.cover}
            alt=""
            loading="lazy"
            className="h-[280px] w-full bg-surface-muted object-cover"
          />
          {item.mediaCount > 1 && (
            <span className="absolute right-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">
              +{item.mediaCount - 1} fotos
            </span>
          )}
        </div>
      )}

      <div className="h-3" />
    </button>
  )
}
