import type {
  MediaTitle,
  MediaCopy,
  MediaType,
  Format,
  StorageType,
  CopyType,
  MatchStatus,
} from '../data/types'

// ─── Raw JSON shape ────────────────────────────────────────────────────────

interface RawCopy {
  entry_id: string | null
  season_set: string | null
  part_volume: string | null
  disc_start: number | null
  disc_end: number | null
  disc_count: number | null
  storage_type: string
  container_name: string | null
  slot_start: number | null
  slot_end: number | null
  location_detail: string | null
  format: string
  label_raw: string | null
  match_status: string
  match_confidence: string
  notes: string | null
}

interface RawTitle {
  id: string
  display_title: string
  media_type: string
  franchise: string | null
  release_year: number | null
  tmdb_id?: number | string | null
  tmdb_media_type?: string | null
  poster_path?: string | null
  backdrop_path?: string | null
  manual_image_url?: string | null
  match_status: string
  match_confidence: string
  copy_count: number
  formats: string[]
  storage_types: string[]
  season_sets: string[]
  containers: string[]
  art_seed?: string
  art_hue?: number
  art_motif?: string
  copies: RawCopy[]
}

interface RawBundle {
  schema: string
  generated_at: string
  titles: RawTitle[]
}

// ─── Mapping helpers ───────────────────────────────────────────────────────

function mapMediaType(raw: string): MediaType {
  if (raw === 'tv') return 'tv'
  if (raw === 'music') return 'music'
  return 'film' // "movie" → "film", anything else defaults to film
}

function mapFormat(format: string | null, locationDetail: string | null): Format {
  const loc = (locationDetail ?? '').toLowerCase()
  const fmt = (format ?? "").toLowerCase()

  if (fmt === '4k' || loc.includes('4k') || loc.includes('uhd')) return '4K UHD'
  if (fmt === 'blu-ray' || fmt === 'bluray' || loc.includes('blu')) return 'Blu-ray'
  if (fmt === 'vhs' || loc.includes('vhs')) return 'VHS'
  if (fmt === 'digital' || loc.includes('digital') || loc.includes('fandango')) return 'Digital'
  // "disc", "dvd", "handwritten disc", or unknown → DVD
  return 'DVD'
}

function mapStorageType(raw: string): StorageType {
  if (raw === 'digital') return 'digital'
  if (raw === 'shelf' || raw === 'discgear') return 'shelf'
  if (raw === 'drawer') return 'drawer'
  return 'binder'
}

function mapCopyType(raw: RawCopy): CopyType {
  const loc = (raw.location_detail ?? '').toLowerCase()
  if (raw.storage_type === 'binder') return 'binder-disc'
  if (loc.includes('loose')) return 'loose-disc'
  if (loc.includes('slip')) return 'slip'
  if (loc.includes('box')) return 'box'
  return 'keep-case'
}

function mapMatchStatus(raw: string): MatchStatus {
  if (raw === 'confirmed') return 'confirmed'
  if (raw === 'uncertain') return 'uncertain'
  return 'unmatched'
}

function mapMatchConfidence(raw: string): number {
  if (raw === 'high') return 0.95
  if (raw === 'medium') return 0.75
  if (raw === 'low') return 0.5
  return 0.0
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

// ─── TMDb image URLs ───────────────────────────────────────────────────────

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
const POSTER_WIDTH = 'w500'
const BACKDROP_WIDTH = 'w1280'

function mapImageUrl(
  path: string | null | undefined,
  size: string,
): string | undefined {
  if (!path) return undefined
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

// ─── Copy mapper ───────────────────────────────────────────────────────────

function mapCopy(raw: RawCopy, titleId: string, index: number): MediaCopy {
  const format = mapFormat(raw.format, raw.location_detail)
  return {
    copyId: raw.entry_id ?? `${titleId}-copy-${index}`,
    editionName: raw.label_raw ?? raw.season_set ?? 'Standard Edition',
    format,
    ownershipStatus: 'owned',
    storageType: mapStorageType(raw.storage_type),
    containerName: raw.container_name ?? undefined,
    locationLabel:
      raw.slot_start != null
        ? `Slot ${raw.slot_start}${raw.slot_end != null && raw.slot_end !== raw.slot_start ? `–${raw.slot_end}` : ''}`
        : undefined,
    copyType: mapCopyType(raw),
    rawLabel: raw.label_raw ?? undefined,
    titleMatchStatus: mapMatchStatus(raw.match_status),
    matchConfidence: mapMatchConfidence(raw.match_confidence),
    notes: raw.notes ?? undefined,
  }
}

// ─── Title mapper ──────────────────────────────────────────────────────────

const ART_MOTIFS: MediaTitle['artMotif'][] = ['ring', 'arch', 'horizon', 'emblem', 'mono']

function mapArtMotif(raw: string | null | undefined): MediaTitle['artMotif'] {
  return ART_MOTIFS.includes(raw as MediaTitle['artMotif'])
    ? (raw as MediaTitle['artMotif'])
    : 'ring'
}

function mapTitle(raw: RawTitle): MediaTitle {
  return {
    id: raw.id,
    title: raw.display_title,
    normalizedTitle: normalizeTitle(raw.display_title),
    mediaType: mapMediaType(raw.media_type),
    franchise: raw.franchise ?? undefined,
    genres: [],
    year: raw.release_year ?? 0,
    rating: 'NR',
    runtime: 'Unknown',
    synopsis: 'No synopsis available.',
    posterUrl:
      raw.manual_image_url ?? mapImageUrl(raw.poster_path, POSTER_WIDTH),
    backdropUrl: mapImageUrl(raw.backdrop_path, BACKDROP_WIDTH),
    manualImageUrl: raw.manual_image_url ?? undefined,
    artSeed: raw.art_seed ?? raw.id,
    artHue: raw.art_hue ?? 0,
    artMotif: mapArtMotif(raw.art_motif),
    copies: raw.copies.map((c, i) => mapCopy(c, raw.id, i)),
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Load and adapt the generated titles bundle into the MediaTitle[] shape
 * expected by the Mikflix UI.
 *
 * Usage:
 *   import { loadTitles } from '../lib/data-adapter'
 *   import rawBundle from '../data/generated/titles.json'
 *   const titles = loadTitles(rawBundle)
 */
export function loadTitles(bundle: unknown): MediaTitle[] {
  const { titles } = bundle as RawBundle
  return titles.map(mapTitle)
}

/**
 * Fetch /titles.json and adapt it in one step — the shared entry point for
 * every screen that needs the collection at runtime.
 */
export async function fetchTitles(): Promise<MediaTitle[]> {
  const res = await fetch('/titles.json')
  if (!res.ok) throw new Error(`titles.json ${res.status}`)
  const bundle = await res.json()
  return loadTitles(bundle)
}