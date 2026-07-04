import type {ReactElement} from 'react'
import {render, screen} from '@testing-library/react'
import {Provider, defaultTheme} from '@adobe/react-spectrum'
import {MemoryRouter} from 'react-router-dom'
import {TaxYearProvider} from '../../app/TaxYearContext'
import {DashboardPage} from '../DashboardPage'
import {PortfolioPage} from '../PortfolioPage'
import {UploadsPage} from '../UploadsPage'
import {TaxPage} from '../TaxPage'
import {DebugPage} from '../DebugPage'
import {db} from '../../db/db'

afterEach(async () => {
  await Promise.all([
    db.securities.clear(),
    db.accounts.clear(),
    db.transactions.clear(),
    db.files.clear(),
    db.prices.clear(),
    db.logs.clear(),
  ])
})

const renderPage = (element: ReactElement): void => {
  render(
    <Provider theme={defaultTheme}>
      <MemoryRouter>
        <TaxYearProvider>{element}</TaxYearProvider>
      </MemoryRouter>
    </Provider>,
  )
}

describe('page smoke renders', () => {
  it('renders dashboard', () => {
    renderPage(<DashboardPage />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders portfolio', () => {
    renderPage(<PortfolioPage />)
    expect(screen.getByText('Portfolio')).toBeInTheDocument()
  })

  it('renders uploads', () => {
    renderPage(<UploadsPage />)
    expect(screen.getByText('Uploads')).toBeInTheDocument()
  })

  it('renders tax', () => {
    renderPage(<TaxPage />)
    expect(screen.getByText('Tax')).toBeInTheDocument()
  })

  it('renders debug', () => {
    renderPage(<DebugPage />)
    expect(screen.getByText('Debug')).toBeInTheDocument()
  })
})
