import Papa from 'papaparse'
import type { Account, Broker, Currency, Region, Security, TransactionDraft, TxnType } from '../types'
import { makeAccountId, makeSecurityId } from '../ids'

export interface ParseMessage {
  lineNumber: number
  raw: string
  reason: string
}

export interface ParsedImport {
  broker: Broker
  securities: Security[]
  accounts: Account[]
  transactions: TransactionDraft[]
  errors: ParseMessage[]
  warnings: ParseMessage[]
}

const normalizeHeader = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')

const headerIncludes = (headers: string[], candidates: readonly string[]): boolean =>
  headers.some((header) => candidates.includes(normalizeHeader(header)))

const findValue = (row: Record<string, string | undefined>, aliases: readonly string[]): string | undefined => {
  for (const [key, value] of Object.entries(row)) {
    if (aliases.includes(normalizeHeader(key)) && value !== undefined && value.trim() !== '') {
      return value.trim()
    }
  }
  return undefined
}

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined
  const parsed = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

const normalizeSymbol = (symbol: string): string => symbol.trim().toUpperCase().replace(/\s+/g, '')

const defaultCurrencyForRegion = (region: Region): Currency => (region === 'IN' ? 'INR' : 'USD')

const inferTxnType = (value: string | undefined): TxnType | undefined => {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  if (normalized === 'B' || normalized === 'BUY' || normalized === 'PURCHASE') return 'BUY'
  if (normalized === 'S' || normalized === 'SELL' || normalized === 'SALE') return 'SELL'
  if (normalized === 'VEST' || normalized === 'RELEASE') return 'VEST'
  if (normalized === 'DIVIDEND' || normalized === 'DIV') return 'DIVIDEND'
  if (normalized === 'SPLIT') return 'SPLIT'
  if (normalized === 'BONUS') return 'BONUS'
  return undefined
}

const buildSecurity = (
  symbol: string,
  region: Region,
  currency: Currency,
  kind: Security['kind'],
  isin?: string,
  name?: string,
): Security => ({
  id: makeSecurityId(symbol, region),
  symbol: normalizeSymbol(symbol),
  isin,
  name: name?.trim() || normalizeSymbol(symbol),
  region,
  currency,
  kind,
})

const buildAccount = (broker: Broker, region: Region, name?: string): Account => ({
  id: makeAccountId(broker, region, name),
  name: name?.trim() || `${broker} ${region}`,
  broker,
  region,
})

const parseCsv = (csvText: string): { rows: Record<string, string | undefined>[]; headers: string[]; errors: ParseMessage[] } => {
  const result = Papa.parse<Record<string, string | undefined>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
  })
  const rows = result.data.filter((row) => Object.keys(row).length > 0)
  const headers = result.meta.fields ?? []
  const errors: ParseMessage[] = result.errors.map((error) => ({
    lineNumber: (error.row ?? 0) + 2,
    raw: '',
    reason: error.message,
  }))
  return { rows, headers, errors }
}

const parseTradeRows = (
  rows: Record<string, string | undefined>[],
  region: Region,
  currency: Currency,
  broker: Broker,
  accountName: string,
  kind: Security['kind'] = 'EQUITY',
): ParsedImport => {
  const securities = new Map<string, Security>()
  const accounts = [buildAccount(broker, region, accountName)]
  const transactions: TransactionDraft[] = []
  const errors: ParseMessage[] = []
  const warnings: ParseMessage[] = []

  rows.forEach((row, index) => {
    const lineNumber = index + 2
    const symbol = findValue(row, ['symbol', 'ticker'])
    const date = findValue(row, ['tradedate', 'date'])
    const tradeType = inferTxnType(findValue(row, ['tradetype', 'buysell', 'type', 'side', 'transactiontype']))
    const quantity = parseNumber(findValue(row, ['quantity', 'qty', 'shares']))
    const price = parseNumber(findValue(row, ['price', 'tradeprice', 'rate']))
    const isin = findValue(row, ['isin'])
    const fxRate = parseNumber(findValue(row, ['fxrate', 'fxratetobase'])) ?? (currency === 'INR' ? 1 : 1)

    if (!symbol) {
      errors.push({ lineNumber, raw: JSON.stringify(row), reason: 'missing symbol column' })
      return
    }
    if (!date) {
      errors.push({ lineNumber, raw: JSON.stringify(row), reason: 'missing date column' })
      return
    }
    if (!tradeType) {
      errors.push({ lineNumber, raw: JSON.stringify(row), reason: 'missing trade type column' })
      return
    }
    if (quantity === undefined || quantity <= 0) {
      errors.push({ lineNumber, raw: JSON.stringify(row), reason: 'missing quantity column' })
      return
    }
    if (price === undefined || price < 0) {
      errors.push({ lineNumber, raw: JSON.stringify(row), reason: 'missing price column' })
      return
    }

    const security = buildSecurity(symbol, region, currency, kind, isin)
    securities.set(security.id, security)
    transactions.push({
      securityId: security.id,
      accountId: accounts[0].id,
      date,
      type: tradeType,
      quantity,
      price,
      currency,
      fxRate,
    })
  })

  return { broker, securities: [...securities.values()], accounts, transactions, errors, warnings }
}

