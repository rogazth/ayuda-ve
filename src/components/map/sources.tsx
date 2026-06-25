import { ExternalLink, Info } from 'lucide-react'
import type { SourceRef } from '../../quakes/quakes'

export function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// Procedencia visible: todo dato publicado es público y comprobable. Referencias
// en formato APA, cada una con su link. Siempre visibles — el usuario no debería
// tener que abrir un acordeón para verificar de dónde viene un dato. [[no-misinformation]]
export function Sources({ refs, note }: { refs: SourceRef[]; note: string }) {
  return (
    <section className="mt-[16px] mb-[4px] border-t border-t-[#ededeb] pt-[12px]">
      <p className="flex items-center gap-[8px] text-[13px] font-semibold text-[#416166]">
        <Info className="h-[15px] w-[15px]" /> Fuentes y verificación
      </p>
      <p className="mt-[6px] mb-[10px] text-[12px] leading-[1.45] text-[#737f82]">{note}</p>
      <ol className="mb-[4px] flex list-none flex-col gap-[10px] p-0">
        {refs.map((r) => (
          <li key={r.key} className="pl-[16px] indent-[-16px] text-[11.5px] leading-[1.45] text-[#737f82]">
            {r.cite}
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-[4px] inline-flex items-center gap-[3px] indent-0 font-semibold whitespace-nowrap text-[#0e9c8f] no-underline"
              >
                {hostOf(r.url)}
                <ExternalLink className="h-[12px] w-[12px]" />
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
