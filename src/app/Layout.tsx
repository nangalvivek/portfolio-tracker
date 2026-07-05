import {Outlet} from 'react-router-dom'
import {TopBar} from './TopBar'
import {SideNav} from './SideNav'

export const Layout = () => {
  return (
    <div className="app-layout">
      <TopBar />
      <div className="app-layout__body">
        <SideNav />
        <div className="app-layout__main">
          <main className="app-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
