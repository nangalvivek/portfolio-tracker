import { createContext, useContext } from 'react'

export interface TaxYearContextValue {
  taxYear: number
  setTaxYear: (year: number) => void
}

export const taxYearStorageKey = 'portfolio-tracker.taxYear'

export const TaxYearContext = createContext<TaxYearContextValue | null>(null)

export const useTaxYear = (): TaxYearContextValue => {
  const context = useContext(TaxYearContext)
  if (!context) throw new Error('useTaxYear must be used within TaxYearProvider')
  return context
}
