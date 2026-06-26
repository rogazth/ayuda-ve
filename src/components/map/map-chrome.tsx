import {
  Eye,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Megaphone,
  Menu,
  Newspaper,
  Phone,
  Plus,
  Siren,
  Waves,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtAge } from '../../reports/reports'
import { esPlace, magColor } from '../../quakes/quakes'
import type { Quake, QuakeData } from '../../quakes/quakes.functions'

// Tabs como overlays sobre el mapa montado (no rutas): 'mapa' = sin panel,
// el resto = panel fixed encima. Vive aquí para pintarse en el splash sin pop-in.
export type Tab = 'mapa' | 'reportes' | 'avisos' | 'mas'

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
  onClick,
}: {
  icon: LucideIcon
  label: string
  active: boolean
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
      <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
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
  heatmap,
  outsideVE,
  infoOpen,
  tab,
  onTab,
  onBanner,
  onHelp,
  onEmergency,
  onToggleSatellite,
  onToggleHeatmap,
  onRecenter,
  onReport,
}: {
  quakes: QuakeData | null
  satellite: boolean
  heatmap: boolean
  outsideVE: boolean
  infoOpen: boolean
  tab: Tab
  onTab: (t: Tab) => void
  onBanner: () => void
  onHelp: () => void
  onEmergency: () => void
  onToggleSatellite: () => void
  onToggleHeatmap: () => void
  onRecenter: () => void
  onReport: () => void
}) {
  const { main, latest } = mainAndLatest(quakes)
  const onMap = tab === 'mapa'
  return (
    <>
      {/* Top del mapa: Emergencias (acceso rápido, no enterrado) + badge del
          terremoto a su lado. Solo en la tab 'mapa'; oculto bajo el boletín. */}
      {onMap && !infoOpen && (
        <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[830] flex items-start gap-2 px-[14px]">
          <button
            type="button"
            onClick={onEmergency}
            className="inline-flex h-[40px] flex-none items-center gap-1.5 rounded-full bg-danger px-3.5 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(215,38,61,0.35)]"
          >
            <Siren className="size-[18px]" /> Emergencias
          </button>
          {main && (
            <Button
              variant="ghost"
              className="ave-quakebar h-auto min-w-0 flex-1 flex items-center gap-[10px] py-[9px] px-4 border-none rounded-full text-left cursor-pointer bg-white text-ink shadow-[0_3px_14px_rgba(23,58,64,0.18)] hover:bg-white hover:text-ink"
              onClick={onBanner}
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
              <span className="grid h-[24px] w-[24px] flex-[0_0_auto] place-items-center rounded-full bg-black/[0.06] text-ink">
                <Eye className="size-[16px] opacity-70" />
              </span>
            </Button>
          )}
        </div>
      )}

      {/* Riel flotante de capas: Ayuda + Vista + Intensidad + Mi ubicación. Solo
          en la tab 'mapa', por encima del bottom-nav. */}
      {onMap && (
        <div className="absolute right-[14px] bottom-[calc(78px+env(safe-area-inset-bottom))] z-[805] flex flex-col items-end gap-3">
          <Button
            variant="ghost"
            className="inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 border-none rounded-[999px] bg-white text-sea-ink text-[15px] font-bold shadow-[0_3px_12px_rgba(0,0,0,0.18)] cursor-pointer hover:bg-surface-muted hover:text-sea-ink"
            onClick={onHelp}
          >
            <Phone className="size-5 text-lagoon" /> Ayuda
          </Button>
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
          {/* Intensidad: prende/apaga el mapa de calor (sacudida MMI del sismo) */}
          <Button
            variant="ghost"
            className={`inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 rounded-[999px] text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,0.16)] border-none cursor-pointer ${
              heatmap
                ? 'bg-sea-ink text-white hover:bg-sea-ink hover:text-white'
                : 'bg-white text-sea-ink hover:bg-surface-muted hover:text-sea-ink'
            }`}
            aria-pressed={heatmap}
            onClick={onToggleHeatmap}
          >
            <Waves className="size-5" /> Intensidad
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

      {/* Bottom-nav: Mapa · Reportes · [FAB Reportar] · Avisos · Más. Siempre
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
        <NavBtn
          icon={Megaphone}
          label="Avisos"
          active={tab === 'avisos'}
          onClick={() => onTab('avisos')}
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
