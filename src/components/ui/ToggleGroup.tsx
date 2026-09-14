import { useId } from 'react'
import './ToggleGroup.css'

interface Option<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
}

interface ToggleGroupProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: ToggleGroupProps<T>) {
  const id = useId()
  return (
    <div className="toggle-group" role="group" aria-label={ariaLabel}>
      {options.map(o => (
        <button
          key={o.value}
          id={`${id}-${o.value}`}
          className={`toggle-group__btn ${value === o.value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}