import type { MonthlyPrice, Transaction } from '../types'
import { scheduleFa } from '../tax/fa'

const txn = (overrides: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(),
  securityId: 'ABC__US',
  accountId: 'IBKR__US',
  date: '2024-01-01',
  type: 'BUY',
  quantity: 1,
  price: 1,
  currency: 'USD',
  fxRate: 80,
  grossAmountNative: 1,
  grossAmountInr: 80,
  dedupeHash: 'hash',
  sourceFileIds: ['file'],
  rawRowRefs: [],
  ...overrides,
})

describe('Schedule FA', () => {
  it('computes peak using monthly prices and exposes the price series', () => {
    const txns = [
      txn({ id: 'buy-1', date: '2024-01-15', quantity: 10, price: 10, fxRate: 80 }),
      txn({ id: 'div-1', date: '2024-06-15', type: 'DIVIDEND', quantity: 10, price: 1, fxRate: 80 }),
    ]
    const prices: MonthlyPrice[] = [
      { id: 'p-jan', securityId: 'ABC__US', month: '2024-01', price: 12, currency: 'USD', fxRate: 80, source: 'MANUAL' },
      { id: 'p-feb', securityId: 'ABC__US', month: '2024-02', price: 20, currency: 'USD', fxRate: 80, source: 'MANUAL' },
      { id: 'p-dec', securityId: 'ABC__US', month: '2024-12', price: 11, currency: 'USD', fxRate: 80, source: 'MANUAL' },
    ]

    const rows = scheduleFa(txns, prices, 2024)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.peakValueDuringYearInr).toBe(16000)
    expect(rows[0]?.closingValueInr).toBe(8800)
    expect(rows[0]?.grossIncomeInr).toBe(800)
    expect(rows[0]?.monthlyPriceSeries).toHaveLength(12)
    expect(rows[0]?.monthlyPriceSeries[1]?.valueInr).toBe(16000)
  })
})
