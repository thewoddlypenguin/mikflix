export type MediaType = 'film' | 'tv' | 'music'

export type StorageType = 'drawer' | 'binder' | 'shelf' | 'digital'

export type Format =
  | '4K UHD'
  | 'Blu-ray'
  | 'DVD'
  | 'VHS'
  | 'Digital'

export type OwnershipStatus = 'owned' | 'wishlist' | 'lost' | 'sold'

export type CopyType = 'box' | 'keep-case' | 'slip' | 'loose-disc' | 'binder-disc'

/** How confidently a raw physical label was matched to this title */
export type MatchStatus = 'confirmed' | 'uncertain' | 'unmatched'

export type WishlistType =
  | 'buy'
  | 'replace'
  | 'upgrade'
  | 'missing-box'

export type Priority = 'high' | 'medium' | 'low'

/**
 * A physical object in the collection (or one that used to be / should be).
 * The future schema will likely separate title / edition / inventory copy /
 * wishlist item — modeled here as one flat "record" per physical object,
 * with nullable fields for the states we haven't reached yet.
 */
export interface MediaCopy {
  copyId: string
  editionName: string
  format: Format
  ownershipStatus: OwnershipStatus
  storageType: StorageType
  containerName?: string
  locationLabel?: string
  copyType: CopyType
  rawLabel?: string
  titleMatchStatus?: MatchStatus
  matchConfidence?: number
  notes?: string
  /** edition-level flags */
  completeSeries?: boolean
  boxSet?: boolean
  specialEdition?: boolean
}

export interface WishlistEntry {
  wishlistId: string
  wishlistType: WishlistType
  desiredEdition: string
  desiredFormat: Format
  priority: Priority
  reason?: string
  purchaseLinkPlaceholder?: string
}

export interface MediaTitle {
  id: string
  title: string
  normalizedTitle: string
  mediaType: MediaType
  franchise?: string
  genres: string[]
  year: number
  rating: string
  runtime: string
  synopsis: string
  /** Curator-set image (URL or /images/... path) — overrides TMDb art when present */
  manualImageUrl?: string
  posterUrl?: string
  backdropUrl?: string
  trailerUrl?: string
  copies: MediaCopy[]
  wishlist?: WishlistEntry
  /** visual identity for procedural poster art */
  artSeed: string
  artHue: number
  artMotif?: 'ring' | 'arch' | 'horizon' | 'emblem' | 'mono'
}

/** A saved shortcut to a filtered view of the collection */
export interface SmartList {
  id: string
  label: string
  description: string
  icon: 'clapperboard' | 'tv' | 'disc-3' | 'archive' | 'binoculars'
  href: string
}

export interface ShelfCopyRow {
  format: Format
  editionName: string
  storageType: StorageType
  containerName?: string
  locationLabel?: string
}

export interface TitleSummary {
  id: string
  title: string
  year: number
  mediaType: MediaType
  genres: string[]
  franchise?: string
  rating: string
  runtime: string
  synopsis: string
  artSeed: string
  artHue: number
  artMotif?: MediaTitle['artMotif']
  posterUrl?: string
  copyCount: number
  formats: Format[]
  storageTypes: StorageType[]
  containers: string[]
  shelfRows: ShelfCopyRow[]
  hasBoxSet: boolean
  hasBinderDisc: boolean
  hasLooseDiscOnly: boolean
  isCompleteSeries: boolean
  isDuplicate: boolean
  hasUncertainMatch: boolean
  hasWishlist: boolean
  wishlistType?: WishlistType
  hasReplacementWanted: boolean
  hasUpgradeWanted: boolean
  addedAt: string
  yearRank: number
  /** Curator-set image override (mirrors MediaTitle.manualImageUrl) */
  manualImageUrl?: string
}