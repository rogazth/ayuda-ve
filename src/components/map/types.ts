export type Pin = {
  id: string
  type: string
  title: string
  lat: number
  lng: number
  confirms: number
  createdAt: number
}
// Reportes = capa por defecto del mapa. Sismos = capa que se enciende con el
// banner. Ayuda ya no es una "vista": es un dialog aparte (helpOpen).
export type View = 'reportes' | 'sismos'
export type Data = { pins: Pin[]; center: [number, number]; tooFar: boolean }
