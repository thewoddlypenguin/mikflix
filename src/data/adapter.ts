import type { InventoryBundle, InventoryCopy, InventoryTitle } from './inventory'
import type { CopyType, MediaCopy, MediaTitle, StorageType } from './types'

/**
 * Adapter: generated physical-inventory JSON → app-facing MediaTitle[].
 *
 * The generated bundle (data/scripts/export_bundle.py → titles.json) speaks
 * the database schema (snake_case, 'movie', raw format tags). The app speaks
 * the mock-era MediaTitle shape. This module is the only translator; when the
 * TMDb enrichment pass lands, extend the mappings here rather than editing
 * the generated JSON.
 */

function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s || 'untitled'
}

function adaptStorageType(raw: string): StorageType {
  if (raw === 'binder' || raw === 'drawer' || raw === 'shelf') return raw
  return 'drawer' // discgear/digital/unknown → drawer as safe bucket
}

function adaptFormat(raw: string | null): MediaCopy['format'] {
  switch ((raw ?? '').toLowerCase()) {
    case 'blu-ray':
      return 'Blu-ray'
    case 'dvd':
      return 'DVD'
    case 'digital':
      return 'Digital'
    case 'vhs':
      return 'VHS'
    case 'disc':
    default:
      return 'DVD' // raw 'disc' is unverified; corrected by TMDb enrichment later
  }
}

function adaptCopyType(storage: string): CopyType {
  return storage === 'binder' ? 'binder-disc' : 'keep-case'
}

function adaptMatchStatus(raw: string | null): MediaCopy['titleMatchStatus'] {
  switch (raw) {
    case 'matched':
      return 'confirmed'
    case 'uncertain':
      return 'uncertain'
    default:
      // 'unmatched', 'review', null — treat as uncertain until reconciled
      return 'uncertain'
  }
}

function adaptCopy(
  copy: InventoryCopy,
  index: number,
  titleId: string,
  displayTitle: string,
): MediaCopy {
  return {
    copyId: `${titleId}-${index}`,
    editionName: copy.label_raw ?? displayTitle,
    format: adaptFormat(copy.format),
    ownershipStatus: 'owned',
    storageType: adaptStorageType(copy.storage_type),
    containerName: copy.container_name ?? undefined,
    locationLabel: copy.location_detail ?? undefined,
    copyType: adaptCopyType(copy.storage_type),
    rawLabel: copy.label_raw ?? undefined,
    titleMatchStatus: adaptMatchStatus(copy.match_status),
    notes: copy.notes ?? undefined,
  }
}

/** Map one generated title record to the app-facing MediaTitle shape. */
export function adaptGeneratedTitle(raw: InventoryTitle): MediaTitle {
  return {
    id: raw.id,
    title: raw.display_title,
    normalizedTitle: slugify(raw.display_title),
    mediaType: raw.media_type === 'tv' ? 'tv' : 'film',
    franchise: raw.franchise ?? undefined,
    genres: [], // placeholder until TMDb enrichment
    year: raw.release_year ?? 0,
    rating: 'NR',
    runtime: '—',
    synopsis: '',
    copies: raw.copies.map((c, i) => adaptCopy(c, i, raw.id, raw.display_title)),
    wishlist: undefined,
    artSeed: raw.id,
    artHue: raw.id.charCodeAt(0) % 360,
  }
}

/** Map the whole generated bundle to app-facing titles. */
export function adaptGeneratedTitles(raw: unknown): MediaTitle[] {
  const titles = (raw as InventoryBundle).titles ?? []
  return titles.map(adaptGeneratedTitle)
}
