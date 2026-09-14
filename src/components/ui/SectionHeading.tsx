import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import './SectionHeading.css'

interface SectionHeadingProps {
  title: string
  description?: string
  linkTo?: string
  linkLabel?: string
  action?: React.ReactNode
}

export function SectionHeading({ title, description, linkTo, linkLabel, action }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div className="section-heading__text">
        <h2 className="section-heading__title">{title}</h2>
        {description && <p className="section-heading__desc">{description}</p>}
      </div>
      {action ??
        (linkTo && (
          <Link to={linkTo} className="section-heading__link">
            {linkLabel ?? 'View More'}
            <ArrowRight />
          </Link>
        ))}
    </div>
  )
}