import { fyOf } from '../dates'
import { realizedGains } from '../fifo'
import type { Transaction } from '../types'
import { round2 } from '../money'
import { splitSecurityId } from '../ids'

export interface ScheduleCgRow {
  securityId: string
  accountId: string
  sellDate: string
  sellQuantity: number
  proceedsInr: number
  costInr: number
  gainInr: number
  stcgInr: number
  ltcgInr: number
  holdingPeriodDays: number
  term: 'STCG' | 'LTCG'
  region: 'IN' | 'US'
  country: string
  fy: string
}

export interface ScheduleCgTotals {
  stcgIndia: number
  ltcgIndia: number
  stcgForeign: number
  ltcgForeign: number
  totalGain: number
}

export interface ScheduleCgResult {
  rows: ScheduleCgRow[]
  totals: ScheduleCgTotals
}

const countryForRegion = (region: 'IN' | 'US'): string => (region === 'US' ? 'United States' : 'India')

export const scheduleCg = (txns: Transaction[], fy: string): ScheduleCgResult => {
  const rows: ScheduleCgRow[] = realizedGains(txns)
    .filter((row) => fyOf(row.sellDate) === fy)
    .map((row) => {
      const { region } = splitSecurityId(row.securityId)
      const effectiveRegion = region === 'US' ? 'US' : 'IN'
      return {
        ...row,
        region: effectiveRegion,
        country: countryForRegion(effectiveRegion),
        fy,
      }
    })

  const totals: ScheduleCgTotals = {
    stcgIndia: 0,
    ltcgIndia: 0,
    stcgForeign: 0,
    ltcgForeign: 0,
    totalGain: 0,
  }

  for (const row of rows) {
    totals.totalGain = round2(totals.totalGain + row.gainInr)
    if (row.region === 'IN') {
      totals.stcgIndia = round2(totals.stcgIndia + row.stcgInr)
      totals.ltcgIndia = round2(totals.ltcgIndia + row.ltcgInr)
    }
    if (row.region === 'US') {
      totals.stcgForeign = round2(totals.stcgForeign + row.stcgInr)
      totals.ltcgForeign = round2(totals.ltcgForeign + row.ltcgInr)
    }
  }

  return { rows, totals }
}
