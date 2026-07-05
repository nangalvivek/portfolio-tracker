import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { computeHoldings, realizedGains } from '../domain/fifo'
import { latestMonthlyPrice, priceInInr } from '../domain/prices'
import { splitSecurityId } from '../domain/ids'
import type { Account, ImportedFile, LogEntry, MonthlyPrice, Security, Transaction } from '../domain/types'

export interface HoldingView {
  security: Security | undefined
  account: Account | undefined
  securityId: string
  accountId: string
  region: 'IN' | 'US'
  quantity: number
  averageCostInr: number
  currentPriceInr?: number
  currentValueInr?: number
  costBasisInr: number
  unrealizedPnlInr?: number
  unpriced: boolean
  openLots: Array<{ date: string; quantity: number; costPerUnitInr: number; remaining: number }>
}

export interface PortfolioSnapshot {
  securities: Security[]
  accounts: Account[]
  transactions: Transaction[]
  files: ImportedFile[]
  prices: MonthlyPrice[]
  logs: LogEntry[]
  securityById: Map<string, Security>
  accountById: Map<string, Account>
  holdings: HoldingView[]
  realizedGains: ReturnType<typeof realizedGains>
  latestPriceBySecurityId: Map<string, MonthlyPrice>
}

const emptyArray: [] = []

export const usePortfolioData = (): PortfolioSnapshot => {
  const securities = useLiveQuery(() => db.securities.toArray(), [], emptyArray) as Security[]
  const accounts = useLiveQuery(() => db.accounts.toArray(), [], emptyArray) as Account[]
  const transactions = useLiveQuery(() => db.transactions.toArray(), [], emptyArray) as Transaction[]
  const files = useLiveQuery(() => db.files.orderBy('importedAt').reverse().toArray(), [], emptyArray) as ImportedFile[]
  const prices = useLiveQuery(() => db.prices.toArray(), [], emptyArray) as MonthlyPrice[]
  const logs = useLiveQuery(() => db.logs.orderBy('ts').reverse().toArray(), [], emptyArray) as LogEntry[]

  const securityById = useMemo(() => new Map(securities.map((security) => [security.id, security])), [securities])
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const latestPriceBySecurityId = useMemo(() => {
    const map = new Map<string, MonthlyPrice>()
    for (const security of securities) {
      const latest = latestMonthlyPrice(prices, security.id)
      if (latest) map.set(security.id, latest)
    }
    return map
  }, [prices, securities])

  const holdings = useMemo(() => {
    const currentHoldings = computeHoldings(transactions)
    return currentHoldings.map<HoldingView>((holding) => {
      const security = securityById.get(holding.securityId)
      const account = accountById.get(holding.accountId)
      const region = splitSecurityId(holding.securityId).region === 'US' ? 'US' : 'IN'
      const latestPrice = latestPriceBySecurityId.get(holding.securityId)
      const currentPriceInr = priceInInr(latestPrice)
      const currentValueInr = currentPriceInr === undefined ? undefined : currentPriceInr * holding.remainingQty
      const costBasisInr = holding.remainingQty * holding.avgCostInr
      const unrealizedPnlInr = currentValueInr === undefined ? undefined : currentValueInr - costBasisInr
      return {
        security,
        account,
        securityId: holding.securityId,
        accountId: holding.accountId,
        region,
        quantity: holding.remainingQty,
        averageCostInr: holding.avgCostInr,
        currentPriceInr,
        currentValueInr,
        costBasisInr,
        unrealizedPnlInr,
        unpriced: currentPriceInr === undefined,
        openLots: holding.openLots,
      }
    })
  }, [accountById, latestPriceBySecurityId, securityById, transactions])

  const realized = useMemo(() => realizedGains(transactions), [transactions])

  return {
    securities,
    accounts,
    transactions,
    files,
    prices,
    logs,
    securityById,
    accountById,
    holdings,
    realizedGains: realized,
    latestPriceBySecurityId,
  }
}
