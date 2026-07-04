import { round2, round4 } from './money'
import type { AssetKind, Region, Transaction } from './types'
import { splitSecurityId } from './ids'

export interface HoldingLot {
  date: string
  quantity: number
  costPerUnitInr: number
  remaining: number
}

export interface HoldingRow {
  securityId: string
  accountId: string
  remainingQty: number
  avgCostInr: number
  openLots: HoldingLot[]
}

export interface RealizedLotConsumption {
  buyDate: string
  qty: number
  proceedsInr: number
  costInr: number
  gainInr: number
  holdingPeriodDays: number
  term: 'STCG' | 'LTCG'
}

export interface RealizedGainRow {
  securityId: string
  accountId: string
  sellDate: string
  sellQuantity: number
  proceedsInr: number
  costInr: number
  gainInr: number
  stcgInr: number
  ltcgInr: number
  lotsConsumed: RealizedLotConsumption[]
  holdingPeriodDays: number
  term: 'STCG' | 'LTCG'
}

export interface FifoTraceStep {
  buyDate: string
  qtyTaken: number
  costPerUnitInr: number
  costInr: number
  proceedsInr: number
  holdingPeriodDays: number
  term: 'STCG' | 'LTCG'
  remainingLotQty: number
}

export interface FifoTraceResult {
  sellTxn?: Transaction
  steps: FifoTraceStep[]
}

interface FifoLot extends HoldingLot {}
interface FifoPosition {
  key: string
  securityId: string
  accountId: string
  lots: FifoLot[]
}

const positionKey = (securityId: string, accountId: string): string => `${securityId}::${accountId}`

const daysBetween = (start: string, end: string): number => {
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  return Math.floor((endMs - startMs) / 86_400_000)
}

const inferKind = (txns: Transaction[]): AssetKind => (txns.some((txn) => txn.type === 'VEST') ? 'RSU' : 'EQUITY')

const inferKindForSecurity = (txns: Transaction[], securityId: string, accountId: string): AssetKind =>
  inferKind(txns.filter((txn) => txn.securityId === securityId && txn.accountId === accountId))

const inferRegion = (securityId: string): Region => {
  const { region } = splitSecurityId(securityId)
  return region === 'UNKNOWN' ? 'IN' : region
}

/** India capital-gains holding-period thresholds: listed Indian equity/equity-MF LTCG after >12 months; foreign equity/RSU LTCG after >24 months. */
export const classifyTerm = (region: Region, kind: AssetKind, holdingPeriodDays: number): 'STCG' | 'LTCG' => {
  const thresholdDays = region === 'IN' && (kind === 'EQUITY' || kind === 'MF') ? 365 : 730
  return holdingPeriodDays > thresholdDays ? 'LTCG' : 'STCG'
}

const sortTxns = (txns: Transaction[]): Transaction[] =>
  [...txns]
    .map((txn, index) => ({ txn, index }))
    .sort((left, right) => {
      const dateOrder = left.txn.date.localeCompare(right.txn.date)
      if (dateOrder !== 0) return dateOrder
      return left.index - right.index
    })
    .map(({ txn }) => txn)

const addLot = (position: FifoPosition, lot: FifoLot): void => {
  position.lots.push(lot)
}

