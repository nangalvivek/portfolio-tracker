import type { Transaction } from '../types'
import { computeHoldings, fifoTrace, realizedGains, classifyTerm } from '../fifo'

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

describe('FIFO engine', () => {
  it('classifies the India 12 month threshold correctly', () => {
    expect(classifyTerm('IN', 'EQUITY', 365)).toBe('STCG')
    expect(classifyTerm('IN', 'EQUITY', 366)).toBe('LTCG')
  })

  it('classifies the foreign 24 month threshold correctly', () => {
    expect(classifyTerm('US', 'EQUITY', 730)).toBe('STCG')
    expect(classifyTerm('US', 'EQUITY', 731)).toBe('LTCG')
  })

  it('consumes lots FIFO, handles partial sales, and leaves holdings traceable', () => {
    const txns = [
      txn({ id: 'buy-1', date: '2024-01-01', quantity: 100, price: 10 }),
      txn({ id: 'buy-2', date: '2024-02-01', quantity: 50, price: 12 }),
      txn({ id: 'sell-1', date: '2024-03-01', type: 'SELL', quantity: 120, price: 15 }),
    ]
    const gains = realizedGains(txns)
    expect(gains).toHaveLength(1)
    expect(gains[0]?.costInr).toBe(1240)
    expect(gains[0]?.proceedsInr).toBe(1800)
    expect(gains[0]?.gainInr).toBe(560)
    expect(gains[0]?.lotsConsumed).toEqual([
      {
        buyDate: '2024-01-01',
        qty: 100,
        proceedsInr: 1500,
        costInr: 1000,
        gainInr: 500,
        holdingPeriodDays: 60,
        term: 'STCG',
      },
      {
        buyDate: '2024-02-01',
        qty: 20,
        proceedsInr: 300,
        costInr: 240,
        gainInr: 60,
        holdingPeriodDays: 29,
        term: 'STCG',
      },
    ])
    expect(gains[0]?.stcgInr).toBe(560)
    expect(gains[0]?.ltcgInr).toBe(0)

    const holdings = computeHoldings(txns)
    expect(holdings[0]?.remainingQty).toBe(30)
    expect(holdings[0]?.avgCostInr).toBeCloseTo(12, 2)

    const trace = fifoTrace(txns, 'sell-1')
    expect(trace.steps).toHaveLength(2)
    expect(trace.steps[1]?.remainingLotQty).toBe(30)
    expect(trace.steps[0]?.term).toBe('STCG')
    expect(trace.steps[0]?.proceedsInr).toBe(1500)
  })

  it('handles bonus zero-cost lots', () => {
    const txns = [
      txn({ id: 'buy-1', date: '2024-01-01', quantity: 10, price: 100 }),
      txn({ id: 'bonus-1', date: '2024-02-01', type: 'BONUS', quantity: 5, price: 0 }),
      txn({ id: 'sell-1', date: '2024-03-01', type: 'SELL', quantity: 12, price: 150 }),
    ]
    const gains = realizedGains(txns)
    expect(gains[0]?.costInr).toBe(1000)
    expect(gains[0]?.gainInr).toBe(800)
    const holdings = computeHoldings(txns)
    expect(holdings[0]?.remainingQty).toBe(3)
    expect(holdings[0]?.avgCostInr).toBe(0)
  })

  it('splits a single sell across STCG and LTCG lots', () => {
    const txns = [
      txn({ id: 'buy-old', securityId: 'AAPL__US', accountId: 'IBKR__US', date: '2021-01-01', quantity: 60, price: 100, currency: 'USD', fxRate: 75 }),
      txn({ id: 'buy-new', securityId: 'AAPL__US', accountId: 'IBKR__US', date: '2024-01-01', quantity: 40, price: 120, currency: 'USD', fxRate: 75 }),
      txn({ id: 'sell-mixed', securityId: 'AAPL__US', accountId: 'IBKR__US', date: '2024-04-01', type: 'SELL', quantity: 70, price: 150, currency: 'USD', fxRate: 75 }),
    ]
    const gains = realizedGains(txns)
    expect(gains).toHaveLength(1)
    expect(gains[0]?.lotsConsumed).toHaveLength(2)
    expect(gains[0]?.stcgInr).toBeGreaterThan(0)
    expect(gains[0]?.ltcgInr).toBeGreaterThan(0)
    expect(gains[0]?.lotsConsumed[0]?.term).toBe('LTCG')
    expect(gains[0]?.lotsConsumed[1]?.term).toBe('STCG')
  })
})
