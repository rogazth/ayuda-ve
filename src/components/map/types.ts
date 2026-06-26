export type Pin = {
  id: string
  type: string
  title: string
  lat: number
  lng: number
  confirms: number
  createdAt: number
  // nº de reportes apilados en esta coordenada (el bbox agrega por lat,lng). >1 →
  // burbuja de apilado que abre el drawer; ausente/1 → pin normal (id/title reales).
  n?: number
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
