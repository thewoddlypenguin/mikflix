import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, FileUp, Film, PackagePlus, Pencil, TriangleAlert, ImagePlus, Search, Trash2, Check, Loader2 } from 'lucide-react'
import { fetchTitles } from '../lib/data-adapter'
import { summarizeAll } from '../lib/summaries'
import { Badge, Poster } from '../components/ui'
import type { MediaTitle } from '../data/types'
import './admin.css'

const PLACEHOLDERS = [
  {
    icon: <FileUp size={18} />,
    title: 'Import Data',
    body: 'Pull in the spreadsheet export and map columns to the schema.',
    cta: 'Start import',
  },
  {
    icon: <Film size={18} />,
    title: 'Add Title',
    body: 'Log a new movie, series, or concert disc into the catalog.',
    cta: 'New title',
  },
  {
    icon: <PackagePlus size={18} />,
    title: 'Add Copy',
    body: 'Register a physical copy — format, edition, and where it lives.',
    cta: 'New copy',
  },
  {
    icon: <Pencil size={18} />,
    title: 'Edit Inventory Item',
    body: 'Correct a label, move a copy between drawers, or retire it.',
    cta: 'Browse inventory',
  },
  {
    icon: <TriangleAlert size={18} />,
    title: 'Review Uncertain Matches',
    body: 'Confirm or fix titles matched from handwritten or partial labels.',
    cta: 'Review queue',
  },
]

interface TitleImageState {
  id: string
  title: string
  manual_image_url: string | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function Admin() {
  const [titles, setTitles] = useState<MediaTitle[]>([])
  const [uncertain, setUncertain] = useState(() => [] as ReturnType<typeof summarizeAll>)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchTitles()
      .then(all => {
        if (cancelled) return
        setTitles(all)
        setUncertain(summarizeAll(all).filter(s => s.hasUncertainMatch))
        setLoaded(true)
      })
      .catch(err => {
        console.error('Failed to load titles:', err)
        if (!cancelled) setLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="page admin">
      <header className="admin__head">
        <div>
          <p className="kicker">
            <Lock size={11} />
            Curator Only
          </p>
          <h1 className="admin__title">Manage Collection</h1>
          <p className="admin__sub">
            Editing tools are stubbed for now — the shell below shows where each workflow will live.
          </p>
        </div>
      </header>

      <div className="admin__grid">
        {PLACEHOLDERS.map(p => (
          <button key={p.title} className="admin__card">
            <span className="admin__card-icon">{p.icon}</span>
            <span className="admin__card-title">{p.title}</span>
            <span className="admin__card-body">{p.body}</span>
            <span className="admin__card-cta">{p.cta} →</span>
          </button>
        ))}
      </div>

      <ManualImageManager titles={titles} loaded={loaded} />

      <section className="admin__section">
        <h2 className="admin__section-title">Review Queue Preview</h2>
        <p className="admin__section-sub">
          Low-confidence matches that will need a human eye after the first import.
        </p>
        <div className="admin__queue">
          {uncertain.map(s => (
            <div key={s.id} className="admin__queue-row">
              <span className="admin__queue-title">{s.title}</span>
              <Badge tone="lilac">Uncertain Match</Badge>
              <span className="mono">low confidence</span>
            </div>
          ))}
          {uncertain.length === 0 && loaded && (
            <p className="admin__queue-empty">Queue is clear — every label matched cleanly.</p>
          )}
        </div>
      </section>
    </div>
  )
}

/* ═══════════════════════ Manual Image Manager ═══════════════════════ */

function ManualImageManager({ titles, loaded }: { titles: MediaTitle[]; loaded: boolean }) {
  const [imageStates, setImageStates] = useState<Record<string, TitleImageState>>({})
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Hydrate override state from the API (source of truth for writes)
  useEffect(() => {
    fetch('/api/titles')
      .then(r => {
        if (!r.ok) throw new Error(`api ${r.status}`)
        return r.json()
      })
      .then((list: TitleImageState[]) => {
        setImageStates(Object.fromEntries(list.map(t => [t.id, t])))
      })
      .catch(err => console.error('manual-image API unavailable:', err))
  }, [])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return titles
      .filter(t => terms.every(term => t.title.toLowerCase().includes(term)))
      .slice(0, 8)
  }, [query, titles])

  const selected = selectedId ? titles.find(t => t.id === selectedId) ?? null : null
  const selectedState = selectedId ? imageStates[selectedId] : undefined
  const manualUrl = selectedState?.manual_image_url ?? null

  const pick = (t: MediaTitle) => {
    setSelectedId(t.id)
    setUrlDraft(imageStates[t.id]?.manual_image_url ?? '')
    setSaveState('idle')
    setError(null)
  }