const consumeLots = (
  position: FifoPosition,
  sellTxn: Transaction,
  region: Region,
  kind: AssetKind,
): {
  consumed: RealizedLotConsumption[]
  costInr: number
  proceedsInr: number
  stcgInr: number
  ltcgInr: number
  earliestBuyDate?: string
} => {
  let remainingToSell = round4(sellTxn.quantity)
  const consumed: RealizedLotConsumption[] = []
  let costInr = 0
  let proceedsInr = 0
  let stcgInr = 0
  let ltcgInr = 0
  let earliestBuyDate: string | undefined
  const sellPriceInrPerUnit = round2(sellTxn.price * sellTxn.fxRate)
  const totalSellProceedsInr = round2(sellTxn.quantity * sellPriceInrPerUnit)

  for (const [index, lot] of position.lots.entries()) {
    if (remainingToSell <= 0) break
    if (lot.remaining <= 0) continue

    const qtyTaken = Math.min(lot.remaining, remainingToSell)
    lot.remaining = round4(lot.remaining - qtyTaken)
    remainingToSell = round4(remainingToSell - qtyTaken)

    const lotCostInr = round2(qtyTaken * lot.costPerUnitInr)
    const lotProceedsInr =
      remainingToSell <= 0
        ? round2(totalSellProceedsInr - proceedsInr)
        : round2(qtyTaken * sellPriceInrPerUnit)
    const holdingPeriodDays = daysBetween(lot.date, sellTxn.date)
    const term = classifyTerm(region, kind, holdingPeriodDays)
    const lotGainInr = round2(lotProceedsInr - lotCostInr)

    costInr = round2(costInr + lotCostInr)
    proceedsInr = round2(proceedsInr + lotProceedsInr)
    if (term === 'STCG') stcgInr = round2(stcgInr + lotGainInr)
    if (term === 'LTCG') ltcgInr = round2(ltcgInr + lotGainInr)

    consumed.push({
      buyDate: lot.date,
      qty: round4(qtyTaken),
      proceedsInr: lotProceedsInr,
      costInr: lotCostInr,
      gainInr: lotGainInr,
      holdingPeriodDays,
      term,
    })

    if (!earliestBuyDate || lot.date < earliestBuyDate) earliestBuyDate = lot.date
    void index
  }

  return { consumed, costInr, proceedsInr, stcgInr, ltcgInr, earliestBuyDate }
}

const positionFromTxns = (txns: Transaction[]): Map<string, FifoPosition> => {
  const positions = new Map<string, FifoPosition>()
  for (const txn of sortTxns(txns)) {
    const key = positionKey(txn.securityId, txn.accountId)
    const position = positions.get(key) ?? { key, securityId: txn.securityId, accountId: txn.accountId, lots: [] }
    positions.set(key, position)

    if (txn.type === 'BUY' || txn.type === 'VEST' || txn.type === 'BONUS') {
      const costPerUnitInr = txn.type === 'BONUS' ? 0 : round2(txn.price * txn.fxRate)
      addLot(position, {
        date: txn.date,
        quantity: round4(txn.quantity),
        costPerUnitInr,
        remaining: round4(txn.quantity),
      })
      continue
    }

    if (txn.type === 'SPLIT') {
      continue
    }

    if (txn.type === 'SELL') {
      const region = inferRegion(txn.securityId)
      const kind = inferKindForSecurity(txns, txn.securityId, txn.accountId)
      consumeLots(position, txn, region, kind)
    }
  }
  return positions
}

const holdingFromPosition = (position: FifoPosition): HoldingRow | null => {
  const openLots = position.lots.filter((lot) => lot.remaining > 0)
  const remainingQty = round4(openLots.reduce((total, lot) => total + lot.remaining, 0))
  if (remainingQty <= 0) return null
  const totalCost = round2(openLots.reduce((total, lot) => total + lot.remaining * lot.costPerUnitInr, 0))
  return {
    securityId: position.securityId,
    accountId: position.accountId,
    remainingQty,
    avgCostInr: round2(totalCost / remainingQty),
    openLots: openLots.map((lot) => ({ ...lot })),
  }
}

export const computeHoldings = (txns: Transaction[]): HoldingRow[] =>
  Array.from(positionFromTxns(txns).values())
    .map(holdingFromPosition)
    .filter((holding): holding is HoldingRow => holding !== null)

