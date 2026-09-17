import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { SlidersHorizontal, SearchX } from 'lucide-react'
import { loadTitles } from '../lib/data-adapter'

import { summarizeAll } from '../lib/summaries'
import {
  emptyFilters,
  matchesFilters,
  sortSummaries,
} from '../lib/collection'
import type { ActiveFilters, SortKey } from '../lib/collection'
import type { MediaCopy } from '../data/types'
import { EmptyState, Reveal } from '../components/ui'
import { TitleCard, CopyCard } from '../components/collection'
import { FilterChipBar, FilterDrawer, ViewToggle } from '../components/library'
import type { LibraryView } from '../components/library/ViewToggle'
import type { Facets } from '../components/library/FilterDrawer'
import './library.css'


const PRESETS: Record<string, Partial<ActiveFilters>> = {
  'family-night': { genres: ['Family'], types: ['film'] },
  'recently-added': { flags: ['recently-added'] },
  'tv-complete': { types: ['tv'], flags: ['complete-series'] },
  disney: { flags: ['disney'] },
  'box-sets': { flags: ['box-set'] },
  wishlist: { flags: ['wishlist'] },
  'loose-discs': { flags: ['loose-disc'] },
}

/** Derive faceted options from the dataset */
function useFacets(titles: import('../data/types').MediaTitle[]): Facets {
  return useMemo(() => {
    const genres = new Set<string>()
    const formats = new Set<string>()
    const containers = new Set<string>()
    let yearMin = Infinity
    let yearMax = -Infinity
    for (const t of titles) {
      t.genres.forEach((g: string) => genres.add(g))
      t.copies.forEach((c: MediaCopy) => {
        formats.add(c.format)
        if (c.containerName) containers.add(c.containerName)
      })
      yearMin = Math.min(yearMin, t.year)
      yearMax = Math.max(yearMax, t.year)
    }
    const fmtOrder = ['4K UHD', 'Blu-ray', 'DVD', 'Digital', 'VHS']
    return {
      genres: [...genres].sort(),
      formats: [...formats].sort((a, b) => fmtOrder.indexOf(a) - fmtOrder.indexOf(b)),
      containers: [...containers].sort(),
      yearMin,
      yearMax,
    }
  }, [titles])
}

