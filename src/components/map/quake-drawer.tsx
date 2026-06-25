import { Activity, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtDateTime } from '../../reports/reports'
import type { Quake, QuakeData } from '../../quakes/quakes.functions'
import { buildSources, esPlace, magColor } from '../../quakes/quakes'
import { Sources } from './sources'

// Color de severidad legible como texto: los tonos claros (amarillo/lima) se
// oscurecen para pasar contraste sobre blanco. ponytail: ajustar si cambia magColor.
function magInk(m: number) {
  const c = magColor(m)
  if (c === '#fdd835') return '#a8830a'
  if (c === '#9ccc65') return '#5f8f33'
  return c
}

// Intervalo entre dos sismos del doblete, en la unidad legible más grande.
function fmtGap(ms: number) {
  const s = Math.round(ms / 1000)
  if (s < 90) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 90) return `${m} min`
  return `${Math.round(m / 60)} h`
}

// Boletín Terremoto: dialog full-screen con el mismo chrome que el detalle de
// reporte (flecha de volver + título). Se cierra con la flecha.
export function QuakeDrawer({
  data,
  main,
  onClose,
}: {
  data: QuakeData | null
  main: Quake | null
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-white text-[#1a1c1e]">
      {/* Header — mismo chrome que el detalle de reporte */}
      <div
        className="flex flex-[0_0_auto] items-center gap-3 border-b border-[#f3f4f6] px-4"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <Activity className="size-5 flex-[0_0_auto] text-[#0e9c8f]" />
        <span className="flex-1 truncate text-[17px] font-bold">Terremoto</span>
        <Button
          variant="ghost"
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border-0 bg-[#f1f4f2] text-[#416166] hover:bg-[#e7ebe9] hover:text-[#416166]"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X className="size-[18px]" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[18px] pt-[14px] pb-[calc(12px+env(safe-area-inset-bottom))]">
        <QuakeSheet data={data} main={main} />
      </div>
    </div>
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
  // Todos los sismos del período, en orden cronológico (primero → último).
  // ponytail: filtra desde medianoche UTC del día del sismo principal
  const cutoff = main ? Math.floor(main.time / 86400000) * 86400000 : 0
  const all = [...data.quakes].filter((q) => q.time >= cutoff).sort((a, b) => a.time - b.time)
  // Sismos fuertes (M≥6): si hay 2+, fue un evento múltiple (doblete).
  const strong = all.filter((q) => q.mag >= 6)
  const fc = data.forecast
  const pct = (label: string) =>
    Math.round((fc?.windows.find((w) => w.label === label)?.m5 ?? 0) * 100)

  return (
    <>

      {data.quakes.length === 0 ? (
        <p className="py-[18px] text-center text-[14px] text-[#737f82]">
          Sin sismos registrados en este período.
        </p>
      ) : (
        <div className="mx-[-18px] min-h-0 flex-1 overflow-y-auto px-[18px]">
          {/* Boletín: magnitud como cifra protagonista */}
          {main && (
            <div className="mb-[4px] border-b border-[#ededeb] px-[2px] pt-[4px] pb-[18px]">
              <div className="flex items-start gap-[18px]">
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
                  <span className="block text-[13.5px] leading-[1.55] text-[#416166]">
                    {esPlace(main.place) || 'Venezuela'}
                    <br />
                    {fmtDateTime(main.time)} · {Math.round(main.depth)} km de
                    profundidad
                  </span>
                  <a
                    className="mt-[9px] inline-flex items-center gap-[4px] text-[13px] font-bold text-[#0e9c8f] no-underline"
                    href={main.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fuente: USGS · ver más <ExternalLink className="h-[13px] w-[13px]" />
                  </a>
                </div>
              </div>
              {/* Doblete: explica que fueron 2+ sismos fuertes y el intervalo */}
              {strong.length >= 2 && (
                <p className="mt-[14px] text-[13px] leading-[1.55] text-[#416166]">
                  {strong.length === 2 ? (
                    <>
                      Fueron{' '}
                      <b className="font-semibold text-[#173a40]">
                        dos sismos fuertes
                      </b>
                      , M{strong[0].mag.toFixed(1)} y M{strong[1].mag.toFixed(1)},
                      con {fmtGap(strong[1].time - strong[0].time)} de diferencia.
                    </>
                  ) : (
                    <>
                      Secuencia de{' '}
                      <b className="font-semibold text-[#173a40]">
                        {strong.length} sismos fuertes
                      </b>{' '}
                      en {fmtGap(strong[strong.length - 1].time - strong[0].time)}.
                    </>
                  )}
                </p>
              )}
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

          {all.length > 0 && (
            <section className="mt-[4px]">
              <div className="mt-[20px] mb-[8px] flex items-baseline gap-[8px]">
                <h3 className="text-[16px] font-bold text-[#173a40]">
                  Sismos registrados
                </h3>
                <span className="rounded-full bg-[#0e9c8f]/10 px-[9px] py-[2px] text-[13px] font-bold text-[#0e9c8f]">
                  {all.length}
                </span>
              </div>
              {all.map((q) => (
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
                      {fmtDateTime(q.time)} · {Math.round(q.depth)} km prof.
                    </span>
                  </span>
                  <ExternalLink className="h-[14px] w-[14px] flex-[0_0_auto] text-[#b3bcbe]" />
                </a>
              ))}
            </section>
          )}

          <Sources
            refs={buildSources(main)}
            note="Sismos registrados por la red sísmica de USGS. La zona afectada es el ShakeMap oficial; el pronóstico de réplicas es probabilístico."
          />
        </div>
      )}
    </>
  )
}
