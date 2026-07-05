export const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

export const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 4,
})

export const formatMoney = (value: number | undefined | null): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return inrFormatter.format(value)
}

export const formatQty = (value: number | undefined | null): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return numberFormatter.format(value)
}

export const formatDate = (isoDate: string): string => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${isoDate}T00:00:00Z`))
export const formatDateTime = (isoDateTime: string): string => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(isoDateTime))
