import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Clapperboard, Tv, Music, SearchX, LibraryBig } from 'lucide-react'
import { Badge, Chip, EmptyState, Poster, Reveal, ToggleGroup } from '../components/ui'
import { hashSeed } from '../lib/format'
import './inventory.css'

/* ---------- constants ---------- */

type MediaFilter = 'movie' | 'tv' | 'music'
type FormatFilter = 'disc' | 'dvd' | 'blu-ray' | 'digital'
type SortKey = 'title' | 'copies' | 'type'

const MEDIA_OPTS: { value: MediaFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'movie', label: 'Movies', icon: <Clapperboard size={13} /> },
  { value: 'tv', label: 'TV', icon: <Tv size={13} /> },
  { value: 'music', label: 'Music', icon: <Music size={13} /> },
]

const FORMAT_OPTS: { value: FormatFilter; label: string }[] = [
  { value: 'disc', label: 'Disc (discgear)' },
  { value: 'dvd', label: 'DVD' },
  { value: 'blu-ray', label: 'Blu-ray' },
  { value: 'digital', label: 'Digital' },
]

const STORAGE_LABELS: Record<string, string> = {
  discgear: 'Discgear Case',
  binder: 'Binder',
  drawer: 'Drawer',
  digital: 'Digital Library',
}

const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: 'title', label: 'A–Z' },
  { value: 'copies', label: 'Most Copies' },
  { value: 'type', label: 'By Type' },
]

const MOTIFS = ['ring', 'arch', 'horizon', 'emblem', 'mono'] as const

/** Deterministic poster art inputs from a title id (mirrors mock.ts approach) */
function artFor(id: string): { hue: number; motif: (typeof MOTIFS)[number] } {
  const h = hashSeed(id)
  return {
    hue: Math.floor(h * 320),
    motif: MOTIFS[Math.floor(h * 97) % MOTIFS.length],
  }
}

/* ---------- helpers ---------- */

function titleMatches(t: InventoryTitle, q: string): boolean {
  if (!q) return true
  const hay = `${t.display_title} ${t.franchise ?? ''}`.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(term => hay.includes(term))
}

function copyLine(t: InventoryTitle): string {
  const parts: string[] = []
  if (t.containers.length) parts.push(t.containers.join(' + '))
  else if (t.storage_types.length)
    parts.push(t.storage_types.map(s => STORAGE_LABELS[s] ?? s).join(' + '))
  if (t.copy_count > 1) parts.push(`${t.copy_count} copies`)
  else if (t.copies[0]?.disc_count) parts.push(`${t.copies[0].disc_count} disc${t.copies[0].disc_count > 1 ? 's' : ''}`)
  return parts.join(' · ') || 'Owned'
}

function badgeFor(t: InventoryTitle): { label: string; tone: 'gold' | 'teal' | 'ember' | 'lilac' | 'neutral' } | null {
  if (t.match_status === 'review') return { label: 'Needs Review', tone: 'ember' }
  if (t.match_status === 'uncertain') return { label: 'Uncertain Match', tone: 'lilac' }
  if (t.copy_count > 1) return { label: `×${t.copy_count}`, tone: 'neutral' }
  return null
}

/* ---------- screen ---------- */

/**
 * Extracted from the inline copies-item type so the explicit
 * `disc_count: number | null` beats the catch-all index signature
 * (TS2365: Operator '>' cannot be applied to '{}' and 'number').
 */
interface InventoryCopy {
  entry_id: string | null
  format: string | null
  storage_type: string
  container_name: string | null
  slot_start: number | null
  slot_end: number | null
  location_detail: string | null
  notes: string | null
  disc_count: number | null
  [key: string]: unknown
}

interface InventoryTitle {
  id: string
  display_title: string
  media_type: 'movie' | 'tv' | 'music'
  franchise: string | null
  release_year: number | null
  match_status: string
  match_confidence: string | null
  copy_count: number
  formats: string[]
  storage_types: string[]
  season_sets: string[]
  containers: string[]
  copies: InventoryCopy[]
}

