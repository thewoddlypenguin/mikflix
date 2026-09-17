import type { MediaCopy, MediaTitle } from '../data/types'

export interface ActiveFilters {
  query: string
  types: string[]
  genres: string[]
  formats: string[]
  storage: string[]
  containers: string[]
  flags: string[]
}

export const emptyFilters: ActiveFilters = {
  query: '',
  types: [],
  genres: [],
  formats: [],
  storage: [],
  containers: [],
  flags: [],
}

export type SortKey = 'title' | 'year' | 'recent'

export const FLAG_LABELS: Record<string, string> = {
  'box-set': 'Box Set',
  'complete-series': 'Complete Series',
  'loose-disc': 'Loose Disc',
  'special-edition': 'Special Edition',
  wishlist: 'On Wishlist',
  'upgrade-wanted': 'Upgrade Wanted',
  'replacement-wanted': 'Replacement Wanted',
  duplicate: 'Duplicate Copies',
  'uncertain-match': 'Uncertain Match',
}

/** Flags surfaced in the drawer but applied via the recency index */
export const RECENT_FLAG = 'recently-added'

/** Canonical franchise tag for the Disney row */
export const DISNEY_FRANCHISE = 'Disney Animated'

export const TYPE_LABELS: Record<string, string> = {
  film: 'Film',
  tv: 'TV',
  music: 'Music',
}

export const STORAGE_LABELS: Record<string, string> = {
  drawer: 'Drawer',
  binder: 'Binder',
  shelf: 'Shelf',
  digital: 'Digital',
}

function flagMatches(title: MediaTitle, flag: string): boolean {
  switch (flag) {
    case 'box-set':
      return title.copies.some(c => c.boxSet)
    case 'complete-series':
      return title.copies.some(c => c.completeSeries)
    case 'loose-disc':
      return title.copies.some(
        c => c.copyType === 'binder-disc' || c.copyType === 'loose-disc',
      )
    case 'special-edition':
      return title.copies.some(c => c.specialEdition)
    case 'wishlist':
      return Boolean(title.wishlist)
    case 'upgrade-wanted':
      return title.wishlist?.wishlistType === 'upgrade'
    case 'replacement-wanted':
      return title.wishlist?.wishlistType === 'replace'
    case 'duplicate':
      return title.copies.length > 1
    case 'uncertain-match':
      return title.copies.some(c => c.titleMatchStatus === 'uncertain')
    case RECENT_FLAG:
      return recencyRank(title.id) !== 99
    case 'disney':
      return title.franchise === DISNEY_FRANCHISE
    default:
      return true
  }
}

/** Stable recency ordering derived from the dataset (no dates in mock data) */
const recencyIndex = new Map<string, number>([
  ['smallville', 0],
  ['eyes-wide-shut', 1],
  ['hans-zimmer-live', 2],
  ['voltron', 3],
  ['lost', 4],
  ['practical-magic', 5],
  ['hamlet', 6],
  ['beauty-beast', 7],
])

export function recencyRank(id: string): number {
  return recencyIndex.get(id) ?? 99
}

export function matchesFilters(title: MediaTitle, f: ActiveFilters): boolean {
  if (f.query.trim()) {
    const q = f.query.trim().toLowerCase()
    const hay = [
      title.title,
      title.franchise ?? '',
      title.genres.join(' '),
      String(title.year),
      ...title.copies.map(c => `${c.editionName} ${c.format}`),
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (f.types.length && !f.types.includes(title.mediaType)) return false
  if (f.genres.length && !title.genres.some(g => f.genres.includes(g))) return false
  if (f.formats.length && !title.copies.some(c => f.formats.includes(c.format))) return false
  if (f.storage.length && !title.copies.some(c => f.storage.includes(c.storageType))) return false
  if (
    f.containers.length &&
    !title.copies.some(c => c.containerName && f.containers.includes(c.containerName))
  )
    return false
  if (f.flags.length && !f.flags.every(flag => flagMatches(title, flag))) return false
  return true
}

export function sortSummaries(
  items: { summary: { title: string; year: number; id: string } }[],
  sort: SortKey,
): void {
  const byTitle = (a: { summary: { title: string } }, b: { summary: { title: string } }) =>
    a.summary.title.localeCompare(b.summary.title)
  switch (sort) {
    case 'title':
      items.sort(byTitle)
      break
    case 'year':
      items.sort((a, b) => a.summary.year - b.summary.year || byTitle(a, b))
      break
    case 'recent':
      items.sort((a, b) => recencyRank(a.summary.id) - recencyRank(b.summary.id))
      break
  }
}

/** Rough stamp of when a title entered the collection, for detail-page flavor */
export function addedLabel(id: string): string {
  const stamps: Record<string, string> = {
    smallville: 'Aug 2026',
    'eyes-wide-shut': 'Jul 2026',
    'hans-zimmer-live': 'Jun 2026',
    voltron: 'May 2026',
    lost: 'Feb 2026',
  }
  return stamps[id] ?? 'Earlier logs'
}

export function ownedCopies(title: MediaTitle): MediaCopy[] {
  return title.copies.filter(c => c.ownershipStatus === 'owned')
}

export function primaryFormatLabel(formats: string[]): string {
  const order = ['4K UHD', 'Blu-ray', 'DVD', 'Digital', 'VHS']
  const sorted = [...formats].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  return sorted.join(' · ')
}