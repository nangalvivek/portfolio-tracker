import {Heading, Text, View, Flex, Button} from '@adobe/react-spectrum'
import {Outlet, useLocation, useNavigate} from 'react-router-dom'
import {SectionTitle} from '../components/Ui'

const navItems = [
  {label: 'Dashboard', path: '/'},
  {label: 'Portfolio', path: '/portfolio'},
  {label: 'Uploads', path: '/uploads'},
  {label: 'Tax', path: '/tax'},
  {label: 'Debug', path: '/debug'},
] as const

export const Layout = () => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <View padding="size-300">
          <SectionTitle title="Portfolio Tracker" subtitle="All data stays on this device" />
          <Flex direction="column" gap="size-100">
            {navItems.map((item) => {
              const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
              return (
                <Button key={item.path} variant={active ? 'accent' : 'secondary'} onPress={() => navigate(item.path)}>
                  {item.label}
                </Button>
              )
            })}
          </Flex>
        </View>
      </aside>

      <div>
        <header className="app-header">
          <View padding="size-300">
            <Heading level={1} margin={0}>Portfolio Tracker</Heading>
            <Text UNSAFE_style={{color: 'var(--spectrum-alias-text-color-secondary)'}}>Offline-first investment and Indian tax tracking. No backend, no external APIs.</Text>
          </View>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
