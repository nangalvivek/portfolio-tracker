import { db } from '../../db/db'
import { importTransactions } from '../dedupe'
import type { ImportCandidate } from '../dedupe'

const clearDb = async () => {
  await Promise.all([
    db.securities.clear(),
    db.accounts.clear(),
    db.transactions.clear(),
    db.files.clear(),
    db.prices.clear(),
    db.logs.clear(),
  ])
}

const candidate = (overrides: Partial<ImportCandidate> = {}): ImportCandidate => ({
  sourceFileId: 'file-a',
  rawRow: { lineNumber: 2, rawText: 'raw row' },
  securityId: 'INFY__IN',
  accountId: 'ZERODHA__IN',
  date: '2024-04-01',
  type: 'BUY',
  quantity: 10,
  price: 100,
  currency: 'INR',
  fxRate: 1,
  ...overrides,
})

describe('dedupe engine', () => {
  beforeEach(async () => {
    await clearDb()
  })

  it('inserts new rows, links duplicates across files, and records errors', async () => {
    const first = await importTransactions([candidate()])
    expect(first.counts).toEqual({ new: 1, duplicate: 0, error: 0, processed: 1 })
    expect(first.rows[0]?.status).toBe('NEW')

    const duplicate = await importTransactions([
      candidate({ sourceFileId: 'file-b', rawRow: { lineNumber: 7, rawText: 'same row from another file' } }),
    ])
    expect(duplicate.counts).toEqual({ new: 0, duplicate: 1, error: 0, processed: 1 })
    expect(duplicate.rows[0]?.status).toBe('DUPLICATE')

    const stored = await db.transactions.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]?.sourceFileIds).toEqual(['file-a', 'file-b'])
    expect(stored[0]?.rawRowRefs).toHaveLength(2)

    const bad = await importTransactions([
      candidate({ quantity: 0, rawRow: { lineNumber: 11, rawText: 'bad row' } }),
    ])
    expect(bad.counts.error).toBe(1)
    expect(bad.rows[0]?.reason).toMatch(/quantity must be positive/)
  })
})
