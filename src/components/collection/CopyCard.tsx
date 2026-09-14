import { Badge, copyBadgeLabel, copyStatusTone } from '../ui'
import { storageAbbr, storageGlyph, upper } from '../../lib/format'
import type { MediaCopy } from '../../data/types'
import './CopyCard.css'

interface CopyCardProps {
  copy: MediaCopy
  titleName: string
  compact?: boolean
}

/** Ownership card — one physical copy, museum-label style */
export function CopyCard({ copy, titleName, compact = false }: CopyCardProps) {
  const locBits = [copy.containerName, copy.locationLabel].filter(Boolean) as string[]
  return (
    <article className={`copy-card ${compact ? 'copy-card--compact' : ''}`}>
      <div className="copy-card__spine" aria-hidden="true" />
      <div className="copy-card__body">
        <header className="copy-card__head">
          <span className="copy-card__format">{upper(copy.format)}</span>
          <Badge tone={copyStatusTone(copy)}>{copyBadgeLabel(copy)}</Badge>
        </header>
        <h4 className="copy-card__edition">{copy.editionName}</h4>
        <p className="copy-card__loc" title="Where this copy lives">
          <span className="copy-card__glyph">{storageGlyph(copy.storageType)}</span>
          <span className="copy-card__loc-text">
            {storageAbbr(copy.storageType)}
            {locBits.length > 0 && <em> — {locBits.join(' — ')}</em>}
          </span>
        </p>
        {!compact && copy.rawLabel && (
          <p className="copy-card__raw mono" title="Original label as written">
            label: “{copy.rawLabel}”
          </p>
        )}
        {!compact && copy.notes && <p className="copy-card__notes">{copy.notes}</p>}
        {!compact && (
          <footer className="copy-card__foot mono">
            {titleName} · {copy.copyId}
          </footer>
        )}
      </div>
    </article>
  )
}