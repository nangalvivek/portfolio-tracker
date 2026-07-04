import { useMemo, useState } from 'react'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { computeDedupeHash } from '../domain/dedupe'
import { fifoTrace } from '../domain/fifo'
import { downloadText } from '../lib/download'
import { formatDateTime, formatMoney, formatQty } from '../lib/format'
import { Badge, Button, Card, EmptyState, Input, SectionTitle, Select } from '../components/Ui'

const categories = ['ALL', 'IMPORT', 'DEDUPE', 'FIFO', 'PRICE', 'ERROR', 'SYSTEM'] as const

type CategoryFilter = (typeof categories)[number]

export const DebugPage = () => {
  const { logs, transactions, files, securityById } = usePortfolioData()
  const [filter, setFilter] = useState<CategoryFilter>('ALL')
  const [search, setSearch] = useState('')
  const [hashForm, setHashForm] = useState({ securityId: '', accountId: '', date: '', type: 'BUY', quantity: '1', price: '1' })
  const [selectedTxnId, setSelectedTxnId] = useState('')
  const [selectedSellId, setSelectedSellId] = useState('')

  const filteredLogs = useMemo(() => logs.filter((log) => filter === 'ALL' || log.category === filter), [filter, logs])
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return transactions.filter((txn) => {
      const security = securityById.get(txn.securityId)
      return txn.date.includes(query) || txn.securityId.toLowerCase().includes(query) || security?.symbol.toLowerCase().includes(query)
    })
  }, [search, securityById, transactions])

  const selectedTxn = transactions.find((txn) => txn.id === selectedTxnId) ?? searchResults[0]
  const selectedSellTxns = transactions.filter((txn) => txn.type === 'SELL')
  const trace = selectedSellId ? fifoTrace(transactions, selectedSellId) : { steps: [] }
  const canonicalKey = `${hashForm.securityId}|${hashForm.accountId}|${hashForm.date}|${hashForm.type}|${Number(hashForm.quantity).toFixed(4)}|${Number(hashForm.price).toFixed(2)}`
  const dedupeHash = useMemo(() => {
    if (!hashForm.securityId || !hashForm.accountId || !hashForm.date) return ''
    return computeDedupeHash({
      securityId: hashForm.securityId,
      accountId: hashForm.accountId,
      date: hashForm.date,
      type: hashForm.type as 'BUY' | 'SELL' | 'VEST' | 'DIVIDEND' | 'SPLIT' | 'BONUS',
      quantity: Number(hashForm.quantity),
      price: Number(hashForm.price),
    })
  }, [hashForm])

  return (
    <div className="space-y-6">
      <SectionTitle title="Debug" subtitle="Inspect logs, verify hashes, and trace FIFO lot consumption." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle
            title="System log"
            subtitle="Newest first, with category filters and export."
            actions={<div className="flex gap-2"><Button variant="secondary" onClick={() => downloadText('logs.json', JSON.stringify(filteredLogs, null, 2))}>Export log JSON</Button><Button variant="secondary" onClick={() => downloadText('logs.csv', `ts,category,message\n${filteredLogs.map((log) => `${log.ts},${log.category},${JSON.stringify(log.message)}`).join('\n')}`, 'text/csv')}>Export log CSV</Button></div>}
          />
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button key={category} type="button" onClick={() => setFilter(category)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === category ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{category}</button>
            ))}
          </div>
          {filteredLogs.length === 0 ? (
            <EmptyState title="No logs yet" description="Imports, dedupe actions, FIFO traces, and validation errors will appear here." />
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div key={log.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone="slate">{log.category}</Badge>
                    <span className="text-xs text-slate-500">{formatDateTime(log.ts)}</span>
                  </div>
                  <div className="mt-2 text-slate-900">{log.message}</div>
                  {log.detail ? <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{JSON.stringify(log.detail, null, 2)}</pre> : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Transaction inspector" subtitle="Search by symbol or date and inspect source documents." />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by date or symbol" />
          {searchResults.length === 0 ? (
            <EmptyState title="No transaction selected" description="Enter a date or symbol to inspect a transaction and its raw row references." />
          ) : (
            <div className="mt-4 space-y-3">
              {searchResults.map((txn) => (
                <button key={txn.id} type="button" onClick={() => setSelectedTxnId(txn.id)} className="w-full rounded-xl border border-slate-200 p-3 text-left text-sm hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-900">{securityById.get(txn.securityId)?.symbol ?? txn.securityId}</div>
                    <Badge tone="slate">{txn.type}</Badge>
                  </div>
                  <div className="mt-1 text-slate-500">{txn.date} · Qty {formatQty(txn.quantity)} · Price {formatMoney(txn.price)}</div>
                </button>
              ))}
            </div>
          )}
          {selectedTxn ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">{selectedTxn.securityId}</div>
              <div className="mt-1">Source files: {(selectedTxn.sourceFileIds ?? []).map((fileId) => files.find((file) => file.id === fileId)?.filename ?? fileId).join(', ')}</div>
              <div className="mt-2 space-y-2">
                {selectedTxn.rawRowRefs.map((ref) => (
                  <div key={`${ref.fileId}-${ref.lineNumber}`} className="rounded-lg bg-white p-2 text-xs">
                    <div className="font-medium text-slate-900">{files.find((file) => file.id === ref.fileId)?.filename ?? ref.fileId} · line {ref.lineNumber}</div>
                    <pre className="mt-1 overflow-x-auto text-slate-600">{ref.rawText}</pre>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle title="Hash checker" subtitle="Uses the same dedupe hash algorithm as imports." />
          <div className="grid gap-3 md:grid-cols-2">
            {(['securityId', 'accountId', 'date', 'type', 'quantity', 'price'] as const).map((field) => (
              <Input
                key={field}
                value={hashForm[field]}
                onChange={(event) => setHashForm((current) => ({ ...current, [field]: event.target.value }))}
                placeholder={field}
              />
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="text-slate-500">Canonical key</div>
            <div className="mt-1 break-all font-mono text-slate-900">{canonicalKey}</div>
            <div className="mt-3 text-slate-500">Dedupe hash</div>
            <div className="mt-1 break-all font-mono text-slate-900">{dedupeHash || '—'}</div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="FIFO trace" subtitle="Pick a sell transaction to see lot consumption step-by-step." />
          {selectedSellTxns.length === 0 ? (
            <EmptyState title="No sell transactions yet" description="Add sell rows to inspect FIFO trace output." />
          ) : (
            <>
              <Select value={selectedSellId} onChange={(event) => setSelectedSellId(event.target.value)}>
                <option value="">Select a sell transaction</option>
                {selectedSellTxns.map((txn) => <option key={txn.id} value={txn.id}>{securityById.get(txn.securityId)?.symbol ?? txn.securityId} · {txn.date} · {formatQty(txn.quantity)}</option>)}
              </Select>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Buy date</th><th className="px-3 py-2 text-right">Qty taken</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Proceeds</th><th className="px-3 py-2 text-left">Term</th><th className="px-3 py-2 text-right">Holding days</th></tr></thead>
                  <tbody>
                    {trace.steps.map((step) => <tr key={`${step.buyDate}-${step.qtyTaken}`}><td className="px-3 py-2">{step.buyDate}</td><td className="px-3 py-2 text-right">{formatQty(step.qtyTaken)}</td><td className="px-3 py-2 text-right">{formatMoney(step.costInr)}</td><td className="px-3 py-2 text-right">{formatMoney(step.proceedsInr)}</td><td className="px-3 py-2">{step.term}</td><td className="px-3 py-2 text-right">{step.holdingPeriodDays}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
