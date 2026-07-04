import { fyOf } from '../dates'
import type { MonthlyPrice, Transaction } from '../types'
import { scheduleCg } from '../tax/cg'
import { scheduleFa } from '../tax/fa'
import { scheduleFsi } from '../tax/fsi'
import { scheduleTr } from '../tax/tr'

export interface ItrBundle {
  generatedAt: string
  calendarYear: number
  financialYear: string
  fa: ReturnType<typeof scheduleFa>
  fsi: ReturnType<typeof scheduleFsi>
  tr: ReturnType<typeof scheduleTr>
  cg: ReturnType<typeof scheduleCg>
}

export const buildItrBundle = (txns: Transaction[], prices: MonthlyPrice[], year: number): ItrBundle => {
  const financialYear = fyOf(`${year}-04-01`)
  const fsi = scheduleFsi(txns, year)
  return {
    generatedAt: new Date().toISOString(),
    calendarYear: year,
    financialYear,
    fa: scheduleFa(txns, prices, year),
    fsi,
    tr: scheduleTr(fsi),
    cg: scheduleCg(txns, financialYear),
  }
}
