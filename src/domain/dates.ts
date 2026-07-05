export const cyOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCFullYear()

export const fyOf = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00Z`)
  const year = parsed.getUTCFullYear()
  const month = parsed.getUTCMonth() + 1
  const startYear = month >= 4 ? year : year - 1
  const endYear = startYear + 1
  return `FY${startYear}-${String(endYear).slice(-2)}`
}

export const fyRange = (fy: string): { start: string; end: string } => {
  const match = /^FY(\d{4})-(\d{2})$/.exec(fy)
  if (!match) {
    throw new Error(`Invalid FY string: ${fy}`)
  }
  const startYear = Number(match[1])
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  }
}

export const cyRange = (year: number): { start: string; end: string } => ({
  start: `${year}-01-01`,
  end: `${year}-12-31`,
})

export const monthsInCalendarYear = (year: number): string[] =>
  Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, '0')
    return `${year}-${month}`
  })

export const monthsInFy = (fy: string): string[] => {
  const { start } = fyRange(fy)
  const startYear = Number(start.slice(0, 4))
  return [
    `${startYear}-04`,
    `${startYear}-05`,
    `${startYear}-06`,
    `${startYear}-07`,
    `${startYear}-08`,
    `${startYear}-09`,
    `${startYear}-10`,
    `${startYear}-11`,
    `${startYear}-12`,
    `${startYear + 1}-01`,
    `${startYear + 1}-02`,
    `${startYear + 1}-03`,
  ]
}

export const compareIsoDate = (left: string, right: string): number => left.localeCompare(right)

export const startOfMonth = (month: string): string => `${month}-01`

export const endOfMonth = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber, 0))
  return date.toISOString().slice(0, 10)
}
