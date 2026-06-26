import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, X, MapPin, Search } from 'lucide-react'
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/button'
import { createReport } from '../../reports/reports.functions'
import { geoSuggest, geoRetrieve, type Suggestion } from '../../geo/geo.functions'
import { formatVePhone, isValidVePhone, veDigits } from '../../reports/reports'

type ReportType =
  | 'trapped'
  | 'missing'
  | 'danger'
  | 'need'
  | 'offer'
  | 'support'
  | 'lostpet'
  | 'wifi'
  | 'road'
  | 'security'
  | 'flood'
type Step = 'type' | 'location' | 'details' | 'contact'

type PhotoDraft = { preview: string; blob: Blob; width: number; height: number }

type Draft = {
  type: ReportType | null
  location: [number, number] | null
  count?: string
  state?: string
  accessible?: string
  missingName?: string
  age?: string
  lastSeen?: string
  dangerType?: string
  peopleAtRisk?: string
  items?: string[]
  capacity?: string
  available?: string[]
  schedule?: string
  petName?: string
  species?: string
  wifiPassword?: string
  roadCause?: string
  passable?: string
  securityType?: string[]
  stillActive?: string
  floodLevel?: string
  contact?: string
  description?: string
  photos?: PhotoDraft[]
}

const VE_QUAKE: [number, number] = [10.4, -68.5]

const TYPE_CARDS: { key: ReportType; emoji: string; label: string }[] = [
  { key: 'trapped', emoji: '🆘', label: 'Persona atrapada' },
  { key: 'missing', emoji: '👤', label: 'Persona desaparecida' },
  { key: 'danger', emoji: '🏚️', label: 'Estructura dañada' },
  { key: 'need', emoji: '🙏', label: 'Necesito ayuda' },
  { key: 'offer', emoji: '❤️', label: 'Ofrezco ayuda' },
  { key: 'support', emoji: '🏠', label: 'Punto de apoyo' },
  { key: 'lostpet', emoji: '🐾', label: 'Mascota desaparecida' },
  { key: 'wifi', emoji: '📶', label: 'Señal / Internet' },
  { key: 'road', emoji: '🚧', label: 'Vía bloqueada' },
  { key: 'security', emoji: '🚨', label: 'Alerta de seguridad' },
  { key: 'flood', emoji: '🌊', label: 'Zona inundada' },
]

const HELP_ITEMS = ['Agua', 'Comida', 'Medicamentos', 'Refugio', 'Transporte']
const SUPPORT_ITEMS = [
  'Agua potable',
  'Comida',
  'Ropa',
  'Medicamentos',
  'Atención médica',
  'Zona para dormir',
  'Carga eléctrica',
  'Señal / internet',
  'Voluntarios',
]
const DANGER_TYPES = [
  'Derrumbe',
  'Incendio',
  'Fuga de gas',
  'Estructura inestable',
]
const SPECIES = ['Perro', 'Gato', 'Otro']
const ROAD_CAUSES = ['Derrumbe', 'Inundación', 'Árbol caído', 'Accidente', 'Otro']
const SECURITY_TYPES = ['Saqueo', 'Vandalismo', 'Zona de riesgo']
const FLOOD_LEVELS = ['Baja', 'Media', 'Alta']

// --- small reusable pieces ---

// Uber-style: the map center IS the location. Reports center coords on every move.
function CenterTracker({
  onChange,
}: {
  onChange: (p: [number, number]) => void
}) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter()
      onChange([c.lat, c.lng])
    },
  })
  return null
}

