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
export type Data = { pins: Pin[]; center: [number, number]; tooFar: boolean }
