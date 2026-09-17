import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Play, MapPin, BookmarkPlus, Sparkles, ArrowRight } from 'lucide-react'
import { fetchTitles } from '../lib/data-adapter'
import { featuredTitleId, homeCategories, smartLists } from '../data/categories'
import { summarizeAll } from '../lib/summaries'
import { Poster, Reveal } from '../components/ui'
import { CollectionRow, TitleCard } from '../components/collection'
import { upper, storageAbbr } from '../lib/format'
import type { MediaTitle } from '../data/types'
import '../styles/home.css'

function HomeHero({ titles }: { titles: MediaTitle[] }) {
  const navigate = useNavigate()

  /** Featured title: curated pick if it exists, else most copies (ties → alphabetical). */
  const featured =
    titles.find(t => t.id === featuredTitleId) ??
    [...titles].sort(
      (a, b) => b.copies.length - a.copies.length || a.title.localeCompare(b.title),
    )[0]

  if (!featured) return null

  const ownedRows = featured.copies.slice(0, 2)
  const wl = featured.wishlist

  return (
    <section className="hero" aria-label="Featured title">
      <div className="hero__backdrop" aria-hidden="true">
        <Poster
          seed={featured.artSeed}
          hue={featured.artHue}
          motif={featured.artMotif}
          title={featured.title}
          posterUrl={featured.backdropUrl}
          wide
          width={900}
          height={506}
        />
        <div className="hero__scrim" />
      </div>

      <div className="hero__content">
        <Reveal>
          <p className="kicker">Featured from the shelf</p>
        </Reveal>
        <Reveal delay={90}>
          <h1 className="hero__title">{featured.title}</h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="hero__meta mono">
            {featured.year || '—'} · {featured.rating} · {upper(featured.runtime)}
            {featured.genres.length ? ` · ${featured.genres.join(' / ')}` : ''}
          </p>
        </Reveal>
        <Reveal delay={220}>
          {featured.synopsis && featured.synopsis !== 'No synopsis available.' ? (
            <p className="hero__synopsis">{featured.synopsis}</p>
          ) : (
            <p className="hero__synopsis">
              {featured.copies.length} {featured.copies.length === 1 ? 'copy' : 'copies'} on the
              shelf{featured.franchise ? ` — part of ${featured.franchise}` : ''}.
            </p>
          )}
        </Reveal>

        {ownedRows.length > 0 && (
          <Reveal delay={280}>
            <div className="hero__ownership">
              {ownedRows.map(c => (
                <div className="hero__own-row" key={c.copyId}>
                  <span className="hero__own-icon owned">
                    <MapPin size={13} />
                  </span>
                  <span>
                    <strong>{c.editionName}</strong> — {storageAbbr(c.storageType)}
                    {c.containerName ? ` ${c.containerName}` : ''}
                    {c.locationLabel ? ` ${c.locationLabel}` : ''}
                  </span>
                </div>
              ))}
              {wl && (
                <div className="hero__own-row">
                  <span className="hero__own-icon wanted">
                    <BookmarkPlus size={13} />
                  </span>
                  <span>
                    Want the <strong>{wl.desiredEdition}</strong>
                    {wl.reason ? ` — ${wl.reason.toLowerCase()}` : ''}
                  </span>
                </div>
              )}
            </div>
          </Reveal>
        )}

        <Reveal delay={340}>
          <div className="hero__actions">
            <button className="btn btn--primary" onClick={() => navigate(`/title/${featured.id}`)}>
              <Play size={15} />
              Open Title Page
            </button>
            <button className="btn btn--ghost" onClick={() => navigate('/library')}>
              <Sparkles size={15} />
              Browse the Collection
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function SmartListStrip() {
  return (
    <div className="smartlist">
      {smartLists.map((s, i) => (
        <Reveal key={s.id} delay={i * 60}>
          <Link to={s.href} className="smartlist__item">
            <span className="smartlist__label">{s.label}</span>
            <span className="smartlist__desc">{s.description}</span>
            <ArrowRight size={14} className="smartlist__arrow" />
          </Link>
        </Reveal>
      ))}
    </div>
  )
}

export function Home() {
  const [titles, setTitles] = useState<MediaTitle[]>([])

  useEffect(() => {
    let cancelled = false
    fetchTitles()
      .then(all => {
        if (!cancelled) setTitles(all)
      })
      .catch(err => console.error('Failed to load titles:', err))
    return () => { cancelled = true }
  }, [])

  const allSummaries = summarizeAll(titles)
  const summariesById = new Map(allSummaries.map(s => [s.id, s]))

  return (
    <div className="home">
      <HomeHero titles={titles} />

      <div className="page">
        <SmartListStrip />

        {homeCategories.map(cat => {
          const summaries = cat.titleIds
            .map(id => summariesById.get(id))
            .filter((s): s is NonNullable<typeof s> => Boolean(s))
          if (!summaries.length) return null
          return (
            <CollectionRow
              key={cat.id}
              label={cat.label}
              description={cat.description}
              viewAllTo={cat.preset ? `/library?preset=${cat.preset}` : undefined}
            >
              {summaries.map((s, i) => (
                <Reveal key={s.id} delay={Math.min(i * 55, 330)} y={16}>
                  <TitleCard summary={s} />
                </Reveal>
              ))}
            </CollectionRow>
          )
        })}
      </div>
    </div>
  )
}
