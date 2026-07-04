export const roundTo = (value: number, digits: number): number => {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export const round2 = (value: number): number => roundTo(value, 2)
export const round4 = (value: number): number => roundTo(value, 4)

export const sumRounded = (values: readonly number[], digits = 2): number =>
  roundTo(values.reduce((total, value) => total + value, 0), digits)

export const toInr = (amountNative: number, fxRate: number): number => round2(amountNative * fxRate)
export const toNative = (amountInr: number, fxRate: number): number => round4(amountInr / fxRate)
