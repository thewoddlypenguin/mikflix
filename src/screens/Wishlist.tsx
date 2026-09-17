import { useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, SearchX } from 'lucide-react'
import { fetchTitles } from '../lib/data-adapter'
import { summarizeAll } from '../lib/summaries'
import { Reveal, EmptyState } from '../components/ui'
import { WishlistCard } from '../components/collection'
import type { MediaTitle, WishlistType } from '../data/types'
import './wishlist.css'

const GROUP_ORDER: { type: WishlistType | 'all'; label: string; blurb: string }[] = [
  { type: 'all', label: 'Everything Wanted', blurb: 'The full hunt list, highest priority first.' },
  { type: 'buy', label: 'Want to Buy', blurb: 'Titles we don’t own yet at all.' },
  { type: 'replace', label: 'Replace Lost Copy', blurb: 'The shelf has a hole where these used to be.' },
  { type: 'upgrade', label: 'Upgrade Edition', blurb: 'Owned — but a better edition is out there.' },
  { type: 'missing-box', label: 'Missing Box / Loose Disc Only', blurb: 'Have the discs, want the case back.' },
]

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

export function Wishlist() {
  const [group, setGroup] = useState<WishlistType | 'all'>('all')
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

  const entries = useMemo(() => {
    return summarizeAll(titles)
      .filter(s => s.hasWishlist)
      .map(summary => ({
        summary,
        entry: titles.find(t => t.id === summary.id)!.wishlist!,
      }))
  }, [titles])

  const visible = useMemo(() => {
    const list = group === 'all' ? entries : entries.filter(e => e.entry.wishlistType === group)
    return [...list].sort(
      (a, b) => PRIORITY_ORDER[a.entry.priority] - PRIORITY_ORDER[b.entry.priority],
    )
  }, [entries, group])

  const countFor = (t: WishlistType | 'all') =>
    t === 'all' ? entries.length : entries.filter(e => e.entry.wishlistType === t).length

  return (
    <div className="page wl-page">
      <header className="wl-head">
        <div>
          <p className="kicker">The Hunt List</p>
          <h1 className="wl-title">Wishlist</h1>
          <p className="wl-sub">
            Wanted editions, lost discs to replace, and upgrades worth tracking down.
          </p>
        </div>
        <div className="wl-stat">
          <span className="wl-stat__num">{entries.length}</span>
          <span className="wl-stat__label mono">wanted items</span>
        </div>
      </header>

      <nav className="wl-groups" aria-label="Wishlist groups">
        {GROUP_ORDER.map(g => (
          <button
            key={g.type}
            className={`wl-group ${group === g.type ? 'is-active' : ''}`}
            onClick={() => setGroup(g.type)}
          >
            <span className="wl-group__label">{g.label}</span>
            <span className="wl-group__count mono">{countFor(g.type)}</span>
          </button>
        ))}
      </nav>
      <p className="wl-blurb">
        {GROUP_ORDER.find(g => g.type === group)?.blurb}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="Nothing in this group"
          body="When items land on the wishlist, they’ll gather here by what kind of wanted they are."
        />
      ) : (
        <div className="wl-grid">
          {visible.map(({ summary, entry }, i) => (
            <Reveal key={entry.wishlistId} delay={Math.min(i * 55, 300)} y={18}>
              <WishlistCard summary={summary} entry={entry} />
            </Reveal>
          ))}
        </div>
      )}

      <footer className="wl-foot">
        <BookmarkPlus size={14} />
        <span>
          Wishlist actions (add / remove / mark acquired) arrive with the database integration.
        </span>
      </footer>
    </div>
  )
}