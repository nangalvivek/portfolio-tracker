import { Link, NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { Badge, Card } from '../components/Ui'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/uploads', label: 'Uploads' },
  { to: '/tax', label: 'Tax' },
  { to: '/debug', label: 'Debug' },
] as const

export const Layout = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
    <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:border-b-0 md:border-r">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-3 md:block">
          <Link to="/" className="block">
            <div className="text-lg font-semibold tracking-tight text-indigo-950">Portfolio Tracker</div>
            <div className="mt-1 text-xs text-slate-500">All data stays on this device</div>
          </Link>
          <Badge tone="indigo">offline-first</Badge>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:overflow-visible">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'rounded-xl px-3 py-2 text-sm font-medium transition md:w-full',
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <Card className="bg-slate-50">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Backup / Restore</p>
          <p className="mt-2 text-sm text-slate-600">Use the Dashboard or Tax page for exports, and Uploads for restore/import flows.</p>
          <div className="mt-3 text-xs text-slate-500">GitHub Pages ready, with hash routing.</div>
        </Card>
      </div>
    </aside>

    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Portfolio &amp; Tax Tracker</h1>
            <p className="text-sm text-slate-500">Browser-only, offline-first, single-resident investment and ITR tracker</p>
          </div>
          <Badge tone="slate">IndexedDB</Badge>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
        <Outlet />
      </main>
    </div>
  </div>
)
