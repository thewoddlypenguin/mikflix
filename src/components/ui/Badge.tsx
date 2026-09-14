import type { MediaCopy, MediaTitle, TitleSummary } from '../../data/types'
import './Badge.css'

export type BadgeTone = 'gold' | 'teal' | 'ember' | 'lilac' | 'neutral'

const TONE_CLASS: Record<BadgeTone, string> = {
  gold: 'badge--gold',
  teal: 'badge--teal',
  ember: 'badge--ember',
  lilac: 'badge--lilac',
  neutral: 'badge--neutral',
}

interface BadgeProps {
  tone?: BadgeTone
  children: React.ReactNode
  title?: string
}

export function Badge({ tone = 'neutral', children, title }: BadgeProps) {
  return (
    <span className={`badge ${TONE_CLASS[tone]}`} title={title}>
      {children}
    </span>
  )
}

/** Badge colors keyed by product meaning */
export function copyStatusTone(c: MediaCopy): BadgeTone {
  if (c.ownershipStatus === 'lost') return 'ember'
  if (c.titleMatchStatus === 'uncertain') return 'lilac'
  if (c.copyType === 'binder-disc' || c.copyType === 'loose-disc') return 'neutral'
  return 'gold'
}

export function copyBadgeLabel(c: MediaCopy): string {
  if (c.ownershipStatus === 'lost') return 'Missing / Lost'
  if (c.titleMatchStatus === 'uncertain') return 'Uncertain Match'
  if (c.boxSet) return 'Box Set'
  if (c.completeSeries) return 'Complete Series'
  if (c.copyType === 'binder-disc') return 'Binder Disc'
  if (c.copyType === 'loose-disc') return 'Loose Disc'
  return 'Owned'
}

export const WISHLIST_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  buy: { label: 'Wishlist', tone: 'teal' },
  replace: { label: 'Replacement Wanted', tone: 'ember' },
  upgrade: { label: 'Upgrade Wanted', tone: 'lilac' },
  'missing-box': { label: 'Missing Box', tone: 'teal' },
}

export function wishlistBadge(type: string) {
  return WISHLIST_BADGE[type] ?? WISHLIST_BADGE.buy
}

/** Derive the badge set shown on a grouped title card */
export function titleBadges(s: TitleSummary): { label: string; tone: BadgeTone }[] {
  const out: { label: string; tone: BadgeTone }[] = []
  if (s.hasWishlist && s.wishlistType) {
    const wb = wishlistBadge(s.wishlistType)
    out.push(wb)
  }
  if (s.hasBoxSet) out.push({ label: 'Box Set', tone: 'gold' })
  if (s.isCompleteSeries) out.push({ label: 'Complete Series', tone: 'gold' })
  if (s.hasBinderDisc) out.push({ label: 'Binder Disc', tone: 'neutral' })
  if (s.hasUncertainMatch) out.push({ label: 'Uncertain Match', tone: 'lilac' })
  if (s.hasLooseDiscOnly) {
    out.push({ label: 'Loose Disc Only', tone: 'neutral' })
  }
  return out.slice(0, 3)
}

/** Small status strip under a grouped poster */
export function titleStatusLine(s: TitleSummary): string {
  if (s.copyCount === 0 && s.hasWishlist) return 'Wishlist — not yet owned'
  if (s.copyCount === 1) {
    const r = s.shelfRows[0]
    return r ? `${r.format} · ${r.containerName ?? r.storageType}` : 'Owned'
  }
  return `${s.copyCount} copies · ${s.formats.join(' / ')}`
}

export function titleBadgeLine(title: MediaTitle): string {
  const bits: string[] = []
  if (title.copies.some(c => c.boxSet)) bits.push('Box Set')
  return bits.join(' · ')
}