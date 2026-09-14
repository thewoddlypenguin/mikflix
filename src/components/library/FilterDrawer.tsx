import { useEffect } from 'react'
import { X } from 'lucide-react'
import { FLAG_LABELS, STORAGE_LABELS, TYPE_LABELS } from '../../lib/collection'
import type { ActiveFilters } from '../../lib/collection'
import './FilterDrawer.css'

export interface Facets {
  genres: string[]
  formats: string[]
  containers: string[]
  yearMin: number
  yearMax: number
}

interface FilterDrawerProps {
  open: boolean
  onClose: () => void
  filters: ActiveFilters
  onChange: (f: ActiveFilters) => void
  facets: Facets
  resultCount: number
  onClearAll: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fdrawer__section">
      <h4 className="fdrawer__section-title mono">{title}</h4>
      {children}
    </div>
  )
}

function ToggleList({
  options,
  selected,
  onToggle,
}: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="fdrawer__options">
      {options.map(o => {
        const on = selected.includes(o)
        return (
          <label key={o} className={`fdrawer__opt ${on ? 'is-on' : ''}`}>
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(o)}
            />
            <span className="fdrawer__opt-box" aria-hidden="true" />
            {o}
          </label>
        )
      })}
    </div>
  )
}

export function FilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  facets,
  resultCount,
  onClearAll,
}: FilterDrawerProps) {
  // close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const toggle = (key: keyof ActiveFilters, v: string) => {
    const cur = filters[key] as string[]
    const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]
    onChange({ ...filters, [key]: next })
  }

  return (
    <>
      <div
        className={`fdrawer__scrim ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fdrawer ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-label="Filter collection"
      >
        <header className="fdrawer__head">
          <h3>Filters</h3>
          <div className="fdrawer__head-actions">
            <button className="fdrawer__clear" onClick={onClearAll}>
              Clear all
            </button>
            <button className="fdrawer__close" onClick={onClose} aria-label="Close filters">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="fdrawer__scroll">
          <Section title="Media Type">
            <ToggleList
              options={Object.keys(TYPE_LABELS).map(k => TYPE_LABELS[k])}
              selected={filters.types.map(t => TYPE_LABELS[t] ?? t)}
              onToggle={v => {
                const key = Object.keys(TYPE_LABELS).find(k => TYPE_LABELS[k] === v) ?? v
                toggle('types', key)
              }}
            />
          </Section>

          <Section title="Genre">
            <ToggleList
              options={facets.genres}
              selected={filters.genres}
              onToggle={v => toggle('genres', v)}
            />
          </Section>

          <Section title="Format">
            <ToggleList
              options={facets.formats}
              selected={filters.formats}
              onToggle={v => toggle('formats', v)}
            />
          </Section>

          <Section title="Storage">
            <ToggleList
              options={Object.keys(STORAGE_LABELS).map(k => STORAGE_LABELS[k])}
              selected={filters.storage.map(s => STORAGE_LABELS[s] ?? s)}
              onToggle={v => {
                const key = Object.keys(STORAGE_LABELS).find(k => STORAGE_LABELS[k] === v) ?? v
                toggle('storage', key)
              }}
            />
          </Section>

          <Section title="Container">
            <ToggleList
              options={facets.containers}
              selected={filters.containers}
              onToggle={v => toggle('containers', v)}
            />
          </Section>

          <Section title="Release Year">
            <YearPicker min={facets.yearMin} max={facets.yearMax} />
          </Section>

          <Section title="Status & Flags">
            <ToggleList
              options={Object.keys(FLAG_LABELS)}
              selected={filters.flags}
              onToggle={v => toggle('flags', v)}
            />
          </Section>
        </div>

        <footer className="fdrawer__foot">
          <span className="mono">{resultCount} titles match</span>
          <button className="fdrawer__apply" onClick={onClose}>
            Show results
          </button>
        </footer>
      </aside>
    </>
  )
}

function YearPicker({ min, max }: { min: number; max: number }) {
  return (
    <p className="fdrawer__year-note mono">
      {min}–{max} · year filter lands with the database
    </p>
  )
}