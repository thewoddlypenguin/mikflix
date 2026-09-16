import { Link, useNavigate, useParams } from 'react-router'
import {
  Play,
  ArrowLeft,
  BookmarkPlus,
  PackagePlus,
  Pencil,
  ArrowUpNarrowWide,
  TriangleAlert,
} from 'lucide-react'
import { allTitles } from '../data'
import { summarizeTitle } from '../lib/summaries'
import { addedLabel, ownedCopies } from '../lib/collection'
import { Badge, Poster, wishlistBadge } from '../components/ui'
import { CopyCard } from '../components/collection'
import { upper, storageAbbr, storageGlyph } from '../lib/format'
import './titleDetail.css'

export function TitleDetail() {
  const { titleId } = useParams()
  const navigate = useNavigate()
  const title = allTitles.find(t => t.id === titleId)

  if (!title) {
    return (
      <div className="page td__missing">
        <p className="kicker">Off the shelf</p>
        <h1>That title isn’t logged yet</h1>
        <p className="td__missing-body">
          The record you’re looking for isn’t in the current (mock) dataset.
        </p>
        <button className="btn btn--ghost" onClick={() => navigate('/library')}>
          <ArrowLeft size={15} />
          Back to Library
        </button>
      </div>
    )
  }

  const summary = summarizeTitle(title)
  const owned = ownedCopies(title)
  const lostCopies = title.copies.filter(c => c.ownershipStatus === 'lost')
  const wl = title.wishlist
  const primaryCopy = owned[0] ?? lostCopies[0]

  return (
    <div className="td">
      {/* ============ A. WATCH INFO ============ */}
      <section className="td-hero" aria-label="Watch info">
        <div className="td-hero__backdrop" aria-hidden="true">
          <Poster
            seed={title.artSeed}
            hue={title.artHue}
            motif={title.artMotif}
            title={title.title}
            width={900}
            height={506}
          />
          <div className="td-hero__scrim" />
        </div>

        <div className="td-hero__content">
          <button className="td-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} />
            Back
          </button>

          <div className="td-hero__grid">
            <div className="td-hero__poster">
              <Poster
                seed={title.artSeed}
                hue={title.artHue}
                motif={title.artMotif}
                title={title.title}
                width={380}
                height={570}
              />
            </div>

            <div className="td-hero__info">
              <p className="kicker">
                {title.mediaType === 'tv' ? 'TV Series' : title.mediaType === 'music' ? 'Music / Concert' : 'Feature Film'}
                {title.franchise ? ` · ${title.franchise}` : ''}
              </p>
              <h1 className="td-hero__title">{title.title}</h1>
              <p className="td-hero__meta mono">
                {title.year} · {title.rating} · {upper(title.runtime)} ·{' '}
                {title.genres.join(' / ')}
              </p>
              <p className="td-hero__synopsis">{title.synopsis}</p>

              <div className="td-hero__watchrow">
                <button className="btn btn--primary">
                  <Play size={15} />
                  Watch Trailer
                </button>
                <div className="td-hero__where">
                  {primaryCopy ? (
                    <>
                      <span className="td-hero__where-glyph" aria-hidden="true">
                        {storageGlyph(primaryCopy.storageType)}
                      </span>
                      <span>
                        Find it in <strong>{primaryCopy.containerName ?? storageAbbr(primaryCopy.storageType)}</strong>
                        {primaryCopy.locationLabel ? ` — ${primaryCopy.locationLabel}` : ''}
                      </span>
                    </>
                  ) : (
                    <span className="td-hero__notowned">
                      <TriangleAlert size={14} />
                      Not currently on the shelf — see wishlist below
                    </span>
                  )}
                </div>
              </div>

              <div className="td-hero__badges">
                {summary.hasBoxSet && <Badge tone="gold">Box Set</Badge>}
                {summary.isCompleteSeries && <Badge tone="gold">Complete Series</Badge>}
                {summary.hasBinderDisc && <Badge tone="neutral">Binder Disc</Badge>}
                {summary.hasLooseDiscOnly && <Badge tone="neutral">Loose Disc Only</Badge>}
                {summary.hasUncertainMatch && <Badge tone="lilac">Uncertain Match</Badge>}
                {summary.isDuplicate && <Badge tone="gold">×{summary.copyCount} Copies</Badge>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="page">
        {/* ============ B. OWNERSHIP INFO ============ */}
        <section className="td-section" aria-label="Ownership info">
          <header className="td-section__head">
            <h2>
              On the Shelf <span className="td-section__count mono">{owned.length + lostCopies.length} copies</span>
            </h2>
            <span className="mono">logged since {addedLabel(title.id)}</span>
          </header>

          {title.copies.length === 0 ? (
            <p className="td-empty-note">
              Nothing owned yet — this title lives on the wishlist for now.
            </p>
          ) : (
            <div className="td-copies">
              {title.copies.map(copy => (
                <CopyCard key={copy.copyId} copy={copy} titleName={title.title} />
              ))}
            </div>
          )}

          {summary.hasUncertainMatch && (
            <aside className="td-uncertain">
              <TriangleAlert size={16} />
              <div>
                <strong>Uncertain match.</strong> One of these copies was matched from a handwritten
                label. Verify the edition before any cleanup or purge.
              </div>
            </aside>
          )}
        </section>

        {/* wishlist / wanted block */}
        {wl && (
          <section className="td-section" aria-label="Wishlist entry">
            <header className="td-section__head">
              <h2>
                Also Wanted{' '}
                <Badge tone={wishlistBadge(wl.wishlistType).tone}>
                  {wishlistBadge(wl.wishlistType).label}
                </Badge>
              </h2>
              <span className={`td-prio td-prio--${wl.priority} mono`}>{wl.priority} priority</span>
            </header>
            <div className="td-wanted">
              <div className="td-wanted__target">
                <span className="mono">desired edition</span>
                <strong>{wl.desiredEdition}</strong>
                <span className="td-wanted__format mono">{upper(wl.desiredFormat)}</span>
              </div>
              {wl.reason && <p className="td-wanted__reason">“{wl.reason}”</p>}
            </div>
          </section>
        )}

        {/* ============ C. COLLECTOR ACTIONS ============ */}
        <section className="td-section" aria-label="Collector actions">
          <header className="td-section__head">
            <h2>Collector Actions</h2>
            <span className="mono">edit mode ships with the database</span>
          </header>
          <div className="td-actions">
            <button className="td-action">
              <PackagePlus size={16} />
              <span>Add Copy</span>
            </button>
            <button className="td-action">
              <Pencil size={16} />
              <span>Edit Item</span>
            </button>
            <button className="td-action td-action--teal">
              <BookmarkPlus size={16} />
              <span>Add to Wishlist</span>
            </button>
            <button className="td-action td-action--ember">
              <TriangleAlert size={16} />
              <span>Mark Lost</span>
            </button>
            <button className="td-action td-action--lilac">
              <ArrowUpNarrowWide size={16} />
              <span>Mark Upgrade Wanted</span>
            </button>
          </div>
        </section>

        {/* more from the same shelf */}
        <section className="td-section" aria-label="Related titles">
          <header className="td-section__head">
            <h2>Nearby on the Shelf</h2>
            <Link to="/library" className="section-heading__link">
              Full Library
            </Link>
          </header>
          <div className="td-nearby">
            {allTitles
              .filter(
                t =>
                  t.id !== title.id &&
                  (t.franchise === title.franchise || t.genres.some(g => title.genres.includes(g))),
              )
              .slice(0, 4)
              .map(t => {
                const s = summarizeTitle(t)
                return (
                  <Link key={t.id} to={`/title/${t.id}`} className="td-nearby__card">
                    <Poster seed={s.artSeed} hue={s.artHue} motif={s.artMotif} title={s.title} width={180} height={270} />
                    <span className="td-nearby__name">{s.title}</span>
                    <span className="mono">{s.year}</span>
                  </Link>
                )
              })}
          </div>
        </section>
      </div>
    </div>
  )
}