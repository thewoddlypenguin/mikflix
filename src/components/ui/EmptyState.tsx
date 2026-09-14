import './EmptyState.css'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__glow" aria-hidden="true" />
      {icon && <div className="empty-state__icon">{icon}</div>}
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__body">{body}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}