export function Library() {

  const [titles, setTitles] = useState<import('../data/types').MediaTitle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/titles.json')
      .then(r => r.json())
      .then(bundle => {
        setTitles(loadTitles(bundle))
        setLoading(false)
      })
  }, [])

  const allSummaries = summarizeAll(titles)
  const [params, setParams] = useSearchParams()
  const facets = useFacets(titles)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const view = (params.get('view') as LibraryView) || 'titles'
  const sort = (params.get('sort') as SortKey) || 'title'

  // ----- filters, synced to the URL -----
  const filters: ActiveFilters = useMemo(
    () => ({
      query: params.get('q') ?? '',
      types: params.getAll('type'),
      genres: params.getAll('genre'),
      formats: params.getAll('format'),
      storage: params.getAll('storage'),
      containers: params.getAll('container'),
      flags: params.getAll('flag'),
    }),
    [params],
  )

  const setFilters = (f: ActiveFilters) => {
    const next = new URLSearchParams()
    if (f.query) next.set('q', f.query)
    f.types.forEach(v => next.append('type', v))
    f.genres.forEach(v => next.append('genre', v))
    f.formats.forEach(v => next.append('format', v))
    f.storage.forEach(v => next.append('storage', v))
    f.containers.forEach(v => next.append('container', v))
    f.flags.forEach(v => next.append('flag', v))
    if (view !== 'titles') next.set('view', view)
    if (sort !== 'title') next.set('sort', sort)
    setParams(next, { replace: true })
  }

  // one-shot presets from Home's "View More" links
  const preset = params.get('preset')
  useEffect(() => {
    if (!preset || !PRESETS[preset]) return
    const p = PRESETS[preset]
    const merged = { ...emptyFilters, ...p, query: filters.query }
    setFilters(merged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  const setView = (v: LibraryView) => {
    const next = new URLSearchParams(params)
    v === 'titles' ? next.delete('view') : next.set('view', v)
    setParams(next, { replace: true })
  }

  const setSort = (s: SortKey) => {
    const next = new URLSearchParams(params)
    s === 'title' ? next.delete('sort') : next.set('sort', s)
    setParams(next, { replace: true })
  }

  const clearAll = () => {
    setParams(new URLSearchParams(), { replace: true })
  }

  // ----- selection -----
  const filtered = useMemo(() => {
    const items = allSummaries.map(summary => ({ summary, title: titles.find((t: import('../data/types').MediaTitle) => t.id === summary.id)! }))
    return items.filter(({ title }) => matchesFilters(title, filters))
  }, [filters])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    sortSummaries(arr, sort)
    return arr
  }, [filtered, sort])

  const copyEntries = useMemo(() => {
    const entries: { copy: MediaCopy; titleId: string; titleName: string }[] = []
    for (const { title } of filtered) {
      for (const copy of title.copies) {
        if (copy.ownershipStatus === 'sold') continue
        entries.push({ copy, titleId: title.id, titleName: title.title })
      }
    }
    return entries
  }, [filtered])

  const totalCount = allSummaries.length
  const resultCount = view === 'copies' ? copyEntries.length : sorted.length
  const hasFilters =
    filters.query !== '' ||
    filters.types.length > 0 ||
    filters.genres.length > 0 ||
    filters.formats.length > 0 ||
    filters.storage.length > 0 ||
    filters.containers.length > 0 ||
    filters.flags.length > 0

  if (loading) return (
    <div className="page library" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: 'var(--text-muted, #888)' }}>Loading library…</p>
    </div>
  )

  return (
    <div className="page library">
      <header className="library__head">
        <div>
          <p className="kicker">The Collection</p>
          <h1 className="library__title">Library</h1>
          <p className="library__sub">
            Every title we own, want back, or are hunting for — binder discs, box sets and all.
          </p>
        </div>
        <div className="library__controls">
          <ViewToggle value={view} onChange={setView} />
          <button className="library__filter-btn" onClick={() => setDrawerOpen(true)}>
            <SlidersHorizontal size={15} />
            Filters
            {hasFilters && <span className="library__filter-dot" aria-hidden="true" />}
          </button>
        </div>
      </header>

      <FilterChipBar
        filters={filters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        onClearAll={clearAll}
        resultCount={resultCount}
        totalCount={totalCount}
      />

      {preset && null}

      {resultCount === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title={hasFilters ? 'Nothing on this shelf' : 'The library is empty'}
          body={
            hasFilters
              ? 'No titles match the current search and filters. Try loosening a filter or clearing them all.'
              : 'Once copies are logged, they will appear here as posters, box sets and binder discs.'
          }
          action={
            hasFilters ? (
              <button className="btn btn--ghost" onClick={clearAll}>
                Clear all filters
              </button>
            ) : undefined
          }
        />
      ) : view === 'titles' ? (
        <div className="library__grid library__grid--titles">
          {sorted.map(({ summary }, i) => (
            <Reveal key={summary.id} delay={Math.min(i * 30, 260)} y={18}>
              <TitleCard summary={summary} width={420} />
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="library__grid library__grid--copies">
          {copyEntries.map(({ copy, titleId, titleName }, i) => (
            <Reveal key={copy.copyId} delay={Math.min(i * 25, 240)} y={16}>
              <Link to={`/title/${titleId}`} className="library__copy-link">
                <CopyCard copy={copy} titleName={titleName} compact />
              </Link>
            </Reveal>
          ))}
        </div>
      )}

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onChange={setFilters}
        facets={facets}
        resultCount={resultCount}
        onClearAll={clearAll}
      />
    </div>
  )
}