import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TaxYearContext, taxYearStorageKey, type TaxYearContextValue } from './taxYearContext'

const readStoredYear = (): number => {
  const stored = window.localStorage.getItem(taxYearStorageKey)
  const parsed = stored ? Number(stored) : NaN
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear()
}

export const TaxYearProvider = ({ children }: { children: ReactNode }) => {
  const [taxYear, setTaxYearState] = useState<number>(() => readStoredYear())

  useEffect(() => {
    window.localStorage.setItem(taxYearStorageKey, String(taxYear))
  }, [taxYear])

  const value = useMemo<TaxYearContextValue>(
    () => ({
      taxYear,
      setTaxYear: setTaxYearState,
    }),
    [taxYear],
  )

  return <TaxYearContext.Provider value={value}>{children}</TaxYearContext.Provider>
}
