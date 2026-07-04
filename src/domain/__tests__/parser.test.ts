import { parserRegistry, detectBroker, parseImportText } from '../parsers'

describe('parsers', () => {
  it('detects brokers from headers', () => {
    expect(detectBroker('zerodha.csv', ['trade_date', 'trade_type'])).toBe('ZERODHA')
    expect(detectBroker('ibkr.csv', ['tradeDate', 'buySell'])).toBe('IBKR')
    expect(detectBroker('whatever.csv', ['vestDate', 'sharesReleased'])).toBe('ETRADE')
  })

  it('parses Zerodha tradebook rows', () => {
    const csv = `symbol,isin,trade_date,trade_type,quantity,price
INFY,INE009A01021,2024-04-01,BUY,10,1500`
    const result = parseImportText('zerodha-tradebook.csv', csv)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]?.securityId).toBe('INFY__IN')
    expect(result.transactions[0]?.currency).toBe('INR')
  })

  it('parses IBKR flex rows and warns when FX is missing', () => {
    const csv = `symbol,isin,tradeDate,buySell,quantity,tradePrice,currency
AAPL,US0378331005,2024-04-01,BUY,2,100,USD`
    const result = parserRegistry.ibkrFlex(csv)
    expect(result.transactions[0]?.fxRate).toBe(1)
    expect(result.warnings[0]?.reason).toMatch(/FX rate missing/)
  })

  it('parses E*Trade RSU rows', () => {
    const csv = `symbol,vestDate,sharesReleased,fmv,currency
MSFT,2024-05-01,3,400,USD`
    const result = parserRegistry.etradeRsu(csv)
    expect(result.transactions[0]?.type).toBe('VEST')
    expect(result.transactions[0]?.securityId).toBe('MSFT__US')
  })

  it('parses generic CSV with aliases', () => {
    const csv = `date,symbol,type,qty,price,currency,region
2024-04-01,RELIANCE,BUY,5,2500,INR,IN`
    const result = parserRegistry.genericCsv(csv)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]?.securityId).toBe('RELIANCE__IN')
  })
})
