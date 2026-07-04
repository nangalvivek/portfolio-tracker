import type { Account, ImportedFile, MonthlyPrice, Security, Transaction, LogEntry } from '../types'
import { db } from '../../db/db'

export interface BackupExport {
  version: 1
  exportedAt: string
  securities: Security[]
  accounts: Account[]
  transactions: Transaction[]
  prices: MonthlyPrice[]
  files: Array<Omit<ImportedFile, 'originalBlob'>>
  logs: LogEntry[]
}

export const toJson = <T>(value: T): string => JSON.stringify(value, null, 2)

export const toCsv = (rows: readonly Record<string, unknown>[]): string => {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const serialize = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return JSON.stringify(value)
  }
  const escape = (value: string): string => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => escape(serialize(row[header]))).join(','))
  }
  return lines.join('\n')
}

export const exportBackup = async (): Promise<BackupExport> => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  securities: await db.securities.toArray(),
  accounts: await db.accounts.toArray(),
  transactions: await db.transactions.toArray(),
  prices: await db.prices.toArray(),
  files: (await db.files.toArray()).map(({ originalBlob: _originalBlob, ...rest }) => rest),
  logs: await db.logs.toArray(),
})

export const restoreBackup = async (backup: BackupExport): Promise<void> => {
  await db.transaction('rw', [db.securities, db.accounts, db.transactions, db.prices, db.files, db.logs], async () => {
    await Promise.all([
      db.securities.clear(),
      db.accounts.clear(),
      db.transactions.clear(),
      db.prices.clear(),
      db.files.clear(),
      db.logs.clear(),
    ])
    await db.securities.bulkPut(backup.securities)
    await db.accounts.bulkPut(backup.accounts)
    await db.transactions.bulkPut(backup.transactions)
    await db.prices.bulkPut(backup.prices)
    await db.files.bulkPut(backup.files as Array<ImportedFile>)
    await db.logs.bulkPut(backup.logs)
  })
}
