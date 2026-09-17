import { Link } from 'react-router'
import { ArrowRight, Binoculars, BookmarkPlus, PackageOpen } from 'lucide-react'
import { Badge, Poster, wishlistBadge } from '../ui'
import type { WishlistEntry, TitleSummary } from '../../data/types'
import './WishlistCard.css'

const PRIORITY_LABEL: Record<string, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

/** The current-ownership context line for a wishlist entry */
function contextLine(s: TitleSummary): string {
  switch (s.wishlistType) {
    case 'replace':
      return 'Copy lost — case still on the shelf'
    case 'upgrade':
      return s.copyCount > 0
        ? `Owned on ${s.formats.join(' & ')} — upgrade desired`
        : 'Owned — upgrade desired'
    case 'missing-box':
      return 'Discs in binder — box wanted'
    default:
      return 'Not owned yet'
  }
}

function contextIcon(s: TitleSummary) {
  switch (s.wishlistType) {
    case 'replace':
      return <Binoculars size={13} />
    case 'upgrade':
      return <PackageOpen size={13} />
    case 'missing-box':
      return <PackageOpen size={13} />
    default:
      return <BookmarkPlus size={13} />
  }
}

interface WishlistCardProps {
  summary: TitleSummary
  entry: WishlistEntry
}

export function WishlistCard({ summary, entry }: WishlistCardProps) {
  const badge = wishlistBadge(entry.wishlistType)
  return (
    <article className="wl-card">
      <Link to={`/title/${summary.id}`} className="wl-card__poster" aria-label={summary.title}>
        <Poster
          seed={summary.artSeed}
          hue={summary.artHue}
          motif={summary.artMotif}
          title={summary.title}
          posterUrl={summary.posterUrl}
          width={190}
          height={285}
        />
        <span className="wl-card__veil" aria-hidden="true" />
      </Link>
      <div className="wl-card__body">
        <header className="wl-card__head">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <span
            className={`wl-card__priority wl-card__priority--${entry.priority}`}
            title="Priority"
          >
            {PRIORITY_LABEL[entry.priority] ?? entry.priority}
          </span>
        </header>
        <Link to={`/title/${summary.id}`} className="wl-card__title">
          {summary.title}
        </Link>
        <p className="wl-card__edition mono">want: {entry.desiredEdition}</p>
        <p className="wl-card__context">
          {contextIcon(summary)}
          {contextLine(summary)}
        </p>
        {entry.reason && <p className="wl-card__reason">“{entry.reason}”</p>}
        <footer className="wl-card__foot">
          <span className="mono">{summary.year} · {summary.genres[0]}</span>
          <Link to={`/title/${summary.id}`} className="wl-card__more">
            view title <ArrowRight size={12} />
          </Link>
        </footer>
      </div>
    </article>
  )
}