export const realizedGains = (txns: Transaction[]): RealizedGainRow[] => {
  const results: RealizedGainRow[] = []
  const positions = new Map<string, FifoPosition>()

  for (const txn of sortTxns(txns)) {
    const key = positionKey(txn.securityId, txn.accountId)
    const position = positions.get(key) ?? { key, securityId: txn.securityId, accountId: txn.accountId, lots: [] }
    positions.set(key, position)

    if (txn.type === 'BUY' || txn.type === 'VEST' || txn.type === 'BONUS') {
      const costPerUnitInr = txn.type === 'BONUS' ? 0 : round2(txn.price * txn.fxRate)
      position.lots.push({ date: txn.date, quantity: round4(txn.quantity), costPerUnitInr, remaining: round4(txn.quantity) })
      continue
    }

    if (txn.type === 'SPLIT') {
      continue
    }

    if (txn.type !== 'SELL') continue

    const region = inferRegion(txn.securityId)
    const kind = inferKindForSecurity(txns, txn.securityId, txn.accountId)
    const { consumed, costInr, proceedsInr, stcgInr, ltcgInr, earliestBuyDate } = consumeLots(position, txn, region, kind)
    const gainInr = round2(proceedsInr - costInr)
    const holdingPeriodDays = earliestBuyDate ? daysBetween(earliestBuyDate, txn.date) : 0
    const term = consumed.every((lot) => lot.term === 'LTCG')
      ? 'LTCG'
      : consumed.every((lot) => lot.term === 'STCG')
        ? 'STCG'
        : consumed[0]?.term ?? classifyTerm(region, kind, holdingPeriodDays)

    results.push({
      securityId: txn.securityId,
      accountId: txn.accountId,
      sellDate: txn.date,
      sellQuantity: round4(txn.quantity),
      proceedsInr,
      costInr,
      gainInr,
      stcgInr,
      ltcgInr,
      lotsConsumed: consumed,
      holdingPeriodDays,
      term,
    })
  }

  return results
}

export const fifoTrace = (txns: Transaction[], sellTxnId: string): FifoTraceResult => {
  const sorted = sortTxns(txns)
  const targetIndex = sorted.findIndex((txn) => txn.id === sellTxnId)
  const target = targetIndex >= 0 ? sorted[targetIndex] : undefined
  if (!target) return { steps: [] }
  const position = { key: positionKey(target.securityId, target.accountId), securityId: target.securityId, accountId: target.accountId, lots: [] as FifoLot[] }

  for (let index = 0; index < targetIndex; index += 1) {
    const txn = sorted[index]
    if (txn.securityId !== target.securityId || txn.accountId !== target.accountId) continue
    if (txn.type === 'BUY' || txn.type === 'VEST' || txn.type === 'BONUS') {
      position.lots.push({ date: txn.date, quantity: round4(txn.quantity), costPerUnitInr: txn.type === 'BONUS' ? 0 : round2(txn.price * txn.fxRate), remaining: round4(txn.quantity) })
    }
  }

  const steps: FifoTraceStep[] = []
  let remaining = round4(target.quantity)
  const sellPriceInrPerUnit = round2(target.price * target.fxRate)
  const region = inferRegion(target.securityId)
  const kind = inferKindForSecurity(sorted, target.securityId, target.accountId)

  for (const lot of position.lots) {
    if (remaining <= 0) break
    const qtyTaken = Math.min(lot.remaining, remaining)
    const costInr = round2(qtyTaken * lot.costPerUnitInr)
    const proceedsInr = round2(qtyTaken * sellPriceInrPerUnit)
    const holdingPeriodDays = daysBetween(lot.date, target.date)
    const term = classifyTerm(region, kind, holdingPeriodDays)
    steps.push({
      buyDate: lot.date,
      qtyTaken: round4(qtyTaken),
      costPerUnitInr: lot.costPerUnitInr,
      costInr,
      proceedsInr,
      holdingPeriodDays,
      term,
      remainingLotQty: round4(lot.remaining - qtyTaken),
    })
    remaining = round4(remaining - qtyTaken)
  }

  return { sellTxn: target, steps }
}
