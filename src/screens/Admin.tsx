import { Lock, FileUp, Film, PackagePlus, Pencil, TriangleAlert } from 'lucide-react'
import { allTitles } from '../data'
import { summarizeAll } from '../lib/summaries'
import { Badge } from '../components/ui'
import './admin.css'

const PLACEHOLDERS = [
  {
    icon: <FileUp size={18} />,
    title: 'Import Data',
    body: 'Pull in the spreadsheet export and map columns to the collection schema.',
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

export function Admin() {
  const uncertain = summarizeAll(allTitles).filter(s => s.hasUncertainMatch)

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
          {uncertain.length === 0 && (
            <p className="admin__queue-empty">Queue is clear — every label matched cleanly.</p>
          )}
        </div>
      </section>
    </div>
  )
}