const parseZerodhaTradebook = (csvText: string): ParsedImport => {
  const parsed = parseCsv(csvText)
  const base = parseTradeRows(parsed.rows, 'IN', 'INR', 'ZERODHA', 'Zerodha Tradebook')
  return {
    ...base,
    errors: [...parsed.errors, ...base.errors],
    warnings: base.warnings,
  }
}

const parseZerodhaContractNote = (csvText: string): ParsedImport => {
  const parsed = parseCsv(csvText)
  const base = parseTradeRows(parsed.rows, 'IN', 'INR', 'ZERODHA', 'Zerodha Contract Note')
  return { ...base, errors: [...parsed.errors, ...base.errors] }
}

const parseZerodhaHoldings = (csvText: string): ParsedImport => {
  const parsed = parseCsv(csvText)
  const base = parseTradeRows(parsed.rows, 'IN', 'INR', 'ZERODHA', 'Zerodha Holdings')
  return {
    ...base,
    errors: [...parsed.errors, ...base.errors],
    warnings: [...base.warnings, { lineNumber: 1, raw: '', reason: 'holdings snapshot is informational; no opening lots were generated' }],
    transactions: [],
  }
}

const parseIbkrFlex = (csvText: string): ParsedImport => {
  const parsed = parseCsv(csvText)
  const securities = new Map<string, Security>()
  const accounts = [buildAccount('IBKR', 'US', 'IBKR Flex')]
  const transactions: TransactionDraft[] = []
  const warnings: ParseMessage[] = []
  const errors: ParseMessage[] = [...parsed.errors]

  parsed.rows.forEach((row, index) => {
    const lineNumber = index + 2
    const symbol = findValue(row, ['symbol', 'ticker'])
    const date = findValue(row, ['tradedate', 'date'])
    const buySell = inferTxnType(findValue(row, ['buysell', 'side']))
    const quantity = parseNumber(findValue(row, ['quantity', 'qty', 'shares']))
    const price = parseNumber(findValue(row, ['tradeprice', 'price', 'rate']))
    const isin = findValue(row, ['isin'])
    const fxRate = parseNumber(findValue(row, ['fxratetobase', 'fxrate']))

    if (!symbol || !date || !buySell || quantity === undefined || price === undefined) {
      errors.push({ lineNumber, raw: JSON.stringify(row), reason: 'missing one or more required IBKR columns' })
      return
    }

    const effectiveFxRate = fxRate ?? 1
    if (fxRate === undefined) {
      warnings.push({
        lineNumber,
        raw: JSON.stringify(row),
        reason: `FX rate missing for ${symbol}, defaulted to 1`,
      })
    }

    const security = buildSecurity(symbol, 'US', 'USD', 'EQUITY', isin)
    securities.set(security.id, security)
    transactions.push({
      securityId: security.id,
      accountId: accounts[0].id,
      date,
      type: buySell,
      quantity,
      price,
      currency: 'USD',
      fxRate: effectiveFxRate,
    })
  })

  return { broker: 'IBKR', securities: [...securities.values()], accounts, transactions, errors, warnings }
}

const parseEtradeRsu = (csvText: string): ParsedImport => {
  const parsed = parseCsv(csvText)
  const securities = new Map<string, Security>()
  const accounts = [buildAccount('ETRADE', 'US', 'E*Trade RSU')]
  const transactions: TransactionDraft[] = []
  const warnings: ParseMessage[] = []
  const errors: ParseMessage[] = [...parsed.errors]

  parsed.rows.forEach((row, index) => {
    const lineNumber = index + 2
    const symbol = findValue(row, ['symbol', 'ticker'])
    const vestDate = findValue(row, ['vestdate', 'releasedate', 'date'])
    const sharesReleased = parseNumber(findValue(row, ['sharesreleased', 'quantity', 'qty']))
    const fmv = parseNumber(findValue(row, ['fmv', 'price', 'tradeprice']))
    const fxRate = parseNumber(findValue(row, ['fxrate', 'fxratetobase']))
    if (!symbol || !vestDate || sharesReleased === undefined || fmv === undefined) {
      errors.push({ lineNumber, raw: JSON.stringify(row), reason: 'missing one or more required E*Trade RSU columns' })
      return
    }
    const security = buildSecurity(symbol, 'US', 'USD', 'RSU', findValue(row, ['isin']))
    securities.set(security.id, security)
    transactions.push({
      securityId: security.id,
      accountId: accounts[0].id,
      date: vestDate,
      type: 'VEST',
      quantity: sharesReleased,
      price: fmv,
      currency: 'USD',
      fxRate: fxRate ?? 1,
    })
    if (fxRate === undefined) {
      warnings.push({ lineNumber, raw: JSON.stringify(row), reason: `FX rate missing for ${symbol}, defaulted to 1` })
    }
  })

  return { broker: 'ETRADE', securities: [...securities.values()], accounts, transactions, errors, warnings }
}

