import type { Transaction } from '../types'
import { round2 } from '../money'
import { splitSecurityId } from '../ids'

export interface ScheduleFsiRow {
  country: string
  incomeInr: number
  taxPaidAbroadInr: number
  dtaaArticle: string
  securityIds: string[]
}

const countryForSecurity = (securityId: string): string => {
  const { region } = splitSecurityId(securityId)
  return region === 'US' ? 'United States' : 'India'
}

const dtaaArticleForDividend = (country: string): string => {
  if (country === 'United States') return 'Article 10'
  return 'N/A'
}

export const scheduleFsi = (txns: Transaction[], year: number): ScheduleFsiRow[] => {
  const rows = new Map<string, ScheduleFsiRow>()
  for (const txn of txns) {
    if (txn.type !== 'DIVIDEND' || !txn.date.startsWith(`${year}-`)) continue
    const country = countryForSecurity(txn.securityId)
    const existing = rows.get(country) ?? {
      country,
      incomeInr: 0,
      taxPaidAbroadInr: 0,
      dtaaArticle: dtaaArticleForDividend(country),
      securityIds: [],
    }
    existing.incomeInr = round2(existing.incomeInr + txn.quantity * txn.price * txn.fxRate)
    existing.taxPaidAbroadInr = round2(existing.taxPaidAbroadInr + (txn.foreignTaxPaid ?? 0))
    existing.securityIds = Array.from(new Set([...existing.securityIds, txn.securityId]))
    rows.set(country, existing)
  }
  return [...rows.values()]
}
