import type { Transaction } from '../types'
import { scheduleCg } from '../tax/cg'
import { realizedGains } from '../fifo'

const txn = (overrides: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(),
  securityId: 'ABC__IN',
  accountId: 'ZERODHA__IN',
  date: '2024-04-01',
  type: 'BUY',
  quantity: 1,
  price: 1,
  currency: 'INR',
  fxRate: 1,
  grossAmountNative: 1,
  grossAmountInr: 1,
  dedupeHash: 'hash',
  sourceFileIds: ['file'],
  rawRowRefs: [],
  ...overrides,
})

describe('capital gains schedule', () => {
  it('buckets by FY and splits India vs foreign gains', () => {
    const txns = [
      txn({ id: 'buy-in', securityId: 'INFY__IN', date: '2023-04-02', quantity: 10, price: 100 }),
      txn({ id: 'sell-in', securityId: 'INFY__IN', date: '2024-04-01', type: 'SELL', quantity: 10, price: 130 }),
      txn({ id: 'buy-us-old', securityId: 'AAPL__US', accountId: 'IBKR__US', date: '2021-01-01', quantity: 6, price: 20, currency: 'USD', fxRate: 80 }),
      txn({ id: 'buy-us-new', securityId: 'AAPL__US', accountId: 'IBKR__US', date: '2024-01-01', quantity: 4, price: 24, currency: 'USD', fxRate: 80 }),
      txn({ id: 'sell-us', securityId: 'AAPL__US', accountId: 'IBKR__US', date: '2024-04-02', type: 'SELL', quantity: 7, price: 30, currency: 'USD', fxRate: 80 }),
    ]

    const realized = realizedGains(txns)
    expect(realized[1]?.stcgInr).toBeGreaterThan(0)
    expect(realized[1]?.ltcgInr).toBeGreaterThan(0)

    const fyResult = scheduleCg(txns, 'FY2024-25')
    expect(fyResult.rows).toHaveLength(2)
    expect(fyResult.rows.find((row) => row.country === 'India')?.term).toBe('STCG')
    expect(fyResult.rows.find((row) => row.country === 'United States')?.stcgInr).toBeGreaterThan(0)
    expect(fyResult.rows.find((row) => row.country === 'United States')?.ltcgInr).toBeGreaterThan(0)
    expect(fyResult.totals.stcgIndia).toBe(300)
    expect(fyResult.totals.stcgForeign).toBeGreaterThan(0)
    expect(fyResult.totals.ltcgForeign).toBeGreaterThan(0)
    expect(fyResult.totals.totalGain).toBeGreaterThan(300)
  })
})
