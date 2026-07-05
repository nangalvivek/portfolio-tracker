import type { MonthlyPrice, Transaction } from '../types'
import { endOfMonth, monthsInCalendarYear } from '../dates'
import { round2, round4 } from '../money'
import { splitSecurityId } from '../ids'

export interface FaMonthlySeriesPoint {
  month: string
  heldQty: number
  priceNative: number
  fxRate: number
  priceInr: number
  valueInr: number
}

export interface ScheduleFaRow {
  securityId: string
  country: 'United States'
  entityName: string
  natureOfAsset: 'Equity' | 'RSU'
  dateOfAcquisition: string
  initialInvestmentInr: number
  peakValueDuringYearInr: number
  closingValueInr: number
  grossIncomeInr: number
  monthlyPriceSeries: FaMonthlySeriesPoint[]
}

const isForeignSecurity = (securityId: string): boolean => splitSecurityId(securityId).region === 'US'

const securityNameFromId = (securityId: string): string => splitSecurityId(securityId).symbol

const kindForSecurity = (txns: Transaction[]): 'Equity' | 'RSU' => (txns.some((txn) => txn.type === 'VEST') ? 'RSU' : 'Equity')

const holdingQtyAtDate = (txns: Transaction[], date: string): number => {
  const positions = new Map<string, { lots: { date: string; remaining: number }[] }>()
  for (const txn of [...txns].sort((left, right) => left.date.localeCompare(right.date))) {
    if (txn.date > date) break
    const position = positions.get('x') ?? { lots: [] }
    positions.set('x', position)
    if (txn.type === 'BUY' || txn.type === 'VEST' || txn.type === 'BONUS') {
      position.lots.push({ date: txn.date, remaining: round4(txn.quantity) })
      continue
    }
    if (txn.type === 'SELL') {
      let remaining = round4(txn.quantity)
      for (const lot of position.lots) {
        if (remaining <= 0) break
        const qtyTaken = Math.min(lot.remaining, remaining)
        lot.remaining = round4(lot.remaining - qtyTaken)
        remaining = round4(remaining - qtyTaken)
      }
    }
  }
  const position = positions.get('x')
  if (!position) return 0
  return round4(position.lots.reduce((total, lot) => total + lot.remaining, 0))
}

const firstAcquisitionDate = (txns: Transaction[]): string | undefined => {
  const acquisition = txns
    .filter((txn) => txn.type === 'BUY' || txn.type === 'VEST')
    .map((txn) => txn.date)
    .sort()
  return acquisition[0]
}

const initialInvestmentInr = (txns: Transaction[]): number =>
  round2(
    txns
      .filter((txn) => txn.type === 'BUY' || txn.type === 'VEST')
      .reduce((total, txn) => total + txn.quantity * txn.price * txn.fxRate, 0),
  )

const dividendsInYear = (txns: Transaction[], year: number): number =>
  round2(
    txns
      .filter((txn) => txn.type === 'DIVIDEND' && txn.date.startsWith(`${year}-`))
      .reduce((total, txn) => total + txn.quantity * txn.price * txn.fxRate, 0),
  )

export const scheduleFa = (txns: Transaction[], prices: MonthlyPrice[], year: number): ScheduleFaRow[] => {
  const bySecurity = new Map<string, Transaction[]>()
  for (const txn of txns) {
    const list = bySecurity.get(txn.securityId) ?? []
    list.push(txn)
    bySecurity.set(txn.securityId, list)
  }

  const priceLookup = new Map<string, MonthlyPrice>()
  for (const price of prices) {
    priceLookup.set(`${price.securityId}:${price.month}`, price)
  }

  return [...bySecurity.entries()]
    .filter(([securityId, securityTxns]) => isForeignSecurity(securityId) && securityTxns.some((txn) => txn.date.startsWith(`${year}-`)))
    .map(([securityId, securityTxns]) => {
      const monthlyPriceSeries = monthsInCalendarYear(year).map((month) => {
        const price = priceLookup.get(`${securityId}:${month}`)
        const heldQty = holdingQtyAtDate(securityTxns, endOfMonth(month))
        const priceNative = price?.price ?? 0
        const fxRate = price?.fxRate ?? 1
        const priceInr = round2(priceNative * fxRate)
        const valueInr = round2(heldQty * priceInr)
        return { month, heldQty, priceNative, fxRate, priceInr, valueInr }
      })
      const peakValueDuringYearInr = round2(Math.max(0, ...monthlyPriceSeries.map((point) => point.valueInr)))
      const closingValueInr = monthlyPriceSeries[11]?.valueInr ?? 0
      const entityName = securityNameFromId(securityId)
      const natureOfAsset = kindForSecurity(securityTxns)
      return {
        securityId,
        country: 'United States',
        entityName,
        natureOfAsset,
        dateOfAcquisition: firstAcquisitionDate(securityTxns) ?? `${year}-01-01`,
        initialInvestmentInr: initialInvestmentInr(securityTxns),
        peakValueDuringYearInr,
        closingValueInr,
        grossIncomeInr: dividendsInYear(securityTxns, year),
        monthlyPriceSeries,
      }
    })
}
