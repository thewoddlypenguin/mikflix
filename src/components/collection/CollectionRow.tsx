import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SectionHeading } from '../ui/SectionHeading'
import './CollectionRow.css'

interface CollectionRowProps {
  label: string
  description?: string
  viewAllTo?: string
  children: React.ReactNode
}

/** Horizontal, snap-scrolling poster row with edge-fade and arrow controls */
export function CollectionRow({ label, description, viewAllTo, children }: CollectionRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>(':scope > *')
    const step = card ? (card.offsetWidth + 18) * 3 : el.clientWidth * 0.8
    el.scrollBy({ left: step * dir, behavior: 'smooth' })
  }

  return (
    <section className="collection-row">
      <SectionHeading title={label} description={description} linkTo={viewAllTo} linkLabel="View More" />
      <div className="collection-row__stage">
        <div className="collection-row__track" ref={trackRef}>
          {children}
        </div>
        <button
          className="collection-row__arrow collection-row__arrow--left"
          onClick={() => scrollBy(-1)}
          aria-label={`Scroll ${label} backward`}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="collection-row__arrow collection-row__arrow--right"
          onClick={() => scrollBy(1)}
          aria-label={`Scroll ${label} forward`}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  )
}