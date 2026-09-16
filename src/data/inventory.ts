import raw from './generated/titles.json'

/**
 * Typed loader for the generated inventory bundle (src/data/generated/titles.json).
 * Shape is produced by data/scripts/export_bundle.py — do not hand-edit the JSON.
 */

export interface InventoryCopy {
  entry_id: string | null
  season_set: string | null
  part_volume: string | null
  disc_start: number | null
  disc_end: number | null
  disc_count: number | null
  storage_type: 'discgear' | 'binder' | 'drawer' | 'digital'
  container_name: string | null
  slot_start: number | null
  slot_end: number | null
  location_detail: string | null
  format: string | null
  label_raw: string | null
  match_status: string | null
  match_confidence: string | null
  notes: string | null
}

export interface InventoryTitle {
  id: string
  display_title: string
  media_type: 'movie' | 'tv' | 'music'
  franchise: string | null
  release_year: number | null
  match_status: 'matched' | 'unmatched' | 'uncertain' | 'review'
  match_confidence: 'high' | 'medium' | 'low' | null
  copy_count: number
  formats: string[]
  storage_types: string[]
  season_sets: string[]
  containers: string[]
  copies: InventoryCopy[]
}

export interface InventoryBundle {
  schema: number
  generated_at: string
  titles: InventoryTitle[]
}

export const inventoryBundle = raw as unknown as InventoryBundle
export const inventoryTitles: InventoryTitle[] = inventoryBundle.titles

export const bundleGeneratedAt = inventoryBundle.generated_at
