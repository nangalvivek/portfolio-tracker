import type { Broker, Region } from './types'

const normalizeToken = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, '_')

export const makeSecurityId = (symbol: string, region: Region): string =>
  `${normalizeToken(symbol)}__${region}`

export const makeAccountId = (broker: Broker, region: Region, name?: string): string =>
  name ? `${normalizeToken(broker)}__${region}__${normalizeToken(name)}` : `${normalizeToken(broker)}__${region}`

export const splitSecurityId = (securityId: string): { symbol: string; region: Region | 'UNKNOWN' } => {
  const parts = securityId.split('__')
  if (parts.length >= 2 && (parts[parts.length - 1] === 'IN' || parts[parts.length - 1] === 'US')) {
    const region = parts[parts.length - 1] as Region
    return { symbol: parts.slice(0, -1).join('__'), region }
  }
  return { symbol: securityId, region: 'UNKNOWN' }
}