// Autocomplete via Mapbox Search Box API (geoSuggest/geoRetrieve, server-side).
// suggest+retrieve share a session_token so Mapbox bills them as one session;
// it rotates after each pick. flyTo fires moveend → CenterTracker updates the pin.
function LocationSearch({
  mapRef,
  onSelect,
}: {
  mapRef: React.RefObject<LeafletMap | null>
  onSelect: (p: [number, number]) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const skip = useRef(false)
  const session = useRef(crypto.randomUUID())

  useEffect(() => {
    // Skip the re-search caused by pick() writing the chosen label into q.
    if (skip.current) {
      skip.current = false
      return
    }
    const query = q.trim()
    if (query.length < 3) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const c = mapRef.current?.getCenter()
        const res = await geoSuggest({
          data: {
            q: query,
            session: session.current,
            proximity: c ? `${c.lng},${c.lat}` : undefined,
          },
        })
        if (cancelled) return
        setResults(res)
        setOpen(true)
      } catch {
        /* offline — leave previous results */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, mapRef])

  const pick = async (r: Suggestion) => {
    skip.current = true
    setQ(r.name)
    setResults([])
    setOpen(false)
    const p = await geoRetrieve({ data: { id: r.id, session: session.current } })
    session.current = crypto.randomUUID() // retrieve cierra la sesión: rota el token
    if (!p) return
    onSelect(p)
    mapRef.current?.flyTo(p, 16, { duration: 0.6 })
  }

  return (
    <div className="absolute top-3 inset-x-3 z-[1000]">
      <div className="flex items-center gap-2 bg-white rounded-xl shadow-lg px-3 py-2.5">
        <Search className="size-4 text-[#6b7280] flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar dirección, urbanización o estado…"
          className="flex-1 text-sm text-[#1a1c1e] bg-transparent outline-none"
        />
        {loading && <span className="text-xs text-[#9ca3af]">…</span>}
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('')
              setResults([])
              setOpen(false)
            }}
          >
            <X className="size-4 text-[#9ca3af]" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="mt-1.5 bg-white rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => pick(r)}
              className="flex items-start gap-2 w-full text-left px-3 py-2.5 hover:bg-[#f3f4f6] border-b border-[#f3f4f6] last:border-0"
            >
              <MapPin className="size-4 text-[#0e9c8f] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-[#1a1c1e] leading-snug">
                <span className="font-medium">{r.name}</span>
                {r.place && <span className="text-[#6b7280]">, {r.place}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
        selected ? 'bg-[#0e9c8f] text-white' : 'bg-[#f3f4f6] text-[#1a1c1e]'
      }`}
    >
      {label}
    </button>
  )
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string | undefined
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`flex-1 min-w-[60px] py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            value === o
              ? 'bg-[#0e9c8f] text-white border-[#0e9c8f]'
              : 'bg-white text-[#1a1c1e] border-[#e5e7eb]'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <p className="text-[#374151] font-semibold mb-3">{label}</p>
      {children}
    </div>
  )
}

function TextInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      className="w-full border border-[#e5e7eb] rounded-xl px-4 py-3 text-[#1a1c1e] text-sm outline-none focus:border-[#0e9c8f]"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// Downscale to <=800px JPEG blob; null on non-image/decode error.
const fileToPhoto = (file: File) =>
  new Promise<PhotoDraft | null>((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(null)
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 800
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width)
          width = MAX
        } else {
          width = Math.round((width * MAX) / height)
          height = MAX
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      const preview = canvas.toDataURL('image/jpeg', 0.75)
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null)
          resolve({ preview, blob, width, height })
        },
        'image/jpeg',
        0.75,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })

