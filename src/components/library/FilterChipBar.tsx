import { FLAG_LABELS, STORAGE_LABELS, TYPE_LABELS } from '../../lib/collection'
import type { ActiveFilters, SortKey } from '../../lib/collection'
import { FilterChip } from '../ui'
import './FilterChipBar.css'

const SORT_LABELS: Record<SortKey, string> = {
  title: 'Title A–Z',
  year: 'Release year',
  recent: 'Recently added',
}

interface FilterChipBarProps {
  filters: ActiveFilters
  onChange: (f: ActiveFilters) => void
  sort: SortKey
  onSortChange: (s: SortKey) => void
  onClearAll: () => void
  resultCount: number
  totalCount: number
}

export function FilterChipBar({
  filters,
  onChange,
  sort,
  onSortChange,
  onClearAll,
  resultCount,
  totalCount,
}: FilterChipBarProps) {
  const chips: { key: keyof ActiveFilters; value: string; group: string; label: string }[] = []

  for (const t of filters.types)
    chips.push({ key: 'types', value: t, group: 'type', label: TYPE_LABELS[t] ?? t })
  for (const g of filters.genres)
    chips.push({ key: 'genres', value: g, group: 'genre', label: g })
  for (const f of filters.formats)
    chips.push({ key: 'formats', value: f, group: 'format', label: f })
  for (const s of filters.storage)
    chips.push({ key: 'storage', value: s, group: 'storage', label: STORAGE_LABELS[s] ?? s })
  for (const c of filters.containers)
    chips.push({ key: 'containers', value: c, group: 'where', label: c })
  for (const f of filters.flags)
    chips.push({
      key: 'flags',
      value: f,
      group: 'status',
      label: FLAG_LABELS[f] ?? f,
    })

  const remove = (key: keyof ActiveFilters, value: string) => {
    const cur = filters[key] as string[]
    onChange({ ...filters, [key]: cur.filter(v => v !== value) })
  }

  return (
    <div className="chip-bar">
      <div className="chip-bar__row">
        {chips.length === 0 ? (
          <span className="chip-bar__hint mono">
            {resultCount} of {totalCount} titles · no filters active
          </span>
        ) : (
          <>
            {chips.map(c => (
              <FilterChip
                key={`${c.key}-${c.value}`}
                group={c.group}
                label={c.label}
                onRemove={() => remove(c.key, c.value)}
              />
            ))}
            <button className="chip-bar__clear" onClick={onClearAll}>
              Clear all
            </button>
          </>
        )}
        <div className="chip-bar__end">
          <select
            className="chip-bar__sort"
            value={sort}
            onChange={e => onSortChange(e.target.value as SortKey)}
            aria-label="Sort collection"
          >
            {Object.entries(SORT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="chip-bar__count mono">
        Showing {resultCount} of {totalCount} titles
      </div>
    </div>
  )
}

export { SORT_LABELS }