import { useState } from 'react'
import { Drawer } from 'vaul'
import { Activity, ExternalLink, X } from 'lucide-react'
import { fmtAge } from '../../reports/reports'
import type { Quake, QuakeData } from '../../quakes/quakes.functions'
import { buildSources, esPlace, magColor } from '../../quakes/quakes'
import { Sources } from './sources'

// Hoja del terremoto: media pantalla por defecto, expandible arrastrando.
// SNAP_MIN = solo título + X (el mapa queda visible con el heatmap).
const SNAP_MIN = '62px'
const QSNAPS: (number | string)[] = [SNAP_MIN, 0.55, 0.92]

// Color de severidad legible como texto: los tonos claros (amarillo/lima) se
// oscurecen para pasar contraste sobre blanco. ponytail: ajustar si cambia magColor.
function magInk(m: number) {
  const c = magColor(m)
  if (c === '#fdd835') return '#a8830a'
  if (c === '#9ccc65') return '#5f8f33'
  return c
}

// Hoja Terremoto (Vaul, no-modal): el mapa sigue vivo arriba. Dueña de su propio
// snap; el centrado fino del epicentro lo hace el map-screen midiendo `.ave-drawer`.
export function QuakeDrawer({
  data,
  main,
  onClose,
}: {
  data: QuakeData | null
  main: Quake | null
  onClose: () => void
}) {
  const [snap, setSnap] = useState<number | string | null>(0.55)
  const collapsed = snap === SNAP_MIN
  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      handleOnly
      snapPoints={QSNAPS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        {/* --ave-sheet-vh = alto del snap activo: la lista recorta a la
            franja visible y scrollea dentro, sin tener que expandir. */}
        <Drawer.Content
          className="ave-drawer fixed inset-x-0 bottom-0 z-[820] flex h-[100dvh] max-h-[100dvh] flex-col rounded-t-[20px] bg-white text-[#1a1c1e] shadow-[0_-8px_28px_rgba(23,58,64,0.16)] outline-none"
          style={{
            ['--ave-sheet-vh' as string]: `${Math.round(
              (typeof snap === 'number' ? snap : 0.55) * 100,
            )}dvh`,
          }}
        >
          <Drawer.Handle className="mx-auto my-[10px] h-[5px] w-[38px] flex-[0_0_auto] rounded-[3px] bg-[#dadde0]" />
          <Drawer.Title className="sr-only">Terremoto</Drawer.Title>

          {/* Header siempre visible: en collapsed es lo único que se ve */}
          <div className="flex flex-[0_0_auto] items-center gap-[8px] px-[18px] pb-[10px]">
            <Activity className="h-[18px] w-[18px] flex-[0_0_auto] text-[#0e9c8f]" />
            <span className="flex-1 text-[17px] font-semibold">Terremoto</span>
            {data && (
              <span className="rounded-full bg-[#0e9c8f]/10 px-[9px] py-[2px] text-[13px] font-bold text-[#0e9c8f]">
                {data.quakes.length}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="ml-[4px] flex h-[30px] w-[30px] flex-[0_0_auto] items-center justify-center rounded-full bg-[#f0f2f3] text-[#737f82] hover:bg-[#e3e6e8]"
            >
              <X className="h-[16px] w-[16px]" />
            </button>
          </div>

          {!collapsed && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[18px] pb-[calc(12px+env(safe-area-inset-bottom))]">
              <QuakeSheet data={data} main={main} />
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

// Terremoto B — boletín: la magnitud como cifra protagonista, lenguaje de dato
// (sin juicios), probabilidades oficiales citadas. [[no-misinformation]]
function QuakeSheet({
  data,
  main,
}: {
  data: QuakeData | null
  main: Quake | null
}) {
  if (!data)
    return (
      <p className="py-[18px] text-center text-[14px] text-[#737f82]">
        Cargando sismos…
      </p>
    )
  const replicas = data.quakes
    .filter((q) => q.id !== data.mainId)
    .sort((a, b) => b.time - a.time)
  const fc = data.forecast
  const pct = (label: string) =>
    Math.round((fc?.windows.find((w) => w.label === label)?.m5 ?? 0) * 100)

  return (
    <>
      <p className="mb-[14px] flex justify-between gap-[8px] text-[12px] text-[#737f82]">
        <span>Últimos 7 días en Venezuela</span>
        <span>Datos: USGS</span>
      </p>

      {data.quakes.length === 0 ? (
        <p className="py-[18px] text-center text-[14px] text-[#737f82]">
          Sin sismos registrados en este período.
        </p>
      ) : (
        <div className="mx-[-18px] max-h-[calc(var(--ave-sheet-vh,55dvh)-96px)] flex-[1_1_auto] overflow-y-auto px-[18px]">
          {/* Boletín: magnitud como cifra protagonista */}
          {main && (
            <div className="mb-[4px] flex items-start gap-[18px] border-b border-[#ededeb] px-[2px] pt-[4px] pb-[18px]">
              <div
                className="flex-[0_0_auto] text-center leading-[0.85]"
                style={{ color: magInk(main.mag) }}
              >
                <b className="block text-[58px] font-extrabold tracking-[-3px] tabular-nums">
                  {main.mag.toFixed(1)}
                </b>
                <i className="text-[11px] font-extrabold tracking-[1.2px] uppercase not-italic">
                  magnitud
                </i>
              </div>
              <div className="min-w-0 pt-[7px]">
                <b className="block text-[18px] font-bold text-[#173a40]">
                  Terremoto · {fmtAge(main.time)}
                </b>
                <span className="mt-[4px] block text-[13.5px] leading-[1.55] text-[#416166]">
                  {esPlace(main.place) || 'Venezuela'}
                  <br />
                  {Math.round(main.depth)} km de profundidad
                </span>
                <a
                  className="mt-[9px] inline-flex items-center gap-[4px] text-[13px] font-bold text-[#0e9c8f] no-underline"
                  href={main.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver en USGS <ExternalLink className="h-[13px] w-[13px]" />
                </a>
              </div>
            </div>
          )}

          {/* Pronóstico de réplicas — probabilidad oficial, sin juicios */}
          <section className="mt-[4px]">
            <div className="mt-[20px] mb-[8px] flex items-baseline gap-[8px]">
              <h3 className="text-[16px] font-bold text-[#173a40]">
                Pronóstico de réplicas
              </h3>
              {fc && (
                <span className="ml-auto text-[11px] font-bold tracking-[0.4px] text-[#737f82] uppercase">
                  USGS · OAF
                </span>
              )}
            </div>
            {fc ? (
              <>
                <p className="mb-[12px] text-[13.5px] leading-[1.5] text-[#416166]">
                  Probabilidad de una réplica de <b>magnitud 5 o mayor</b>:
                </p>
                <div className="flex gap-[24px]">
                  <div>
                    <b className="text-[24px] font-extrabold tracking-[-0.5px] text-[#173a40] tabular-nums">
                      {pct('1 Day')}%
                    </b>
                    <span className="mt-[4px] block text-[12px] font-semibold text-[#737f82]">
                      en 24 h
                    </span>
                  </div>
                  <div>
                    <b className="text-[24px] font-extrabold tracking-[-0.5px] text-[#173a40] tabular-nums">
                      {pct('1 Week')}%
                    </b>
                    <span className="mt-[4px] block text-[12px] font-semibold text-[#737f82]">
                      en 7 días
                    </span>
                  </div>
                </div>
                <p className="mt-[12px] text-[12.5px] leading-[1.55] text-[#737f82]">
                  Una réplica es un sismo posterior al evento principal. El
                  pronóstico es probabilístico: no indica su hora ni lugar
                  exacto.{' '}
                  {main && (
                    <a
                      className="inline-flex items-center gap-[3px] font-bold whitespace-nowrap text-[#0e9c8f] no-underline"
                      href={`${main.url}/oaf/forecast`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver pronóstico{' '}
                      <ExternalLink className="h-[12px] w-[12px]" />
                    </a>
                  )}
                </p>
              </>
            ) : (
              <p className="mt-[12px] text-[12.5px] leading-[1.55] text-[#737f82]">
                No hay un pronóstico oficial para estos sismos. Las réplicas no
                se pueden predecir con exactitud.
              </p>
            )}
          </section>

          {/* Zona afectada + escala MMI */}
          {data.shakemap && (
            <section className="mt-[4px]">
              <div className="mt-[20px] mb-[8px] flex items-baseline gap-[8px]">
                <h3 className="text-[16px] font-bold text-[#173a40]">
                  Zona afectada
                </h3>
                {main && (
                  <a
                    className="ml-auto inline-flex items-center gap-[3px] text-[13px] font-semibold text-[#0e9c8f] no-underline"
                    href={`${main.url}/shakemap`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ShakeMap <ExternalLink className="h-[13px] w-[13px]" />
                  </a>
                )}
              </div>
              <p className="text-[13.5px] leading-[1.55] text-[#3a4145]">
                Los contornos en el mapa marcan la intensidad de la sacudida
                (escala MMI de USGS), según la distancia al epicentro.
              </p>
              <div className="mt-[12px] mb-[5px] flex h-[8px] overflow-hidden rounded-[5px]">
                <i className="flex-1" style={{ background: '#a0e6b0' }} />
                <i className="flex-1" style={{ background: '#f7f34f' }} />
                <i className="flex-1" style={{ background: '#ffc100' }} />
                <i className="flex-1" style={{ background: '#ff7100' }} />
                <i className="flex-1" style={{ background: '#d7263d' }} />
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-[#737f82]">
                <span>Leve</span>
                <span>Moderada</span>
                <span>Severa</span>
              </div>
            </section>
          )}

          {replicas.length > 0 && (
            <section className="mt-[4px]">
              <div className="mt-[20px] mb-[8px] flex items-baseline gap-[8px]">
                <h3 className="text-[16px] font-bold text-[#173a40]">
                  Réplicas registradas
                </h3>
                <span className="rounded-full bg-[#0e9c8f]/10 px-[9px] py-[2px] text-[13px] font-bold text-[#0e9c8f]">
                  {replicas.length}
                </span>
              </div>
              {replicas.map((q) => (
                <a
                  key={q.id}
                  className="flex items-center gap-[12px] border-t border-[#ededeb] py-[11px] text-inherit no-underline"
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span
                    className="flex-[0_0_38px] text-center text-[17px] font-extrabold tabular-nums"
                    style={{ color: magInk(q.mag) }}
                  >
                    {q.mag.toFixed(1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block overflow-hidden text-[14.5px] font-semibold text-ellipsis whitespace-nowrap">
                      {esPlace(q.place) || 'Venezuela'}
                    </b>
                    <span className="text-[12.5px] text-[#737f82]">
                      {fmtAge(q.time)} · {Math.round(q.depth)} km prof.
                    </span>
                  </span>
                  <ExternalLink className="h-[14px] w-[14px] flex-[0_0_auto] text-[#b3bcbe]" />
                </a>
              ))}
            </section>
          )}

          <Sources
            refs={buildSources(main)}
            note="Sismos registrados (no predichos) por la red sísmica de USGS. La zona afectada es el ShakeMap oficial; el pronóstico de réplicas es probabilístico."
          />
        </div>
      )}
    </>
  )
}
