import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Lock, LogOut, ImagePlus, Search, Trash2, Check, Loader2, X, Plus, Pencil,
  TriangleAlert, Eye, EyeOff,
} from 'lucide-react'
import { fetchTitles } from '../lib/data-adapter'
import { summarizeAll } from '../lib/summaries'
import { Badge, Poster } from '../components/ui'
import type { MediaTitle } from '../data/types'
import './admin.css'

/* ═══════════════════════ Auth (session-scoped) ═══════════════════════ */

const AUTH_KEY = 'mikflix.admin.unlocked'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? ''

function useAdminAuth() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')
  const configured = ADMIN_PASSWORD.length > 0
  return {
    unlocked,
    configured,
    unlock(pw: string): boolean {
      if (!configured || pw !== ADMIN_PASSWORD) return false
      sessionStorage.setItem(AUTH_KEY, '1')
      setUnlocked(true)
      return true
    },
    bypass() {
      sessionStorage.setItem(AUTH_KEY, '1')
      setUnlocked(true)
    },
    lock() {
      sessionStorage.removeItem(AUTH_KEY)
      setUnlocked(false)
    },
  }
}

function PasswordGate({
  onUnlock, onBypass, configured,
}: {
  onUnlock: (pw: string) => boolean
  onBypass: () => void
  configured: boolean
}) {
  const [pw, setPw] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!pw) return
    if (onUnlock(pw)) return
    setError('Incorrect password.')
    setShakeKey(k => k + 1)
    setPw('')
  }

  return (
    <div className="page admin">
      <div className="gate" key={shakeKey}>
        <span className="gate__lock"><Lock size={22} /></span>
        <h1 className="gate__title">Curator Access</h1>
        <p className="gate__sub">This area manages the live collection. Enter the admin password to continue.</p>
        {!configured && (
          <p className="gate__hint">
            No <code>VITE_ADMIN_PASSWORD</code> is configured — the gate is open in dev mode.
          </p>
        )}
        <form className="gate__form" onSubmit={submit}>
          <div className="gate__row">
            <input
              type={reveal ? 'text' : 'password'}
              value={pw}
              onChange={e => { setPw(e.target.value); setError(null) }}
              placeholder="Password"
              aria-label="Admin password"
              autoFocus
            />
            <button type="button" className="gate__eye" onClick={() => setReveal(r => !r)} aria-label={reveal ? 'Hide password' : 'Show password'}>
              {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {configured ? (
            <button type="submit" className="btn btn--primary gate__submit">
              <Check size={15} />
              Unlock
            </button>
          ) : (
            <button type="button" className="btn btn--primary gate__submit" onClick={onBypass}>
              <Check size={15} />
              Enter
            </button>
          )}
        </form>
        {error && <p className="gate__error" role="alert">{error}</p>}
      </div>
    </div>
  )
}

/* ═══════════════════════ Dashboard shell ═══════════════════════ */

type Tab = 'inventory' | 'images' | 'review'

const TABS: { id: Tab; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'images', label: 'Images' },
  { id: 'review', label: 'Review' },
]

interface Toast { msg: string; tone: 'ok' | 'err' }

export function Admin() {
  const auth = useAdminAuth()

  if (!auth.unlocked) {
    return <PasswordGate onUnlock={auth.unlock} onBypass={auth.bypass} configured={auth.configured} />
  }
  return <AdminDashboard onLock={auth.lock} />
}

