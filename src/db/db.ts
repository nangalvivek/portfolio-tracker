import Dexie, { type Table } from 'dexie'
import type { Account, ImportedFile, LogEntry, MonthlyPrice, Security, Transaction } from '../domain/types'

class PortfolioTrackerDb extends Dexie {
  securities!: Table<Security, string>
  accounts!: Table<Account, string>
  transactions!: Table<Transaction, string>
  files!: Table<ImportedFile, string>
  prices!: Table<MonthlyPrice, string>
  logs!: Table<LogEntry, string>

  constructor() {
    super('portfolio-tracker')
    this.version(1).stores({
      securities: 'id, symbol, region, isin, kind',
      accounts: 'id, name, broker, region',
      transactions: 'id, securityId, accountId, date, type, dedupeHash, *sourceFileIds',
      files: 'id, importedAt',
      prices: 'id, securityId, month, [securityId+month]',
      logs: 'id, ts, category',
    })
  }
}

export const db = new PortfolioTrackerDb()

export const log = async (
  category: LogEntry['category'],
  message: string,
  detail?: LogEntry['detail'],
): Promise<string> => {
  const id = crypto.randomUUID()
  await db.logs.add({
    id,
    ts: new Date().toISOString(),
    category,
    message,
    detail,
  })
  return id
}
