// Normalización del buzón de sugerencias. Pura (sin D1) para testearla sola,
// igual que reports.ts vs reports.functions.ts.
export const SUGGESTION_MAX = 2000
export const CONTACT_MAX = 200

// Recorta espacios, limita largo y colapsa contacto vacío a null.
export function cleanSuggestion(text: unknown, contact?: unknown) {
  const t = String(text ?? '')
    .trim()
    .slice(0, SUGGESTION_MAX)
  const c = String(contact ?? '')
    .trim()
    .slice(0, CONTACT_MAX)
  return { text: t, contact: c || null }
}
