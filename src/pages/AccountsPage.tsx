import {useMemo} from 'react'
import {Button, Cell, Column, Heading, Row, TableBody, TableHeader, TableView, Text} from '@react-spectrum/s2'
import {useNavigate} from 'react-router-dom'
import {usePortfolioData} from '../hooks/usePortfolioData'
import {formatMoney} from '../lib/format'
import {EmptyState, EmptyStateIllustrations, Panel, PageHeader, pageStackStyle, pageSectionGridStyle, secondaryTextStyle, toStyleString} from '../components/Ui'
import type {Account} from '../domain/types'

const brokerLabels: Record<Account['broker'], string> = {
  ZERODHA: 'Zerodha',
  IBKR: 'IBKR',
  ETRADE: 'E*Trade',
  OTHER: 'Other',
}

const regionLabels: Record<Account['region'], string> = {
  IN: 'India',
  US: 'Foreign',
}

interface AccountRowView {
  account: Account
  holdingCount: number
  currentValueInr?: number
}

export const AccountsPage = () => {
  const navigate = useNavigate()
  const {accounts, holdings} = usePortfolioData()

  const rows = useMemo<AccountRowView[]>(() => {
    return [...accounts]
      .map((account) => {
        const accountHoldings = holdings.filter((holding) => holding.accountId === account.id)
        const pricedHoldings = accountHoldings.filter((holding) => holding.currentValueInr !== undefined)
        const hasAllValues = accountHoldings.length > 0 && pricedHoldings.length === accountHoldings.length
        return {
          account,
          holdingCount: new Set(accountHoldings.map((holding) => holding.securityId)).size,
          currentValueInr: hasAllValues ? pricedHoldings.reduce((total, holding) => total + (holding.currentValueInr ?? 0), 0) : undefined,
        }
      })
      .sort((a, b) => a.account.name.localeCompare(b.account.name, 'en'))
  }, [accounts, holdings])

  const showValueColumn = rows.some((row) => row.currentValueInr !== undefined)

  return (
    <div className={pageStackStyle}>
      <PageHeader
        title="Accounts"
        subtitle="Demat and broker accounts inferred from imported tradebooks and holdings."
      />

      {accounts.length === 0 ? (
        <div className={pageSectionGridStyle}>
          <EmptyState
            title="No accounts yet"
            description="Import a tradebook or holdings file to create your demat and broker accounts automatically."
            action={<Button variant="accent" onPress={() => navigate('/uploads')}>Upload tradebook</Button>}
            illustration={<EmptyStateIllustrations.upload />}
          />
        </div>
      ) : (
        <Panel>
          <div className={pageSectionGridStyle}>
            <TableView aria-label="Demat and broker accounts" density="compact">
              <TableHeader>
                <Column isRowHeader>Account</Column>
                <Column>Broker</Column>
                <Column>Region</Column>
                <Column align="end"># Holdings</Column>
                {showValueColumn ? <Column align="end">Current value INR</Column> : null}
              </TableHeader>
              <TableBody items={rows}>
                {(row) => (
                  <Row key={row.account.id}>
                    <Cell>
                      <div>
                        <Heading level={4}>{row.account.name}</Heading>
                        <Text styles={toStyleString(secondaryTextStyle)}>{row.account.id}</Text>
                      </div>
                    </Cell>
                    <Cell>{brokerLabels[row.account.broker]}</Cell>
                    <Cell>{regionLabels[row.account.region]}</Cell>
                    <Cell>{row.holdingCount}</Cell>
                    {showValueColumn ? <Cell>{formatMoney(row.currentValueInr)}</Cell> : null}
                  </Row>
                )}
              </TableBody>
            </TableView>
          </div>
        </Panel>
      )}
    </div>
  )
}
