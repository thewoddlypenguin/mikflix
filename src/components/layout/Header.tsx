import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { Search, Settings2, X } from 'lucide-react'
import './Header.css'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/library', label: 'Library' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/admin', label: 'Manage', end: true },
]

export function Header() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // "/" focuses search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/library?q=${encodeURIComponent(q)}` : '/library')
  }

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="site-header__inner">
        <Link to="/" className="brand" aria-label="Mikflix — home">
          <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="6" y="7" width="5.5" height="18" rx="1.5" fill="#e2a94f" />
            <rect x="13.5" y="10" width="5.5" height="15" rx="1.5" fill="#c88a36" />
            <rect x="21" y="5.5" width="5.5" height="19.5" rx="1.5" fill="#8a6b45" />
            <rect x="5" y="25.5" width="22" height="1.8" rx="0.9" fill="#5ec8b8" />
          </svg>
          <span className="brand__name">
            Mikflix
            <span className="brand__sub">Family Media Library</span>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Primary">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `main-nav__link ${isActive ? 'is-active' : ''}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <form className="header-search" onSubmit={submit} role="search">
          <Search size={14} className="header-search__icon" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the collection…"
            aria-label="Search the collection"
          />
          {query && (
            <button
              type="button"
              className="header-search__clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
          <kbd className="header-search__kbd">/</kbd>
        </form>

        <Link to="/admin" className="admin-link" aria-label="Manage collection">
          <Settings2 size={17} />
          <span className="admin-link__label">Manage</span>
        </Link>
      </div>
    </header>
  )
}