export function Inventory() {
  const [inventoryTitles, setInventoryTitles] = useState<InventoryTitle[]>([])
  const [bundleGeneratedAt, setBundleGeneratedAt] = useState<string>('')
  const [bundleSchema, setBundleSchema] = useState<string>('1')

  useEffect(() => {
    fetch('/titles.json')
      .then(r => r.json())
      .then(d => {
        setInventoryTitles(d.titles ?? [])
        setBundleGeneratedAt(d.generated_at ?? '')
        setBundleSchema(String(d.schema ?? '1'))
      })
      .catch(console.error)
  }, [])
  const [params, setParams] = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)

  const query = params.get('q') ?? ''
  const types = params.getAll('type') as MediaFilter[]
  const formats = params.getAll('format') as FormatFilter[]
  const sort = (params.get('sort') as SortKey) || 'title'

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    mutate(next)
    setParams(next, { replace: true })
  }

  const toggleType = (v: MediaFilter) =>
    update(next => {
      const cur = next.getAll('type')
      next.delete('type')
      const list = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]
      list.forEach(x => next.append('type', x))
    })

  const toggleFormat = (v: FormatFilter) =>
    update(next => {
      const cur = next.getAll('format')
      next.delete('format')
      const list = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]
      list.forEach(x => next.append('format', x))
    })

  const setSort = (v: SortKey) =>
    update(next => {
      if (v === 'title') next.delete('sort')
      else next.set('sort', v)
    })

  const setQuery = (q: string) =>
    update(next => {
      if (q) next.set('q', q)
      else next.delete('q')
    })

  // headline stats
  const stats = useMemo(() => {
    const copies = inventoryTitles.reduce((n, t) => n + t.copy_count, 0)
    const movies = inventoryTitles.filter(t => t.media_type === 'movie').length
    const tv = inventoryTitles.filter(t => t.media_type === 'tv').length
    const music = inventoryTitles.filter(t => t.media_type === 'music').length
    return { titles: inventoryTitles.length, copies, movies, tv, music }
  }, [inventoryTitles])

  // filtering
  const results = useMemo(() => {
    let out = inventoryTitles.filter(
      t =>
        titleMatches(t, query) &&
        (types.length === 0 || types.includes(t.media_type)) &&
        (formats.length === 0 || t.formats.some(f => formats.includes(f as FormatFilter))),
    )
    switch (sort) {
      case 'copies':
        out = [...out].sort((a, b) => b.copy_count - a.copy_count || a.display_title.localeCompare(b.display_title))
        break
      case 'type':
        out = [...out].sort(
          (a, b) =>
            a.media_type.localeCompare(b.media_type) || a.display_title.localeCompare(b.display_title),
        )
        break
      default:
        out = [...out].sort((a, b) => a.display_title.localeCompare(b.display_title))
    }
    return out
  }, [inventoryTitles, query, types, formats, sort])

  // "/" focuses search, matching the header behavior
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeFilters =
    types.length + formats.length + (query ? 1 : 0)

  return (
    <div className="inventory page">
      <header className="inventory__head">
        <div className="inventory__heading">
          <p className="inventory__eyebrow mono">
            <LibraryBig size={12} aria-hidden="true" /> BATCH 1 · REAL INVENTORY
          </p>
          <h1 className="inventory__title">The Collection</h1>
          <p className="inventory__sub">
            {stats.titles} titles · {stats.copies} copies — {stats.movies} films, {stats.tv} series,
            {stats.music} music.
          </p>
        </div>
        <div className="inventory__search">
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search titles…  ( / )"
            aria-label="Search inventory"
          />
        </div>
      </header>

      <div className="inventory__toolbar">
        <div className="inventory__types">
          {MEDIA_OPTS.map(m => (
            <Chip
              key={m.value}
              variant={types.includes(m.value) ? 'active' : 'passive'}
              onClick={() => toggleType(m.value)}
            >
              {m.icon}
              {m.label}
            </Chip>
          ))}
        </div>
        <div className="inventory__formats">
          {FORMAT_OPTS.map(f => (
            <Chip
              key={f.value}
              variant={formats.includes(f.value) ? 'active' : 'passive'}
              onClick={() => toggleFormat(f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
        <div className="inventory__sort">
          <ToggleGroup
            options={SORT_OPTS}
            value={sort}
            onChange={setSort}
            ariaLabel="Sort order"
          />
        </div>
      </div>

      {activeFilters > 0 && (
        <div className="inventory__active">
          {query && <Chip variant="active" onRemove={() => setQuery('')}>“{query}”</Chip>}
          {types.map(t => (
            <Chip key={t} variant="active" onRemove={() => toggleType(t)}>
              {MEDIA_OPTS.find(o => o.value === t)?.label ?? t}
            </Chip>
          ))}
          {formats.map(f => (
            <Chip key={f} variant="active" onRemove={() => toggleFormat(f)}>
              {FORMAT_OPTS.find(o => o.value === f)?.label ?? f}
            </Chip>
          ))}
          <button className="inventory__clear" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear all
          </button>
        </div>
      )}

      <p className="inventory__count mono" aria-live="polite">
        SHOWING {results.length} / {stats.titles} TITLES
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon={<SearchX size={28} />}
          title="Nothing on this shelf"
          body="No titles match the current search and filters. Try clearing a filter or two."
          action={
            <button className="inventory__clear" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Clear all filters
            </button>
          }
        />
      ) : (
        <div className="inventory__grid">
          {results.map((t, i) => {
            const art = artFor(t.id)
            const badge = badgeFor(t)
            return (
              <Reveal key={t.id} delay={Math.min(i % 8, 5) * 45} y={16}>
                <div className="inv-card" title={t.display_title}>
                  <div className="inv-card__frame">
                    <Poster
                      seed={t.id}
                      hue={art.hue}
                      motif={art.motif}
                      title={t.display_title}
                      width={260}
                      height={390}
                    />
                    {badge && <div className="inv-card__badge"><Badge tone={badge.tone}>{badge.label}</Badge></div>}
                  </div>
                  <div className="inv-card__meta">
                    <span className="inv-card__title">{t.display_title}</span>
                    <span className="inv-card__sub mono">{copyLine(t)}</span>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      )}

      <footer className="inventory__foot mono">
        bundle generated {bundleGeneratedAt.replace('T', ' ').slice(0, 16)} UTC · schema {bundleSchema}
      </footer>
    </div>
  )
}
