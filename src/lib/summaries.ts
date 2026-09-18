import type { MediaCopy, MediaTitle, TitleSummary } from '../data/types'
import { recencyRank } from './collection'

/**
 * Builds the denormalized "card view" of a title used across
 * Home rows, the Library grid, and the Wishlist page.
 */
export function summarizeTitle(t: MediaTitle): TitleSummary {
  const owned = t.copies.filter(c => c.ownershipStatus === 'owned')
  const formats = [...new Set(owned.map(c => c.format))]
  const storageTypes = [...new Set(owned.map(c => c.storageType))]
  const containers = [
    ...new Set(t.copies.map(c => c.containerName).filter(Boolean) as string[]),
  ]
  const shelfRows = t.copies
    .filter(c => c.ownershipStatus !== 'sold')
    .map((c: MediaCopy) => ({
      format: c.format,
      editionName: c.editionName,
      storageType: c.storageType,
      containerName: c.containerName,
      locationLabel: c.locationLabel,
    }))

  const hasBoxSet = t.copies.some(c => c.boxSet)
  const hasBinderDisc = t.copies.some(c => c.copyType === 'binder-disc')
  // any cased copy (box, keep case, slip) means the discs are not "loose only"
  const hasCasedCopy = t.copies.some(
    c => c.copyType === 'box' || c.copyType === 'keep-case' || c.copyType === 'slip',
  )

  return {
    id: t.id,
    title: t.title,
    year: t.year,
    mediaType: t.mediaType,
    genres: t.genres,
    franchise: t.franchise,
    rating: t.rating,
    runtime: t.runtime,
    synopsis: t.synopsis,
    artSeed: t.artSeed,
    artHue: t.artHue,
    artMotif: t.artMotif,
    posterUrl: t.posterUrl,
    manualImageUrl: t.manualImageUrl,
    copyCount: owned.length,
    formats,
    storageTypes,
    containers,
    shelfRows,
    hasBoxSet,
    hasBinderDisc,
    // "loose disc only" = we hold binder/loose discs but no cased copy at all
    hasLooseDiscOnly:
      (hasBinderDisc || t.copies.some(c => c.copyType === 'loose-disc')) && !hasCasedCopy,
    isCompleteSeries: t.copies.some(c => c.completeSeries),
    isDuplicate: owned.length > 1,
    hasUncertainMatch: t.copies.some(c => c.titleMatchStatus === 'uncertain'),
    hasWishlist: Boolean(t.wishlist),
    wishlistType: t.wishlist?.wishlistType,
    hasReplacementWanted: t.wishlist?.wishlistType === 'replace',
    hasUpgradeWanted: t.wishlist?.wishlistType === 'upgrade',
    addedAt: '', // unused; recency handled via recencyRank
    yearRank: recencyRank(t.id),
  }
}

export function summarizeAll(titles: MediaTitle[]): TitleSummary[] {
  return titles.map(summarizeTitle)
}