const parseGenericCsv = (csvText: string): ParsedImport => {
  const parsed = parseCsv(csvText)
  const securities = new Map<string, Security>()
  const accounts = [buildAccount('OTHER', 'IN', 'Generic CSV')]
  const transactions: TransactionDraft[] = []
  const warnings: ParseMessage[] = []
  const errors: ParseMessage[] = [...parsed.errors]

  parsed.rows.forEach((row, index) => {
    const lineNumber = index + 2
    const symbol = findValue(row, ['symbol', 'ticker'])
    const date = findValue(row, ['date', 'tradedate'])
    const type = inferTxnType(findValue(row, ['type', 'tradetype', 'buysell', 'side']))
    const quantity = parseNumber(findValue(row, ['qty', 'quantity', 'shares']))
    const price = parseNumber(findValue(row, ['price', 'rate', 'tradeprice']))
    const region = ((findValue(row, ['region']) ?? 'IN').trim().toUpperCase() === 'US' ? 'US' : 'IN') as Region
    const currency = ((findValue(row, ['currency']) ?? defaultCurrencyForRegion(region)).trim().toUpperCase() === 'USD' ? 'USD' : 'INR') as Currency
    const fxRate = parseNumber(findValue(row, ['fxrate'])) ?? (currency === 'INR' ? 1 : 1)
    const isin = findValue(row, ['isin'])

    if (!symbol || !date || !type || quantity === undefined || price === undefined) {
      errors.push({ lineNumber, raw: JSON.stringify(row), reason: 'missing one or more required columns in generic CSV' })
      return
    }
    if (currency === 'USD' && findValue(row, ['fxrate']) === undefined) {
      warnings.push({ lineNumber, raw: JSON.stringify(row), reason: `FX rate missing for ${symbol}, defaulted to 1` })
    }

    const security = buildSecurity(symbol, region, currency, type === 'VEST' ? 'RSU' : 'EQUITY', isin)
    securities.set(security.id, security)
    transactions.push({
      securityId: security.id,
      accountId: accounts[0].id,
      date,
      type,
      quantity,
      price,
      currency,
      fxRate,
    })
  })

  return { broker: 'OTHER', securities: [...securities.values()], accounts, transactions, errors, warnings }
}

export const detectBroker = (filename: string, headerRow: string[]): Broker => {
  const lowerName = filename.toLowerCase()
  const headers = headerRow.map(normalizeHeader)
  if (lowerName.includes('zerodha')) return 'ZERODHA'
  if (lowerName.includes('etrade')) return 'ETRADE'
  if (lowerName.includes('ibkr')) return 'IBKR'
  if (headerIncludes(headers, ['tradedate', 'tradetype'])) return 'ZERODHA'
  if (headerIncludes(headers, ['sharesreleased', 'vestdate', 'releasedate'])) return 'ETRADE'
  if (headerIncludes(headers, ['buysell', 'tradedate'])) return 'IBKR'
  return 'OTHER'
}

export const parseImportText = (filename: string, csvText: string): ParsedImport => {
  const { headers } = parseCsv(csvText)
  const broker = detectBroker(filename, headers)
  if (broker === 'IBKR') return parseIbkrFlex(csvText)
  if (broker === 'ETRADE') return parseEtradeRsu(csvText)
  if (broker === 'ZERODHA') {
    if (filename.toLowerCase().includes('holdings')) return parseZerodhaHoldings(csvText)
    if (filename.toLowerCase().includes('contract')) return parseZerodhaContractNote(csvText)
    return parseZerodhaTradebook(csvText)
  }
  return parseGenericCsv(csvText)
}

export const parserRegistry = {
  detectBroker,
  parseImportText,
  zerodhaTradebook: parseZerodhaTradebook,
  zerodhaHoldings: parseZerodhaHoldings,
  zerodhaContractNote: parseZerodhaContractNote,
  ibkrFlex: parseIbkrFlex,
  etradeRsu: parseEtradeRsu,
  genericCsv: parseGenericCsv,
}