function PhotosInput({
  value,
  onChange,
}: {
  value: PhotoDraft[]
  onChange: (v: PhotoDraft[]) => void
}) {
  const [fileDrop, setFileDrop] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const [dragX, setDragX] = useState(0)
  const startX = useRef(0)
  const stripRef = useRef<HTMLDivElement>(null)

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    const photos = (
      await Promise.all(Array.from(files).map(fileToPhoto))
    ).filter((p): p is PhotoDraft => !!p)
    if (photos.length) onChange([...value, ...photos].slice(0, 4))
  }

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  const reorder = (from: number, to: number) => {
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const startDrag = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startX.current = e.clientX
    setDragX(0)
    setDragIdx(i)
    setDropIdx(i)
  }

  const moveDrag = (e: React.PointerEvent) => {
    if (dragIdx === null || !stripRef.current) return
    setDragX(e.clientX - startX.current)
    const children = Array.from(stripRef.current.children) as HTMLElement[]
    const x = e.clientX
    for (let j = 0; j < children.length; j++) {
      const { left, width } = children[j].getBoundingClientRect()
      if (x < left + width / 2) {
        if (dropIdx !== j) setDropIdx(j)
        return
      }
    }
    const last = children.length - 1
    if (dropIdx !== last) setDropIdx(last)
  }

  const endDrag = () => {
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx)
      reorder(dragIdx, dropIdx)
    setDragIdx(null)
    setDropIdx(null)
    setDragX(0)
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto pb-0.5 select-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {value.map((photo, i) => (
            <div
              key={photo.preview}
              className={`relative flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden touch-none ${
                i === dragIdx
                  ? 'z-10 shadow-xl cursor-grabbing'
                  : 'cursor-grab transition-all duration-150'
              } ${
                i === dropIdx && dropIdx !== dragIdx
                  ? 'ring-2 ring-[#0e9c8f] ring-offset-1'
                  : ''
              }`}
              style={
                i === dragIdx
                  ? {
                      transform: `translateX(${dragX}px) scale(1.05)`,
                      transition: 'none',
                    }
                  : undefined
              }
              onPointerDown={(e) => startDrag(e, i)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <img
                src={photo.preview}
                className="w-full h-full object-cover"
                alt={`Foto ${i + 1}`}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent" />
              {i === 0 && (
                <span className="absolute top-1 left-1.5 text-[9px] font-bold text-white/90 leading-none tracking-wide uppercase">
                  portada
                </span>
              )}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => remove(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/65 text-white flex items-center justify-center"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl border-2 border-dashed cursor-pointer select-none transition-all ${
          fileDrop
            ? 'border-[#0e9c8f] bg-[#f0fdf9] scale-[1.01]'
            : 'border-[#e2e5e9] bg-[#f8f9fa] active:scale-[0.99]'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setFileDrop(true)
        }}
        onDragLeave={() => setFileDrop(false)}
        onDrop={(e) => {
          e.preventDefault()
          setFileDrop(false)
          void add(e.dataTransfer.files)
        }}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => void add(e.target.files)}
        />
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            fileDrop ? 'bg-[#0e9c8f]' : 'bg-[#e9ecef]'
          }`}
        >
          <span className="text-lg leading-none">{fileDrop ? '⬇️' : '📷'}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1a1c1e]">
            {value.length
              ? `${value.length} foto${value.length > 1 ? 's' : ''} · Agregar más`
              : 'Agregar fotos'}
          </p>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            Arrastra para reordenar · toca para subir
          </p>
        </div>
      </label>
    </div>
  )
}

// --- main wizard ---

type Props = {
  open: boolean
  onClose: () => void
  userLocation: [number, number] | null
  onSubmitDone: (id: string) => void
}

export function ReportWizard({
  open,
  onClose,
  userLocation,
  onSubmitDone,
}: Props) {
  const [step, setStep] = useState<Step>('type')
  const [draft, setDraft] = useState<Draft>({ type: null, location: null })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    if (open) {
      setStep('type')
      setDraft({ type: null, location: null })
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  // Seed location to the map center so the pin counts as a choice without panning.
  useEffect(() => {
    if (step === 'location' && !draft.location)
      set('location', draft.location ?? userLocation ?? VE_QUAKE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  if (!open) return null

  const effectiveLoc = draft.location ?? userLocation
  // Teléfono opcional, pero si lo escriben debe ser un número venezolano válido.
  const contactInvalid = !!draft.contact && !isValidVePhone(draft.contact)
  const stepNum =
    step === 'location'
      ? 1
      : step === 'details'
        ? 2
        : step === 'contact'
          ? 3
          : 0
  const typeLabel = TYPE_CARDS.find((c) => c.key === draft.type)?.label ?? ''

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))
  const toggleItem = (list: 'items' | 'available' | 'securityType', item: string) =>
    setDraft((d) => {
      const cur = d[list] ?? []
      return {
        ...d,
        [list]: cur.includes(item)
          ? cur.filter((i) => i !== item)
          : [...cur, item],
      }
    })

  const back = () => {
    if (step === 'type') onClose()
    else if (step === 'location') setStep('type')
    else if (step === 'details') setStep('location')
    else setStep('details')
  }

  const submit = async () => {
    if (!effectiveLoc || !draft.type) return
    if (contactInvalid) {
      setError('Número de teléfono inválido')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const meta: Record<string, unknown> = {}
      if (draft.count) meta.count = draft.count
      if (draft.state) meta.state = draft.state
      if (draft.accessible) meta.accessible = draft.accessible
      if (draft.missingName) meta.missingName = draft.missingName
      if (draft.age) meta.age = draft.age
      if (draft.lastSeen) meta.lastSeen = draft.lastSeen
      if (draft.dangerType) meta.dangerType = draft.dangerType
      if (draft.peopleAtRisk) meta.peopleAtRisk = draft.peopleAtRisk
      if (draft.items?.length) meta.items = draft.items
      if (draft.capacity) meta.capacity = draft.capacity
      if (draft.available?.length) meta.available = draft.available
      if (draft.schedule) meta.schedule = draft.schedule
      if (draft.petName) meta.petName = draft.petName
      if (draft.species) meta.species = draft.species
      if (draft.wifiPassword) meta.wifiPassword = draft.wifiPassword
      if (draft.roadCause) meta.roadCause = draft.roadCause
      if (draft.passable) meta.passable = draft.passable
      if (draft.securityType?.length) meta.securityType = draft.securityType
      if (draft.stillActive) meta.stillActive = draft.stillActive
      if (draft.floodLevel) meta.floodLevel = draft.floodLevel

      const row = await createReport({
        data: {
          type: draft.type,
          lat: effectiveLoc[0],
          lng: effectiveLoc[1],
          description: draft.description ?? '',
          contact: draft.contact,
          meta: JSON.stringify(meta),
        },
      })

      const newId = row?.id
      if (draft.photos?.length && newId) {
        const form = new FormData()
        for (let i = 0; i < draft.photos.length; i++) {
          const p = draft.photos[i]
          form.append('photo', p.blob, `photo_${i}.jpg`)
          form.append(`width_${i}`, String(p.width))
          form.append(`height_${i}`, String(p.height))
        }
        await fetch(`/api/reports/${newId}/photos`, {
          method: 'POST',
          body: form,
        })
      }

      onClose()
      if (newId) onSubmitDone(newId)
    } catch (e) {
      console.error('Error al enviar reporte:', e)
      setError('Error al enviar. Intenta de nuevo.')
      setSubmitting(false)
    }
  }

  // --- step content ---

  const typeStep = (
    <div className="px-5 pt-2 pb-6">
      <p className="text-[22px] font-bold text-[#1a1c1e] mb-6">
        ¿Qué quieres reportar?
      </p>
      <div className="grid grid-cols-2 gap-3">
        {TYPE_CARDS.map(({ key, emoji, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setDraft((d) => ({ ...d, type: key }))
              setStep('location')
            }}
            className="flex flex-col items-center gap-2.5 rounded-2xl bg-[#f8f9fa] hover:bg-[#e9ecef] p-5 text-center transition-colors cursor-pointer"
          >
            <span className="text-3xl leading-none">{emoji}</span>
            <span className="text-sm font-semibold text-[#1a1c1e] leading-tight">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )

  const mapCenter = effectiveLoc ?? VE_QUAKE
  const locationStep = (
    <div className="relative h-full">
      <MapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={13}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <CenterTracker onChange={(p) => set('location', p)} />
      </MapContainer>

      {/* search box — above leaflet panes (z 200–700) */}
      <LocationSearch mapRef={mapRef} onSelect={(p) => set('location', p)} />

      {/* hint pill */}
      <div className="pointer-events-none absolute bottom-3 inset-x-4 z-[1000] flex justify-center">
        <span className="px-3.5 py-2 rounded-full bg-black/75 text-white text-xs font-medium shadow-lg">
          📍 Mueve el mapa para centrar el punto en la ubicación exacta
        </span>
      </div>

      {/* fixed center pin — tip points at map center */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-full">
        <MapPin
          className="size-10 text-[#0e9c8f] drop-shadow-lg"
          fill="#0e9c8f"
          stroke="#fff"
          strokeWidth={1.5}
        />
      </div>
    </div>
  )

  const detailsStep = (() => {
    if (!draft.type) return null
    switch (draft.type) {
      case 'trapped':
        return (
          <div className="px-5 pb-4">
            <Field label="¿Cuántas personas?">
              <ToggleGroup
                options={['1', '2', '3', '3+']}
                value={draft.count}
                onChange={(v) => set('count', v)}
              />
            </Field>
            <Field label="¿Cómo están?">
              <ToggleGroup
                options={['Consciente(s)', 'Sin información']}
                value={draft.state}
                onChange={(v) => set('state', v)}
              />
            </Field>
            <Field label="¿Se puede acceder?">
              <ToggleGroup
                options={['Sí', 'No', 'Parcial']}
                value={draft.accessible}
                onChange={(v) => set('accessible', v)}
              />
            </Field>
          </div>
        )
      case 'missing':
        return (
          <div className="px-5 pb-4">
            <Field label="Nombre completo">
              <TextInput
                placeholder="Nombre de la persona"
                value={draft.missingName ?? ''}
                onChange={(v) => set('missingName', v)}
              />
            </Field>
            <Field label="Edad aproximada (opcional)">
              <TextInput
                placeholder="Ej: 35 años"
                value={draft.age ?? ''}
                onChange={(v) => set('age', v)}
              />
            </Field>
            <Field label="Última ubicación conocida (opcional)">
              <TextInput
                placeholder="Ej: Calle principal, barrio X"
                value={draft.lastSeen ?? ''}
                onChange={(v) => set('lastSeen', v)}
              />
            </Field>
          </div>
        )
      case 'danger':
        return (
          <div className="px-5 pb-4">
            <Field label="Tipo de peligro">
              <div className="flex flex-wrap gap-2">
                {DANGER_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={draft.dangerType === t}
                    onToggle={() => set('dangerType', t)}
                  />
                ))}
              </div>
            </Field>
            <Field label="¿Hay personas en riesgo?">
              <ToggleGroup
                options={['Sí', 'No']}
                value={draft.peopleAtRisk}
                onChange={(v) => set('peopleAtRisk', v)}
              />
            </Field>
          </div>
        )
      case 'need':
        return (
          <div className="px-5 pb-4">
            <Field label="¿Qué necesitas?">
              <div className="flex flex-wrap gap-2">
                {HELP_ITEMS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={(draft.items ?? []).includes(item)}
                    onToggle={() => toggleItem('items', item)}
                  />
                ))}
              </div>
            </Field>
            <Field label="¿Cuántas personas?">
              <ToggleGroup
                options={['1', '2–5', '5–10', '10+']}
                value={draft.count}
                onChange={(v) => set('count', v)}
              />
            </Field>
          </div>
        )
      case 'offer':
        return (
          <div className="px-5 pb-4">
            <Field label="¿Qué ofreces?">
              <div className="flex flex-wrap gap-2">
                {HELP_ITEMS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={(draft.items ?? []).includes(item)}
                    onToggle={() => toggleItem('items', item)}
                  />
                ))}
              </div>
            </Field>
            <Field label="Cantidad / capacidad (opcional)">
              <TextInput
                placeholder="Ej: 50 litros de agua"
                value={draft.capacity ?? ''}
                onChange={(v) => set('capacity', v)}
              />
            </Field>
          </div>
        )
      case 'support':
        return (
          <div className="px-5 pb-4">
            <Field label="¿Qué hay disponible?">
              <div className="flex flex-wrap gap-2">
                {SUPPORT_ITEMS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={(draft.available ?? []).includes(item)}
                    onToggle={() => toggleItem('available', item)}
                  />
                ))}
              </div>
            </Field>
            <Field label="Horario (opcional)">
              <TextInput
                placeholder="Ej: Lunes a viernes 8am–6pm"
                value={draft.schedule ?? ''}
                onChange={(v) => set('schedule', v)}
              />
            </Field>
          </div>
        )
      case 'wifi':
        return (
          <div className="px-5 pb-4">
            <Field label="¿Qué hay disponible?">
              <div className="flex flex-wrap gap-2">
                {['WiFi gratis', 'Señal celular', 'Carga de teléfono'].map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={(draft.available ?? []).includes(item)}
                    onToggle={() => toggleItem('available', item)}
                  />
                ))}
              </div>
            </Field>
            <Field label="Contraseña WiFi (opcional)">
              <TextInput
                placeholder="Dejar vacío si es abierta"
                value={draft.wifiPassword ?? ''}
                onChange={(v) => set('wifiPassword', v)}
              />
            </Field>
            <Field label="Horario (opcional)">
              <TextInput
                placeholder="Ej: 8am–10pm todos los días"
                value={draft.schedule ?? ''}
                onChange={(v) => set('schedule', v)}
              />
            </Field>
          </div>
        )
      case 'road':
        return (
          <div className="px-5 pb-4">
            <Field label="Causa del bloqueo">
              <div className="flex flex-wrap gap-2">
                {ROAD_CAUSES.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={draft.roadCause === c}
                    onToggle={() => set('roadCause', c)}
                  />
                ))}
              </div>
            </Field>
            <Field label="¿Se puede pasar?">
              <ToggleGroup
                options={['Sí', 'No', 'Solo a pie']}
                value={draft.passable}
                onChange={(v) => set('passable', v)}
              />
            </Field>
          </div>
        )
      case 'security':
        return (
          <div className="px-5 pb-4">
            <Field label="Tipo de alerta">
              <div className="flex flex-wrap gap-2">
                {SECURITY_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={(draft.securityType ?? []).includes(t)}
                    onToggle={() => toggleItem('securityType', t)}
                  />
                ))}
              </div>
            </Field>
            <Field label="Situación actual">
              <ToggleGroup
                options={['En curso', 'Terminó', 'Sin información']}
                value={draft.stillActive}
                onChange={(v) => set('stillActive', v)}
              />
            </Field>
          </div>
        )
      case 'flood':
        return (
          <div className="px-5 pb-4">
            <Field label="Nivel de inundación">
              <div className="flex flex-wrap gap-2">
                {FLOOD_LEVELS.map((l) => (
                  <Chip
                    key={l}
                    label={l}
                    selected={draft.floodLevel === l}
                    onToggle={() => set('floodLevel', l)}
                  />
                ))}
              </div>
            </Field>
            <Field label="¿Se puede pasar?">
              <ToggleGroup
                options={['Sí', 'No', 'Solo a pie']}
                value={draft.passable}
                onChange={(v) => set('passable', v)}
              />
            </Field>
          </div>
        )
      case 'lostpet':
        return (
          <div className="px-5 pb-4">
            <Field label="Nombre de la mascota (opcional)">
              <TextInput
                placeholder="Ej: Toby"
                value={draft.petName ?? ''}
                onChange={(v) => set('petName', v)}
              />
            </Field>
            <Field label="Especie">
              <div className="flex flex-wrap gap-2">
                {SPECIES.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    selected={draft.species === s}
                    onToggle={() => set('species', s)}
                  />
                ))}
              </div>
            </Field>
          </div>
        )
    }
  })()

  const contactStep = (
    <div className="px-5 pb-4">
      <Field label="Tu número (recomendado)">
        <div
          className={`flex items-center overflow-hidden rounded-xl border focus-within:border-[#0e9c8f] ${
            contactInvalid ? 'border-[#d7263d]' : 'border-[#e5e7eb]'
          }`}
        >
          <span className="flex items-center gap-1.5 border-r border-[#e5e7eb] bg-[#f8f9fa] px-3 py-3 text-sm font-medium text-[#374151]">
            🇻🇪 +58
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={12}
            className="flex-1 px-3 py-3 text-sm text-[#1a1c1e] outline-none"
            placeholder="412 123 4567"
            value={formatVePhone(draft.contact ?? '')}
            onChange={(e) => set('contact', veDigits(e.target.value))}
          />
        </div>
        {contactInvalid ? (
          <p className="mt-1.5 text-xs text-[#d7263d]">
            Número venezolano: 10 dígitos, ej. 412 123 4567.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-[#6b7280]">
            Para coordinar con equipos de ayuda
          </p>
        )}
      </Field>
      <Field label="Fotos (opcional)">
        <PhotosInput
          value={draft.photos ?? []}
          onChange={(v) => set('photos', v)}
        />
      </Field>
      <Field label="Descripción adicional (opcional)">
        <textarea
          className="w-full border border-[#e5e7eb] rounded-xl px-4 py-3 text-[#1a1c1e] text-sm outline-none focus:border-[#0e9c8f] resize-none"
          rows={3}
          placeholder="Cualquier detalle que ayude…"
          value={draft.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
        />
      </Field>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[900] bg-white flex flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 border-b border-[#f3f4f6]"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={back}
          className="text-[#1a1c1e] p-1 -ml-1"
        >
          <ChevronLeft className="size-6" />
        </button>
        <span className="flex-1 text-[17px] font-bold text-[#1a1c1e] truncate">
          {step === 'type' ? 'Nuevo reporte' : typeLabel}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[#6b7280] p-1 -mr-1"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Progress bar */}
      {step !== 'type' && (
        <div className="flex gap-1.5 px-5 py-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-[3px] flex-1 rounded-full transition-colors ${stepNum >= n ? 'bg-[#0e9c8f]' : 'bg-[#e5e7eb]'}`}
            />
          ))}
        </div>
      )}

      {/* Content — location fills the body; other steps scroll */}
      <div
        className={`flex-1 min-h-0 ${step === 'location' ? '' : 'overflow-y-auto pt-4'}`}
      >
        {step === 'type' && typeStep}
        {step === 'location' && locationStep}
        {step === 'details' && detailsStep}
        {step === 'contact' && contactStep}
      </div>

      {/* Footer */}
      {step !== 'type' && (
        <div
          className="px-5 pt-3 border-t border-[#f3f4f6]"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          {step === 'contact' ? (
            <Button
              onClick={submit}
              disabled={submitting || !effectiveLoc || contactInvalid}
              className="w-full h-[54px] rounded-2xl bg-[#0e9c8f] hover:bg-[#0c8a7e] text-white text-[17px] font-bold border-none"
            >
              {submitting ? 'Enviando…' : 'Enviar reporte'}
            </Button>
          ) : (
            <Button
              onClick={() =>
                setStep(step === 'location' ? 'details' : 'contact')
              }
              disabled={step === 'location' && !effectiveLoc}
              className="w-full h-[54px] rounded-2xl bg-[#0e9c8f] hover:bg-[#0c8a7e] text-white text-[17px] font-bold border-none"
            >
              Siguiente →
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