  const applyUrl = async () => {
    if (!selectedId || !urlDraft.trim()) return
    await save(() => fetch('/api/manual-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleId: selectedId, url: urlDraft.trim() }),
    }))
  }

  const uploadFile = async (file: File) => {
    if (!selectedId) return
    const form = new FormData()
    form.append('titleId', selectedId)
    form.append('file', file)
    await save(() => fetch('/api/manual-image/upload', { method: 'POST', body: form }))
  }

  const remove = async () => {
    if (!selectedId) return
    await save(() => fetch(`/api/manual-image?titleId=${encodeURIComponent(selectedId)}`, { method: 'DELETE' }))
  }

  const save = async (doFetch: () => Promise<Response>) => {
    setSaveState('saving')
    setError(null)
    try {
      const res = await doFetch()
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setImageStates(prev => ({
        ...prev,
        [selectedId!]: { ...(prev[selectedId!] ?? { id: selectedId!, title: selected?.title ?? '' }), manual_image_url: body.manual_image_url },
      }))
      setUrlDraft(body.manual_image_url ?? '')
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaveState('error')
    }
  }

  return (
    <section className="admin__section">
      <h2 className="admin__section-title">Manual Images</h2>
      <p className="admin__section-sub">
        Override the TMDb poster for any title. A manual image always wins.
      </p>

      <div className="imgmgr">
        {/* ---- picker column ---- */}
        <div className="imgmgr__picker">
          <div className="imgmgr__search">
            <Search size={14} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Find a title…"
              aria-label="Find a title"
            />
          </div>
          <div className="imgmgr__results">
            {!loaded && <p className="imgmgr__note">Loading library…</p>}
            {loaded && !query && <p className="imgmgr__note">Type to search across {titles.length} titles.</p>}
            {loaded && query && results.length === 0 && (
              <p className="imgmgr__note">No titles match “{query}”.</p>
            )}
            {results.map(t => {
              const overridden = Boolean(imageStates[t.id]?.manual_image_url)
              return (
                <button
                  key={t.id}
                  className={`imgmgr__row ${selectedId === t.id ? 'is-active' : ''}`}
                  onClick={() => pick(t)}
                >
                  <span className="imgmgr__row-title">{t.title}</span>
                  {overridden && <Badge tone="gold">manual</Badge>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ---- editor column ---- */}
        <div className="imgmgr__editor">
          {!selected ? (
            <p className="imgmgr__note">Pick a title on the left to manage its image.</p>
          ) : (
            <>
              <div className="imgmgr__target">
                <Poster
                  seed={selected.artSeed}
                  hue={selected.artHue}
                  motif={selected.artMotif}
                  title={selected.title}
                  posterUrl={manualUrl ?? selected.posterUrl}
                  width={140}
                  height={210}
                />
                <div>
                  <p className="imgmgr__target-name">{selected.title}</p>
                  <p className="imgmgr__target-sub mono">
                    {manualUrl ? 'MANUAL OVERRIDE ACTIVE' : selected.posterUrl ? 'USING TMDB POSTER' : 'USING PROCEDURAL ART'}
                  </p>
                </div>
              </div>

              <label className="imgmgr__label" htmlFor="imgmgr-url">Image URL</label>
              <div className="imgmgr__urlrow">
                <input
                  id="imgmgr-url"
                  value={urlDraft}
                  onChange={e => { setUrlDraft(e.target.value); setSaveState('idle') }}
                  placeholder="https://… or /images/…"
                />
                <button
                  className="btn btn--primary imgmgr__apply"
                  onClick={applyUrl}
                  disabled={saveState === 'saving' || !urlDraft.trim() || urlDraft.trim() === (manualUrl ?? '')}
                >
                  {saveState === 'saving' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                  Save
                </button>
              </div>

              <div className="imgmgr__uploadrow">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                  hidden
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) uploadFile(f)
                    e.target.value = ''
                  }}
                />
                <button
                  className="btn btn--ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={saveState === 'saving'}
                >
                  <ImagePlus size={14} />
                  Upload file…
                </button>
                <span className="imgmgr__hint">jpg / png / webp / avif / gif · ≤ 8 MB · saved to public/images/</span>
              </div>

              {manualUrl && (
                <div className="imgmgr__current">
                  <span className="imgmgr__label">Current override</span>
                  <img src={manualUrl} alt="" className="imgmgr__preview" />
                  <code className="imgmgr__path">{manualUrl}</code>
                  <button className="btn btn--danger" onClick={remove} disabled={saveState === 'saving'}>
                    <Trash2 size={14} />
                    Remove override
                  </button>
                </div>
              )}

              {saveState === 'saved' && <p className="imgmgr__status imgmgr__status--ok">Saved — live on the site.</p>}
              {saveState === 'error' && <p className="imgmgr__status imgmgr__status--err">{error}</p>}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
