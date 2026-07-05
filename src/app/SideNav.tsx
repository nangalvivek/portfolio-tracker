import {useLocation, useNavigate} from 'react-router-dom'
import AppsIcon from '@react-spectrum/s2/icons/Apps'
import ChartTrendIcon from '@react-spectrum/s2/icons/ChartTrend'
import BriefcaseIcon from '@react-spectrum/s2/icons/Briefcase'
import UploadIcon from '@react-spectrum/s2/icons/Upload'
import FileTextIcon from '@react-spectrum/s2/icons/FileText'
import BugIcon from '@react-spectrum/s2/icons/Bug'
import './SideNav.css'
import {useEffect, useState} from 'react'

const navItems = [
  {key: 'dashboard', label: 'Dashboard', path: '/', icon: AppsIcon},
  {key: 'portfolio', label: 'Portfolio', path: '/portfolio', icon: ChartTrendIcon},
  {key: 'accounts', label: 'Accounts', path: '/accounts', icon: BriefcaseIcon},
  {key: 'uploads', label: 'Uploads', path: '/uploads', icon: UploadIcon},
  {key: 'tax', label: 'Tax', path: '/tax', icon: FileTextIcon},
  {key: 'debug', label: 'Debug', path: '/debug', icon: BugIcon},
] as const

const useIsNarrow = (query: string): boolean => {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = (): void => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

const routeToKey = (pathname: string): string => {
  if (pathname === '/') return 'dashboard'
  if (pathname.startsWith('/portfolio')) return 'portfolio'
  if (pathname.startsWith('/accounts')) return 'accounts'
  if (pathname.startsWith('/uploads')) return 'uploads'
  if (pathname.startsWith('/tax')) return 'tax'
  if (pathname.startsWith('/debug')) return 'debug'
  return 'dashboard'
}

const keyToPath: Record<string, string> = {
  dashboard: '/',
  portfolio: '/portfolio',
  accounts: '/accounts',
  uploads: '/uploads',
  tax: '/tax',
  debug: '/debug',
}

export const SideNav = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const isNarrow = useIsNarrow('(max-width: 960px)')
  const selectedKey = routeToKey(location.pathname)

  return (
    <nav className={`side-nav-shell${isNarrow ? ' side-nav-shell--mobile' : ''}`} aria-label="Primary navigation">
      <ul className={`side-nav-list${isNarrow ? ' side-nav-list--horizontal' : ''}`}>
        {navItems.map((item) => (
          <li key={item.key} className={`side-nav-item${selectedKey === item.key ? ' side-nav-item--selected' : ''}`}>
            <button
              type="button"
              className="side-nav-item__button"
              aria-current={selectedKey === item.key ? 'page' : undefined}
              onClick={() => {
                const target = keyToPath[item.key] ?? '/'
                if (target !== location.pathname) navigate(target)
              }}
            >
              <span className="side-nav-item__content">
                <span className="side-nav-item__icon" aria-hidden="true">
                  <item.icon aria-hidden="true" />
                </span>
                <span className="side-nav-item__label">{item.label}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
