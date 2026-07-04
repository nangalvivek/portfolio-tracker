import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { TaxYearProvider } from './TaxYearContext'
import { DashboardPage } from '../pages/DashboardPage'
import { PortfolioPage } from '../pages/PortfolioPage'
import { UploadsPage } from '../pages/UploadsPage'
import { TaxPage } from '../pages/TaxPage'
import { DebugPage } from '../pages/DebugPage'

export const App = () => (
  <TaxYearProvider>
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="uploads" element={<UploadsPage />} />
          <Route path="tax" element={<TaxPage />} />
          <Route path="debug" element={<DebugPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </TaxYearProvider>
)

export default App
