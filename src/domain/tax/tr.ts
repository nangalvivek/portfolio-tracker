import type { ScheduleFsiRow } from './fsi'
import { round2 } from '../money'

export interface ScheduleTrRow {
  country: string
  foreignTaxPaidInr: number
  reliefClaimedInr: number
}

export const scheduleTr = (fsiRows: ScheduleFsiRow[]): ScheduleTrRow[] =>
  fsiRows.map((row) => ({
    country: row.country,
    foreignTaxPaidInr: round2(row.taxPaidAbroadInr),
    reliefClaimedInr: round2(row.taxPaidAbroadInr),
  }))
