import { cyOf, cyRange, fyOf, fyRange, monthsInCalendarYear, monthsInFy } from '../dates'

describe('date utilities', () => {
  it('derives FY and CY around boundaries', () => {
    expect(fyOf('2024-03-31')).toBe('FY2023-24')
    expect(fyOf('2024-04-01')).toBe('FY2024-25')
    expect(cyOf('2024-03-31')).toBe(2024)
    expect(cyOf('2024-04-01')).toBe(2024)
  })

  it('returns FY/CY ranges and month series', () => {
    expect(fyRange('FY2024-25')).toEqual({ start: '2024-04-01', end: '2025-03-31' })
    expect(cyRange(2024)).toEqual({ start: '2024-01-01', end: '2024-12-31' })
    expect(monthsInCalendarYear(2024)[0]).toBe('2024-01')
    expect(monthsInCalendarYear(2024)[11]).toBe('2024-12')
    expect(monthsInFy('FY2024-25')).toEqual([
      '2024-04',
      '2024-05',
      '2024-06',
      '2024-07',
      '2024-08',
      '2024-09',
      '2024-10',
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
      '2025-03',
    ])
  })
})
