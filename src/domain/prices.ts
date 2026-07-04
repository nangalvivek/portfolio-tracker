import Papa from 'papaparse'
import { round2, round4 } from './money'
import type { Currency, MonthlyPrice, Transaction } from './types'
import { monthsInCalendarYear } from './dates'
import { makeSecurityId, splitSecurityId } from './ids'

export interface ParsedMonthlyPriceRow {
  securityId: string
  month: string
  price: number
  currency: Currency
  fxRate: number
}

const normalizeHeader = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')

const pick = (row: Record<string, string | undefined>, aliases: readonly string[]): string | undefined => {
  for (const [key, value] of Object.entries(row)) {
    if (aliases.includes(normalizeHeader(key)) && value && value.trim()) return value.trim()
  }
  return undefined
}

const parseNumber = (value: string | undefined): number | undefined => {
  if (!value) return undefined
  const parsed = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

const normalizeMonth = (value: string): string => {
  if (/^\d{4}-\d{2}$/.test(value)) return value
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid month/date: ${value}`)
  return date.toISOString().slice(0, 7)
}

export const parseMonthlyPricesCsv = (csvText: string): { rows: ParsedMonthlyPriceRow[]; errors: string[] } => {
  const result = Papa.parse<Record<string, string | undefined>>(csvText, { header: true, skipEmptyLines: 'greedy' })
  const rows: ParsedMonthlyPriceRow[] = []
  const errors: string[] = result.errors.map((error) => error.message)

  for (const row of result.data) {
    if (Object.keys(row).length === 0) continue
    const symbol = pick(row, ['security', 'symbol', 'ticker'])
    const monthValue = pick(row, ['month', 'date'])
    const price = parseNumber(pick(row, ['price']))
    const currency = ((pick(row, ['currency']) ?? 'INR').toUpperCase() === 'USD' ? 'USD' : 'INR') as Currency
    const fxRate = parseNumber(pick(row, ['fxrate'])) ?? (currency === 'INR' ? 1 : 1)
    if (!symbol || !monthValue || price === undefined) {
      errors.push('missing monthly price columns')
      continue
    }
    const parsedSecurity = splitSecurityId(symbol)
    const region = parsedSecurity.region === 'UNKNOWN' ? (currency === 'USD' ? 'US' : 'IN') : parsedSecurity.region
    rows.push({
      securityId: makeSecurityId(parsedSecurity.symbol, region),
      month: normalizeMonth(monthValue),
      price: round4(price),
      currency,
      fxRate: round4(fxRate),
    })
  }

  return { rows, errors }
}

export const latestMonthlyPrice = (prices: MonthlyPrice[], securityId: string): MonthlyPrice | undefined =>
  [...prices]
    .filter((price) => price.securityId === securityId)
    .sort((left, right) => left.month.localeCompare(right.month))
    .at(-1)

export const priceInInr = (price?: MonthlyPrice): number | undefined => (price ? round2(price.price * price.fxRate) : undefined)

export const missingMonthsForSecurity = (transactions: Transaction[], priceMonths: string[], securityId: string, currentYear: number): string[] => {
  const heldMonths = monthsInCalendarYear(currentYear)
  const activityMonths = new Set(
    transactions
      .filter((txn) => txn.securityId === securityId)
      .map((txn) => txn.date.slice(0, 7)),
  )
  return heldMonths.filter((month) => activityMonths.size > 0 && !priceMonths.includes(month) && month >= [...activityMonths][0]!)
}
