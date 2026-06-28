// Países con centros de acopio. La fuente guarda el país como NOMBRE (español); lo
// necesitamos para (a) la bandera del combobox y (b) casar con el país del visitante,
// que CF-IPCountry entrega como ISO-3166 alpha-2. Solo mapeamos los países que
// realmente aparecen en la data (+ un par de alias de tildes). País desconocido →
// sin ISO → bandera 🌎 (igual se agrupa por su nombre).
const NAME_TO_ISO: Record<string, string> = {
  Venezuela: 'VE',
  'Estados Unidos': 'US',
  España: 'ES',
  Colombia: 'CO',
  México: 'MX',
  Mexico: 'MX',
  Panamá: 'PA',
  Panama: 'PA',
  Brasil: 'BR',
  Argentina: 'AR',
  Chile: 'CL',
  Ecuador: 'EC',
  'Puerto Rico': 'PR',
  'República Dominicana': 'DO',
  Canadá: 'CA',
  Canada: 'CA',
  Guatemala: 'GT',
  Italia: 'IT',
  Perú: 'PE',
  Peru: 'PE',
}

export function isoForCountry(name?: string | null): string | null {
  return name ? (NAME_TO_ISO[name.trim()] ?? null) : null
}

// ISO alpha-2 → emoji bandera (regional indicators). 'ES' → 🇪🇸.
function isoToFlag(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

export function countryFlag(name?: string | null): string {
  const iso = isoForCountry(name)
  return iso ? isoToFlag(iso) : '🌎'
}
