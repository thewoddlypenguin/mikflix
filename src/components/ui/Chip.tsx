import { wishlistBadge } from './Badge'
import './Chip.css'

type ChipVariant = 'active' | 'passive'

interface ChipProps {
  variant?: ChipVariant
  onRemove?: () => void
  onClick?: () => void
  children: React.ReactNode
}

export function Chip({ variant = 'passive', onRemove, onClick, children }: ChipProps) {
  return (
    <span
      className={`chip chip--${variant}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
    >
      {children}
      {onRemove && (
        <button
          className="chip__x"
          onClick={e => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label="Remove filter"
        >
          ×
        </button>
      )}
    </span>
  )
}

/** Filter chip with badge-toned coloring */
export function FilterChip({
  label,
  group,
  onRemove,
}: {
  label: string
  group: string
  onRemove: () => void
}) {
  return (
    <Chip variant="active" onRemove={onRemove}>
      <span className="chip__group">{group}</span>
      {label}
    </Chip>
  )
}

export function wishlistChip(type: string) {
  return wishlistBadge(type)
}