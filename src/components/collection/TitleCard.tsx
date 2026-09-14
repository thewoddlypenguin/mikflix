import { Link } from 'react-router'
import { Badge, Poster, titleBadges, titleStatusLine } from '../ui'
import type { TitleSummary } from '../../data/types'
import './TitleCard.css'

interface TitleCardProps {
  summary: TitleSummary
  width?: number
}

/** Poster-led card for a grouped title */
export function TitleCard({ summary, width = 340 }: TitleCardProps) {
  const badges: { label: string; tone: 'gold' | 'teal' | 'ember' | 'lilac' | 'neutral' }[] =
    titleBadges(summary)
  return (
    <Link
      to={`/title/${summary.id}`}
      className="title-card"
      aria-label={`${summary.title} (${summary.year})`}
    >
      <div className="title-card__frame">
        <Poster
          seed={summary.artSeed}
          hue={summary.artHue}
          motif={summary.artMotif}
          title={summary.title}
          width={width}
          height={Math.round(width * 1.5)}
        />
        <div className="title-card__badges">
          {badges.map(b => (
            <Badge key={b.label} tone={b.tone}>
              {b.label}
            </Badge>
          ))}
          {summary.isDuplicate && summary.copyCount > 1 && (
            <span className="title-card__count" title="Multiple copies owned">
              ×{summary.copyCount}
            </span>
          )}
        </div>
      </div>
      <div className="title-card__meta">
        <span className="title-card__title">{summary.title}</span>
        <span className="title-card__sub mono">
          {summary.year} · {titleStatusLine(summary)}
        </span>
      </div>
    </Link>
  )
}