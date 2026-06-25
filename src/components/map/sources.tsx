import { ChevronRight, ExternalLink, Info } from 'lucide-react'
import type { SourceRef } from '../../quakes/quakes'

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// Procedencia visible: todo dato publicado es público y comprobable. Referencias
// en formato APA, cada una con su link. Disclosure nativo (sin JS). [[no-misinformation]]
export function Sources({ refs, note }: { refs: SourceRef[]; note: string }) {
  return (
    <details className="group mt-[16px] mb-[4px] border-t border-t-[#ededeb] pt-[8px]">
      <summary className="flex cursor-pointer list-none items-center gap-[8px] py-[6px] text-[13px] font-semibold text-[#416166] [&::-webkit-details-marker]:hidden">
        <Info className="h-[15px] w-[15px]" /> Fuentes y verificación
        <ChevronRight className="ml-auto h-[15px] w-[15px] transition-transform duration-150 group-open:rotate-90" />
      </summary>
      <p className="mt-[2px] mb-[10px] text-[12px] leading-[1.45] text-[#737f82]">{note}</p>
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
    </details>
  )
}
