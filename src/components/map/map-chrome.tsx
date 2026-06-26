import {
  Eye,
  Layers,
  LocateFixed,
  Phone,
  TriangleAlert,
  Waves,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtAge } from '../../reports/reports'
import { esPlace, magColor } from '../../quakes/quakes'
import type { Quake, QuakeData } from '../../quakes/quakes.functions'

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

// Chrome estático del mapa: badge del terremoto + riel (Ayuda/Vista/Intensidad/
// Mi ubicación) + Reportar. No toca `window`, así que sirve igual en el loader
// (handlers inertes, antes de que monte Leaflet) y en MapScreen (handlers vivos).
// Pintarlo en ambos = app shell: cuando el mapa real monta, los botones ya están
// en su sitio → sin pop-in ni reflow.
export function MapChrome({
  quakes,
  satellite,
  heatmap,
  outsideVE,
  infoOpen,
  onBanner,
  onHelp,
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
  onBanner: () => void
  onHelp: () => void
  onToggleSatellite: () => void
  onToggleHeatmap: () => void
  onRecenter: () => void
  onReport: () => void
}) {
  const { main, latest } = mainAndLatest(quakes)
  return (
    <>
      {/* Banner del terremoto: contexto vivo en el mapa + abre el boletín. Se
          oculta mientras el boletín (dialog full-screen) está abierto, que se
          cierra con la flecha de volver. */}
      {main && !infoOpen && (
        <Button
          variant="ghost"
          className="ave-quakebar absolute top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 z-[830] h-auto flex items-center gap-[10px] max-w-[min(92vw,360px)] py-[9px] px-4 border-none rounded-full text-left cursor-pointer bg-white text-[#1a1c1e] shadow-[0_3px_14px_rgba(23,58,64,0.18)] hover:bg-white hover:text-[#1a1c1e]"
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
          <span className="grid h-[24px] w-[24px] flex-[0_0_auto] place-items-center rounded-full bg-black/[0.06] text-[#1a1c1e]">
            <Eye className="size-[16px] opacity-70" />
          </span>
        </Button>
      )}

      {/* Riel flotante: Ayuda (abre dialog) + capas + ubicación */}
      <div className="absolute right-[14px] bottom-[calc(86px+env(safe-area-inset-bottom))] z-[805] flex flex-col items-end gap-3">
        <Button
          variant="ghost"
          className="inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 border-none rounded-[999px] bg-white text-[#173a40] text-[15px] font-bold shadow-[0_3px_12px_rgba(0,0,0,0.18)] cursor-pointer hover:bg-[#f3faf5] hover:text-[#173a40]"
          onClick={onHelp}
        >
          <Phone className="size-5 text-[#0e9c8f]" /> Ayuda
        </Button>
        <Button
          variant="ghost"
          className={`inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 rounded-[999px] text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,0.16)] border-none cursor-pointer ${
            satellite
              ? 'bg-[#173a40] text-white hover:bg-[#173a40] hover:text-white'
              : 'bg-white text-[#173a40] hover:bg-[#f3faf5] hover:text-[#173a40]'
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
              ? 'bg-[#173a40] text-white hover:bg-[#173a40] hover:text-white'
              : 'bg-white text-[#173a40] hover:bg-[#f3faf5] hover:text-[#173a40]'
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
            className="inline-flex items-center gap-2 h-[46px] pr-[18px] pl-4 rounded-[999px] bg-white text-[#173a40] text-[15px] font-bold shadow-[0_3px_10px_rgba(0,0,0,0.16)] border-none cursor-pointer hover:bg-[#f3faf5] hover:text-[#173a40]"
            onClick={onRecenter}
          >
            <LocateFixed className="size-5 text-[#0e9c8f]" /> Mi ubicación
          </Button>
        )}
      </div>

      {/* Reportar: acción siempre disponible (el boletín la tapa al abrirse) */}
      <Button
        variant="ghost"
        className="absolute left-4 right-4 bottom-[calc(20px+env(safe-area-inset-bottom))] z-[800] h-[54px] border-none rounded-[16px] bg-[#0e9c8f] text-white text-[17px] font-bold flex items-center justify-center gap-[9px] shadow-[0_6px_18px_rgba(14,156,143,0.4)] cursor-pointer hover:bg-[#0c8a7e] hover:text-white"
        type="button"
        onClick={onReport}
      >
        <TriangleAlert className="size-[21px]" /> Reportar
      </Button>
    </>
  )
}
