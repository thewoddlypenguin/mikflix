import { useLocation } from 'react-router'
import './Footer.css'

export function Footer() {
  const { pathname } = useLocation()
  if (pathname === '/title') return null
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="site-footer__stamp">
          <span className="mono">MIKFLIX</span>
          <span className="site-footer__dot">·</span>
          <span className="mono">A PRIVATE COLLECTION · NOT FOR CIRCULATION</span>
        </p>
        <p className="site-footer__meta mono">
          Mock-data preview · shell build 0.1
        </p>
      </div>
    </footer>
  )
}