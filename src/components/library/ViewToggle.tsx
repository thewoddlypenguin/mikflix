import { LayoutGrid, Copy } from 'lucide-react'
import { ToggleGroup } from '../ui'
import './ViewToggle.css'

export type LibraryView = 'titles' | 'copies'

const options = [
  {
    value: 'titles' as LibraryView,
    label: 'Grouped Titles',
    icon: <LayoutGrid size={13} />,
  },
  {
    value: 'copies' as LibraryView,
    label: 'Individual Copies',
    icon: <Copy size={13} />,
  },
]

export function ViewToggle({
  value,
  onChange,
}: {
  value: LibraryView
  onChange: (v: LibraryView) => void
}) {
  return <ToggleGroup options={options} value={value} onChange={onChange} ariaLabel="Library view mode" />
}