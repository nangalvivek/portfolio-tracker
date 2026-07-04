import { Fragment, useMemo, useState } from 'react'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { Badge, Card, EmptyState, Input, SectionTitle } from '../components/Ui'
import { formatMoney, formatQty } from '../lib/format'
import { splitSecurityId } from '../domain/ids'

const regionLabel = (region: 'IN' | 'US'): string => (region === 'IN' ? 'India' : 'Foreign')

export const PortfolioPage = () => {
  const { holdings } = usePortfolioData()
  const [query, setQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState<'ALL' | 'IN' | 'US'>('ALL')
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase()
    return holdings
      .filter((holding) => regionFilter === 'ALL' || holding.region === regionFilter)
      .filter((holding) => {
        if (!search) return true
        const security = holding.security
        return (
          holding.securityId.toLowerCase().includes(search) ||
          security?.symbol.toLowerCase().includes(search) ||
          security?.isin?.toLowerCase().includes(search) ||
          security?.name.toLowerCase().includes(search)
        )
      })
      .sort((left, right) => (right.currentValueInr ?? 0) - (left.currentValueInr ?? 0))
  }, [holdings, query, regionFilter])

  return (
    <div className="space-y-6">
      <SectionTitle title="Portfolio" subtitle="Current holdings, cost basis, and FIFO open lots." />

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by symbol or ISIN" />
          <div className="flex gap-2">
            {(['ALL', 'IN', 'US'] as const).map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setRegionFilter(region)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${regionFilter === region ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {region === 'ALL' ? 'All' : regionLabel(region)}
              </button>
            ))}
          </div>
          <Badge tone="slate">{rows.length} holdings</Badge>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No holdings yet" description="Upload tradebooks and prices to see FIFO holdings and unrealized P&amp;L." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Security</th>
                  <th className="px-4 py-3 text-left font-medium">Account</th>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th className="px-4 py-3 text-right font-medium">Average Cost INR</th>
                  <th className="px-4 py-3 text-right font-medium">Current Price</th>
                  <th className="px-4 py-3 text-right font-medium">Current Value</th>
                  <th className="px-4 py-3 text-right font-medium">Unrealized P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((holding) => {
                  const rowKey = `${holding.securityId}:${holding.accountId}`
                  const isExpanded = expanded === rowKey
                  return (
                    <Fragment key={rowKey}>
                      <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(isExpanded ? null : rowKey)}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{holding.security?.symbol ?? holding.securityId}</div>
                          <div className="text-xs text-slate-500">{holding.security?.isin ?? splitSecurityId(holding.securityId).region}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{holding.account?.name ?? holding.accountId}</td>
                        <td className="px-4 py-3 text-right">{formatQty(holding.quantity)}</td>
                        <td className="px-4 py-3 text-right">{formatMoney(holding.averageCostInr)}</td>
                        <td className="px-4 py-3 text-right">{holding.currentPriceInr === undefined ? '—' : formatMoney(holding.currentPriceInr)}</td>
                        <td className="px-4 py-3 text-right">{formatMoney(holding.currentValueInr)}</td>
                        <td className={`px-4 py-3 text-right ${holding.unrealizedPnlInr === undefined ? 'text-slate-500' : holding.unrealizedPnlInr >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {holding.unrealizedPnlInr === undefined ? '—' : formatMoney(holding.unrealizedPnlInr)}
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={7} className="bg-slate-50 px-4 py-4">
                            <div className="text-sm font-medium text-slate-900">Open FIFO lots</div>
                            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                              <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">Buy date</th>
                                    <th className="px-3 py-2 text-right font-medium">Remaining qty</th>
                                    <th className="px-3 py-2 text-right font-medium">Cost/unit INR</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {holding.openLots.map((lot) => (
                                    <tr key={`${lot.date}-${lot.remaining}`} className="border-t border-slate-200">
                                      <td className="px-3 py-2">{lot.date}</td>
                                      <td className="px-3 py-2 text-right">{formatQty(lot.remaining)}</td>
                                      <td className="px-3 py-2 text-right">{formatMoney(lot.costPerUnitInr)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
