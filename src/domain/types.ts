export type AssetKind = 'EQUITY' | 'MF' | 'RSU' | 'ESOP' | 'OTHER'
export type Region = 'IN' | 'US'
export type Currency = 'INR' | 'USD'
export type TxnType = 'BUY' | 'SELL' | 'VEST' | 'DIVIDEND' | 'SPLIT' | 'BONUS'

export interface Security {
  id: string
  symbol: string
  isin?: string
  name: string
  region: Region
  currency: Currency
  kind: AssetKind
}

export type Broker = 'ZERODHA' | 'IBKR' | 'ETRADE' | 'OTHER'

export interface Account {
  id: string
  name: string
  broker: Broker
  region: Region
}

export interface TransactionRawRowRef {
  fileId: string
  lineNumber: number
  rawText: string
}

export interface LotConsumption {
  buyDate: string
  qty: number
  proceedsInr: number
  costInr: number
  gainInr: number
  holdingPeriodDays: number
  term: 'STCG' | 'LTCG'
}

export interface Transaction {
  id: string
  securityId: string
  accountId: string
  date: string
  type: TxnType
  quantity: number
  price: number
  currency: Currency
  fees?: number
  fxRate: number
  grossAmountNative: number
  grossAmountInr: number
  dedupeHash: string
  sourceFileIds: string[]
  rawRowRefs: TransactionRawRowRef[]
  notes?: string
  foreignTaxPaid?: number
}

export interface TransactionDraft {
  securityId: string
  accountId: string
  date: string
  type: TxnType
  quantity: number
  price: number
  currency: Currency
  fees?: number
  fxRate: number
  notes?: string
  foreignTaxPaid?: number
}

export interface ImportedFile {
  id: string
  filename: string
  broker: Broker
  importedAt: string
  sizeBytes: number
  sha256: string
  rowsProcessed: number
  rowsNew: number
  rowsDuplicate: number
  rowsError: number
  originalBlob: Blob
  rawText?: string
}

export interface MonthlyPrice {
  id: string
  securityId: string
  month: string
  price: number
  currency: Currency
  fxRate: number
  source: 'MANUAL'
}

export type LogCategory = 'IMPORT' | 'DEDUPE' | 'FIFO' | 'PRICE' | 'ERROR' | 'SYSTEM'

export interface LogEntry {
  id: string
  ts: string
  category: LogCategory
  message: string
  detail?: unknown
}
