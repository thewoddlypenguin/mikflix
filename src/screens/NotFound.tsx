import { Link } from 'react-router'
import { Clapperboard } from 'lucide-react'
import './notFound.css'

export function NotFound() {
  return (
    <div className="nf">
      <Clapperboard size={34} className="nf__icon" />
      <p className="kicker">Reel not found</p>
      <h1 className="nf__title">404</h1>
      <p className="nf__body">
        That page isn’t in the archive. Maybe it was lent out and never returned.
      </p>
      <Link to="/" className="btn btn--ghost">
        Back to the shelf
      </Link>
    </div>
  )
}