function AdminDashboard({ onLock }: { onLock: () => void }) {
  const [tab, setTab] = useState<Tab>('inventory')
  const [titles, setTitles] = useState<MediaTitle[]>([])
  const [uncertain, setUncertain] = useState(() => [] as ReturnType<typeof summarizeAll>)
  const [loaded, setLoaded] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [editing, setEditing] = useState<{ titleId: string | null } | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

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
  }, [refresh])

  const reload = () => setRefresh(r => r + 1)

  const showToast = (msg: string, tone: Toast['tone'] = 'ok') => {
    setToast({ msg, tone })
    setTimeout(() => setToast(null), 3200)
  }

  const handleSaved = (created: boolean, name: string) => {
    setEditing(null)
    reload()
    showToast(created ? `Added “${name}” to the collection.` : `Saved “${name}”.`)
  }

  const handleDeleted = (name: string) => {
    reload()
    showToast(`Deleted “${name}”.`)
  }

  return (
    <div className="page admin">
      <header className="admin__head">
        <div>
          <p className="kicker">
            <Lock size={11} />
            Curator Session
          </p>
          <h1 className="admin__title">Manage Collection</h1>
          <p className="admin__sub">
            Edits persist through rebuilds — they are re-applied to the bundle after every generate + enrich.
          </p>
        </div>
        <button className="btn btn--ghost admin__lock" onClick={onLock}>
          <LogOut size={14} />
          Lock
        </button>
      </header>

      <nav className="tabs" aria-label="Admin sections">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tabs__tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'review' && uncertain.length > 0 && <span className="tabs__count">{uncertain.length}</span>}
          </button>
        ))}
      </nav>

      {tab === 'inventory' && (
        <InventoryTab
          titles={titles}
          loaded={loaded}
          onEdit={id => setEditing({ titleId: id })}
          onCreate={() => setEditing({ titleId: null })}
          onDeleted={handleDeleted}
        />
      )}

      {tab === 'images' && <ManualImageManager key={refresh} titles={titles} loaded={loaded} />}

      {tab === 'review' && (
        <section className="admin__section">
          <h2 className="admin__section-title">
            <TriangleAlert size={16} className="admin__section-icon" />
            Review Queue
          </h2>
          <p className="admin__section-sub">
            Low-confidence matches that need a human eye. Fix them from the Inventory tab.
          </p>
          <div className="admin__queue">
            {uncertain.map(s => (
              <div key={s.id} className="admin__queue-row">
                <span className="admin__queue-title">{s.title}</span>
                <Badge tone="lilac">Uncertain Match</Badge>
                <span className="mono">low confidence</span>
                <button className="btn btn--ghost admin__queue-fix" onClick={() => setEditing({ titleId: s.id })}>
                  <Pencil size={13} />
                  Fix
                </button>
              </div>
            ))}
            {uncertain.length === 0 && loaded && (
              <p className="admin__queue-empty">Queue is clear — every label matched cleanly.</p>
            )}
          </div>
        </section>
      )}

      {editing && (
        <TitleEditor
          titleId={editing.titleId}
          onSaved={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status">
          <Check size={14} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════ Inventory tab ═══════════════════════ */

const TYPE_LABEL: Record<string, string> = { film: 'Movie', tv: 'TV', music: 'Music' }

function InventoryTab({
  titles, loaded, onEdit, onCreate, onDeleted,
}: {
  titles: MediaTitle[]
  loaded: boolean
  onEdit: (id: string) => void
  onCreate: () => void
  onDeleted: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return titles
    return titles.filter(t => {
      const hay = `${t.title} ${t.year} ${t.genres.join(' ')}`.toLowerCase()
      return terms.every(term => hay.includes(term))
    })
  }, [query, titles])

  const doDelete = async (id: string, name: string) => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/title/${encodeURIComponent(id)}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setConfirmId(null)
      onDeleted(name)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="admin__section">
      <div className="inv__toolbar">
        <div className="inv__search">
          <Search size={14} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search title, year, genre…"
            aria-label="Search inventory"
          />
        </div>
        <button className="btn btn--primary" onClick={onCreate}>
          <Plus size={14} />
          Add Title
        </button>
      </div>

      <div className="inv__list">
        {!loaded && <p className="imgmgr__note">Loading library…</p>}
        {loaded && rows.length === 0 && (
          <p className="imgmgr__note">No titles match “{query}”.</p>
        )}
        {rows.map(t => (
          <div key={t.id} className="inv__row">
            <div className="inv__cell inv__cell--main">
              <span className="inv__name">{t.title}</span>
              <span className="inv__meta mono">
                {t.year} · {TYPE_LABEL[t.mediaType] ?? t.mediaType} · {t.copies.length} {t.copies.length === 1 ? 'copy' : 'copies'}
                {t.genres.length > 0 && ` · ${t.genres.slice(0, 3).join(' / ')}`}
              </span>
            </div>
            {t.wishlist && <Badge tone="lilac">wishlist</Badge>}
            {t.manualImageUrl && <Badge tone="gold">manual art</Badge>}

            {confirmId === t.id ? (
              <span className="inv__confirm">
                <span className="inv__confirm-text">Delete for good?</span>
                <button className="btn btn--danger" disabled={deleting} onClick={() => doDelete(t.id, t.title)}>
                  {deleting ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                  Confirm
                </button>
                <button className="btn btn--ghost" onClick={() => setConfirmId(null)}>
                  <X size={13} />
                  Cancel
                </button>
              </span>
            ) : (
              <span className="inv__actions">
                <button className="btn btn--ghost" onClick={() => onEdit(t.id)}>
                  <Pencil size={13} />
                  Edit
                </button>
                <button className="btn btn--ghost inv__delete" onClick={() => setConfirmId(t.id)}>
                  <Trash2 size={13} />
                  Delete
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      {error && <p className="imgmgr__status imgmgr__status--err">{error}</p>}
    </section>
  )
}

/* ═══════════════════════ Title editor (modal) ═══════════════════════ */

interface WlForm { type: string; edition: string; format: string; priority: string; reason: string }
interface CopyForm {
  entry_id: string | null
  format: string
  condition: string
  storage_type: string
  container_name: string
  slot_start: string
  slot_end: string
  location_detail: string
  season_set: string
  disc_count: string
  label_raw: string
  notes: string
}
interface TitleForm {
  display_title: string
  media_type: string
  franchise: string
  release_year: string
  genres: string
  overview: string
  tagline: string
  onWishlist: boolean
  wishlist: WlForm
  copies: CopyForm[]
}

const FORMATS = ['DVD', 'Blu-ray', '4K UHD', 'Digital', 'VHS']
const STORAGE_TYPES = ['shelf', 'drawer', 'binder', 'digital']
const MEDIA_TYPES = [
  { value: 'movie', label: 'Movie' },
  { value: 'tv', label: 'TV' },
  { value: 'music', label: 'Music' },
]
const WISHLIST_TYPES = [
  { value: 'buy', label: 'Buy' },
  { value: 'replace', label: 'Replace' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'missing-box', label: 'Missing box' },
]
const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const EMPTY_COPY = (): CopyForm => ({
  entry_id: `manual-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
  format: 'DVD', condition: '', storage_type: 'shelf', container_name: '',
  slot_start: '', slot_end: '', location_detail: '', season_set: '',
  disc_count: '', label_raw: '', notes: '',
})

const EMPTY_FORM = (): TitleForm => ({
  display_title: '', media_type: 'movie', franchise: '', release_year: '',
  genres: '', overview: '', tagline: '',
  onWishlist: false,
  wishlist: { type: 'buy', edition: '', format: 'DVD', priority: 'medium', reason: '' },
  copies: [EMPTY_COPY()],
})

function TitleEditor({
  titleId, onSaved, onClose,
}: {
  titleId: string | null
  onSaved: (created: boolean, name: string) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<TitleForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(Boolean(titleId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!titleId) return
    let cancelled = false
    fetch(`/api/title/${encodeURIComponent(titleId)}`)
      .then(async r => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
        return body
      })
      .then((raw: Record<string, unknown>) => {
        if (cancelled) return
        const copies = Array.isArray(raw.copies) ? raw.copies : []
        const wl = (raw.wishlist ?? null) as Record<string, unknown> | null
        setForm({
          display_title: String(raw.display_title ?? ''),
          media_type: String(raw.media_type ?? 'movie'),
          franchise: String(raw.franchise ?? ''),
          release_year: raw.release_year != null ? String(raw.release_year) : '',
          genres: Array.isArray(raw.genres) ? (raw.genres as string[]).join(', ') : '',
          overview: String(raw.overview ?? ''),
          tagline: String(raw.tagline ?? ''),
          onWishlist: Boolean(wl),
          wishlist: {
            type: String(wl?.wishlist_type ?? 'buy'),
            edition: String(wl?.desired_edition ?? ''),
            format: String(wl?.desired_format ?? 'DVD'),
            priority: String(wl?.priority ?? 'medium'),
            reason: String(wl?.reason ?? ''),
          },
          copies: copies.length ? copies.map(copyFromRaw) : [EMPTY_COPY()],
        })
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [titleId])

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const patch = (p: Partial<TitleForm>) => setForm(f => ({ ...f, ...p }))
  const patchWl = (p: Partial<WlForm>) => setForm(f => ({ ...f, wishlist: { ...f.wishlist, ...p } }))
  const patchCopy = (idx: number, p: Partial<CopyForm>) =>
    setForm(f => ({ ...f, copies: f.copies.map((c, i) => (i === idx ? { ...c, ...p } : c)) }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.display_title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = buildPayload(form)
      const res = await fetch(
        titleId ? `/api/title/${encodeURIComponent(titleId)}` : '/api/title',
        {
          method: titleId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      onSaved(!titleId, form.display_title.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div className="ted" role="dialog" aria-modal="true" aria-label={titleId ? 'Edit title' : 'Add title'}>
      <div className="ted__backdrop" onClick={onClose} />
      <form className="ted__panel" onSubmit={save}>
        <header className="ted__head">
          <div>
            <h2 className="ted__title">{titleId ? 'Edit Title' : 'Add Title'}</h2>
            <p className="ted__sub mono">{titleId ?? 'new entry'}</p>
          </div>
          <button type="button" className="ted__close" onClick={onClose} aria-label="Close editor">
            <X size={16} />
          </button>
        </header>

        <div className="ted__body">
          {loading ? (
            <p className="imgmgr__note"><Loader2 size={14} className="spin" /> Loading title…</p>
          ) : (
            <>
              <section className="ted__section">
                <h3 className="ted__section-title">Core</h3>
                <div className="ted__grid">
                  <Field label="Title" className="ted__span2">
                    <input value={form.display_title} onChange={e => patch({ display_title: e.target.value })} required />
                  </Field>
                  <Field label="Type">
                    <select value={form.media_type} onChange={e => patch({ media_type: e.target.value })}>
                      {MEDIA_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Year">
                    <input inputMode="numeric" value={form.release_year} onChange={e => patch({ release_year: e.target.value })} placeholder="1998" />
                  </Field>
                  <Field label="Franchise">
                    <input value={form.franchise} onChange={e => patch({ franchise: e.target.value })} placeholder="e.g. Marvel Cinematic Universe" />
                  </Field>
                  <Field label="Genres (comma-separated)">
                    <input value={form.genres} onChange={e => patch({ genres: e.target.value })} placeholder="Animation, Family, Comedy" />
                  </Field>
                </div>
              </section>

              <section className="ted__section">
                <h3 className="ted__section-title">Story</h3>
                <div className="ted__grid">
                  <Field label="Tagline" className="ted__span2">
                    <input value={form.tagline} onChange={e => patch({ tagline: e.target.value })} />
                  </Field>
                  <Field label="Synopsis" className="ted__span2">
                    <textarea rows={3} value={form.overview} onChange={e => patch({ overview: e.target.value })} />
                  </Field>
                </div>
              </section>

              <section className="ted__section">
                <h3 className="ted__section-title">Wishlist</h3>
                <label className="ted__check">
                  <input
                    type="checkbox"
                    checked={form.onWishlist}
                    onChange={e => patch({ onWishlist: e.target.checked })}
                  />
                  On the wishlist
                </label>
                {form.onWishlist && (
                  <div className="ted__grid">
                    <Field label="Wishlist type">
                      <select value={form.wishlist.type} onChange={e => patchWl({ type: e.target.value })}>
                        {WISHLIST_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Priority">
                      <select value={form.wishlist.priority} onChange={e => patchWl({ priority: e.target.value })}>
                        {PRIORITIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Desired edition">
                      <input value={form.wishlist.edition} onChange={e => patchWl({ edition: e.target.value })} placeholder="4K steelbook" />
                    </Field>
                    <Field label="Desired format">
                      <select value={form.wishlist.format} onChange={e => patchWl({ format: e.target.value })}>
                        {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </Field>
                    <Field label="Reason" className="ted__span2">
                      <input value={form.wishlist.reason} onChange={e => patchWl({ reason: e.target.value })} />
                    </Field>
                  </div>
                )}
              </section>

              <section className="ted__section">
                <div className="ted__section-head">
                  <h3 className="ted__section-title">Copies ({form.copies.length})</h3>
                  <button type="button" className="btn btn--ghost" onClick={() => setForm(f => ({ ...f, copies: [...f.copies, EMPTY_COPY()] }))}>
                    <Plus size={13} />
                    Add copy
                  </button>
                </div>
                <div className="ted__copies">
                  {form.copies.map((c, i) => (
                    <div key={c.entry_id ?? i} className="ted__copy">
                      <div className="ted__copy-head">
                        <span className="mono">copy {i + 1}</span>
                        {form.copies.length > 1 && (
                          <button type="button" className="ted__copy-remove" onClick={() => setForm(f => ({ ...f, copies: f.copies.filter((_, j) => j !== i) }))} aria-label={`Remove copy ${i + 1}`}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="ted__grid">
                        <Field label="Format">
                          <select value={c.format} onChange={e => patchCopy(i, { format: e.target.value })}>
                            {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </Field>
                        <Field label="Storage">
                          <select value={c.storage_type} onChange={e => patchCopy(i, { storage_type: e.target.value })}>
                            {STORAGE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </Field>
                        <Field label="Condition">
                          <input value={c.condition} onChange={e => patchCopy(i, { condition: e.target.value })} placeholder="Mint / Good / Worn" />
                        </Field>
                        <Field label="Edition label">
                          <input value={c.label_raw} onChange={e => patchCopy(i, { label_raw: e.target.value })} />
                        </Field>
                        <Field label="Container">
                          <input value={c.container_name} onChange={e => patchCopy(i, { container_name: e.target.value })} placeholder="DG-14 / Binder A" />
                        </Field>
                        <Field label="Season / set">
                          <input value={c.season_set} onChange={e => patchCopy(i, { season_set: e.target.value })} />
                        </Field>
                        <Field label="Slots (start / end)">
                          <span className="ted__pair">
                            <input inputMode="numeric" value={c.slot_start} onChange={e => patchCopy(i, { slot_start: e.target.value })} />
                            <input inputMode="numeric" value={c.slot_end} onChange={e => patchCopy(i, { slot_end: e.target.value })} />
                          </span>
                        </Field>
                        <Field label="Disc count">
                          <input inputMode="numeric" value={c.disc_count} onChange={e => patchCopy(i, { disc_count: e.target.value })} />
                        </Field>
                        <Field label="Location detail" className="ted__span2">
                          <input value={c.location_detail} onChange={e => patchCopy(i, { location_detail: e.target.value })} />
                        </Field>
                        <Field label="Notes" className="ted__span2">
                          <input value={c.notes} onChange={e => patchCopy(i, { notes: e.target.value })} />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="ted__foot">
          {error && <p className="imgmgr__status imgmgr__status--err" role="alert">{error}</p>}
          <span className="ted__foot-spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving || loading}>
            {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            {titleId ? 'Save changes' : 'Create title'}
          </button>
        </footer>
      </form>
    </div>
  )
}

function copyFromRaw(raw: Record<string, unknown>): CopyForm {
  const s = (v: unknown) => (v == null ? '' : String(v))
  return {
    entry_id: (raw.entry_id as string | null) ?? null,
    format: s(raw.format) || 'DVD',
    condition: s(raw.condition),
    storage_type: s(raw.storage_type) || 'shelf',
    container_name: s(raw.container_name),
    slot_start: s(raw.slot_start),
    slot_end: s(raw.slot_end),
    location_detail: s(raw.location_detail),
    season_set: s(raw.season_set),
    disc_count: s(raw.disc_count),
    label_raw: s(raw.label_raw),
    notes: s(raw.notes),
  }
}

function buildPayload(form: TitleForm) {
  const intOrNull = (s: string) => {
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : null
  }
  const strOrNull = (s: string) => {
    const t = s.trim()
    return t ? t : null
  }
  return {
    display_title: form.display_title.trim(),
    media_type: form.media_type,
    franchise: strOrNull(form.franchise),
    release_year: intOrNull(form.release_year) ?? 0,
    genres: form.genres.split(',').map(g => g.trim()).filter(Boolean),
    overview: strOrNull(form.overview),
    tagline: strOrNull(form.tagline),
    wishlist: form.onWishlist
      ? {
          wishlist_type: form.wishlist.type,
          desired_edition: form.wishlist.edition.trim() || 'Any edition',
          desired_format: form.wishlist.format,
          priority: form.wishlist.priority,
          reason: strOrNull(form.wishlist.reason),
        }
      : null,
    copies: form.copies.map(c => ({
      entry_id: c.entry_id,
      season_set: strOrNull(c.season_set),
      disc_count: intOrNull(c.disc_count),
      storage_type: c.storage_type,
      container_name: strOrNull(c.container_name),
      slot_start: intOrNull(c.slot_start),
      slot_end: intOrNull(c.slot_end),
      location_detail: strOrNull(c.location_detail),
      format: c.format,
      label_raw: strOrNull(c.label_raw),
      condition: strOrNull(c.condition),
      match_status: 'confirmed',
      match_confidence: 'high',
      notes: strOrNull(c.notes),
    })),
  }
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`ted__field ${className ?? ''}`}>
      <span className="ted__field-label">{label}</span>
      {children}
    </label>
  )
}

/* ═══════════════════════ Manual Image Manager ═══════════════════════ */

interface TitleImageState {
  id: string
  title: string
  manual_image_url: string | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

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
