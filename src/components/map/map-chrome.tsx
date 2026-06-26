import {
  Heart,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Menu,
  Newspaper,
  Plus,
  Search,
  Siren,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtAge } from '../../reports/reports'
import { magColor } from '../../quakes/quakes'
import type { Quake, QuakeData } from '../../quakes/quakes.functions'

// Tabs como overlays sobre el mapa montado (no rutas): 'mapa' = sin panel,
// el resto = panel fixed encima. Vive aquí para pintarse en el splash sin pop-in.
export type Tab = 'mapa' | 'reportes' | 'avisos' | 'mas' | 'ayudar'

// Sismo principal (el del badge) y la réplica más reciente. Usado por MapScreen
// (centra el mapa en el principal) y por el chrome para pintar el badge.
export function mainAndLatest(data: QuakeData | null): {
  main: Quake | null
  latest: Quake | null
} {
  const main = data?.quakes.find((q) => q.id === data.mainId) ?? null
  const latest =
    data?.quakes
      .filter((q) => q.id !== data.mainId)
      .reduce<Quake | null>((a, q) => (!a || q.time > a.time ? q : a), null) ??
    null
  return { main, latest }
}

// Ítem del bottom-nav: ícono + label (el label es clave para mayores). Activo =
// lagoon-ink; inactivo = ink-muted.
function NavBtn({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  badge?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center justify-center gap-[3px] pt-[9px] pb-[5px] text-[11px] font-semibold ${
        active ? 'text-lagoon-ink' : 'text-ink-muted'
      }`}
    >
      <span className="relative">
        <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
        {badge && (
          <span className="absolute -top-0.5 -right-[7px] size-2 rounded-full bg-danger ring-2 ring-white" />
        )}
      </span>
      {label}
    </button>
  )
}

// Chrome del mapa: top (Emergencias + badge del terremoto), riel de capas, y el
// bottom-nav con FAB Reportar. El top y el riel solo viven en la tab 'mapa'; el
// bottom-nav siempre. No toca `window`, así sirve igual en el loader (handlers
// inertes, app shell) y en MapScreen (handlers vivos) → sin pop-in ni reflow.
export function MapChrome({
  quakes,
  satellite,
  outsideVE,
  infoOpen,
  searchOpen,
  tab,
  onTab,
  onBanner,
  onEmergency,
  onSearch,
  onToggleSatellite,
  onRecenter,
  onReport,
}: {
  quakes: QuakeData | null
  satellite: boolean
  outsideVE: boolean
  infoOpen: boolean
  searchOpen: boolean
  tab: Tab
  onTab: (t: Tab) => void
  onBanner: () => void
  onEmergency: () => void
  onSearch: () => void
  onToggleSatellite: () => void
  onRecenter: () => void
  onReport: () => void
}) {
  const { main, latest } = mainAndLatest(quakes)
  // "El último sismo": la réplica más reciente o, si no hay, el principal.
  const last = latest ?? main
  // El buscador trae su propia barra arriba → ocultamos el top del mapa
  // (Emergencias + badge del terremoto) para no encimar ni duplicar.
  const onMap = tab === 'mapa' && !searchOpen
  return (
    <>
      {/* Top del mapa (POC A): fila 1 = buscar (izq) + Emergencias (der,
          prominente); fila 2 = badge del terremoto. Solo en 'mapa'; oculto bajo
          el boletín. */}
      {onMap && !infoOpen && (
        <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[830] px-[14px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSearch}
              aria-label="Buscar lugar"
              className="grid size-[40px] flex-none place-items-center rounded-full border border-line bg-white text-ink shadow-[0_3px_12px_rgba(23,58,64,0.14)]"
            >
              <Search className="size-[19px]" />
            </button>
            <button
              type="button"
              onClick={onEmergency}
              className="ml-auto inline-flex h-[40px] flex-none items-center gap-1.5 rounded-full bg-danger px-3.5 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(215,38,61,0.35)]"
            >
              <Siren className="size-[18px]" /> Emergencias
            </button>
          </div>
          {last && (
            <div className="mt-2 flex">
              <Button
                variant="ghost"
                className="ave-quakebar inline-flex h-auto min-w-0 items-center gap-2 rounded-full border-none bg-white px-3.5 py-[7px] text-left text-ink shadow-[0_3px_14px_rgba(23,58,64,0.18)] hover:bg-white hover:text-ink"
                onClick={onBanner}
                style={{ ['--sev' as string]: magColor(last.mag) }}
                aria-expanded={false}
              >
                <span className="relative grid h-[12px] w-[12px] flex-none place-items-center">
                  <span className="absolute inset-0 rounded-full border-2 border-[color:var(--sev)] animate-pulse-ring motion-reduce:animate-none" />
                  <span className="h-[8px] w-[8px] rounded-full bg-[var(--sev)] shadow-[0_0_0_2px_#fff]" />
                </span>
                <span className="text-[15px] font-bold whitespace-nowrap">
                  Último sismo · M {last.mag.toFixed(1)} · {fmtAge(last.time)}
                </span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Riel flotante de capas: Vista + Mi ubicación. Solo en la tab 'mapa', por
          encima del bottom-nav. (Ayuda salió: duplicaba Emergencias. Intensidad
          se movió al boletín del terremoto.) */}
      {onMap && (
        <div className="absolute right-[14px] bottom-[calc(78px+env(safe-area-inset-bottom))] z-[805] flex flex-col items-end gap-3">
          <Button
            variant="ghost"
            className={`inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 rounded-[999px] text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,0.16)] border-none cursor-pointer ${
              satellite
                ? 'bg-sea-ink text-white hover:bg-sea-ink hover:text-white'
                : 'bg-white text-sea-ink hover:bg-surface-muted hover:text-sea-ink'
            }`}
            aria-pressed={satellite}
            onClick={onToggleSatellite}
          >
            <Layers className="size-5" /> Vista
          </Button>
          {/* Centrar: oculto si el GPS confirmó al usuario fuera de Venezuela */}
          {!outsideVE && (
            <Button
              variant="ghost"
              className="inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 rounded-[999px] bg-white text-sea-ink text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,0.16)] border-none cursor-pointer hover:bg-surface-muted hover:text-sea-ink"
              onClick={onRecenter}
            >
              <LocateFixed className="size-5 text-lagoon" /> Mi ubicación
            </Button>
          )}
        </div>
      )}

      {/* Bottom-nav: Mapa · Reportes · [FAB Reportar] · Ayudar · Más. Siempre
          visible (también en el splash). El FAB sobresale por encima del riel. */}
      <nav className="fixed inset-x-0 bottom-0 z-[840] flex items-stretch border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(23,58,64,0.08)]">
        <NavBtn
          icon={MapIcon}
          label="Mapa"
          active={tab === 'mapa'}
          onClick={() => onTab('mapa')}
        />
        <NavBtn
          icon={Newspaper}
          label="Reportes"
          active={tab === 'reportes'}
          onClick={() => onTab('reportes')}
        />
        {/* FAB central: la acción primaria. Sobresale del bar (-top) con sombra. */}
        <div className="relative w-[76px] flex-none">
          <button
            type="button"
            onClick={onReport}
            aria-label="Reportar"
            className="absolute -top-[20px] left-1/2 grid size-[58px] -translate-x-1/2 place-items-center rounded-full border-[3px] border-white bg-lagoon text-white shadow-[0_6px_16px_rgba(14,156,143,0.45)] active:translate-y-px"
          >
            <Plus className="size-7" strokeWidth={2.6} />
          </button>
          <span className="absolute inset-x-0 bottom-[5px] text-center text-[11px] font-semibold text-lagoon-ink">
            Reportar
          </span>
        </div>
        {/* "Ayudar" = tab del directorio de acopio/donar (panel bajo el nav,
            igual que Reportes). Reemplazó a Avisos —oculto, difícil de mantener
            automatizado, su código sigue vivo— y rebalancea el nav (2 + 2). */}
        <NavBtn
          icon={Heart}
          label="Ayudar"
          active={tab === 'ayudar'}
          onClick={() => onTab('ayudar')}
        />
        <NavBtn
          icon={Menu}
          label="Más"
          active={tab === 'mas'}
          onClick={() => onTab('mas')}
        />
      </nav>
    </>
  )
}
