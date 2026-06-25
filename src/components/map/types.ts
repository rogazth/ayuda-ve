export type Pin = {
  id: string
  type: string
  title: string
  lat: number
  lng: number
  confirms: number
  createdAt: number
}
// Sin modos: el mapa muestra siempre epicentro + pines. El heatmap (intensidad)
// y el boletín del terremoto son capas/paneles que se prenden por separado.
// announce: true solo en refrescos del poll (viewport quieto). En pan/zoom va
// false: traer un reporte reciente al viewport al mover no es "nuevo".
export type Data = {
  pins: Pin[]
  center: [number, number]
  tooFar: boolean
  announce: boolean
}
