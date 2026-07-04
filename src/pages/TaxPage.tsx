import { useMemo, useState } from 'react'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { useTaxYear } from '../app/taxYearContext'
import { buildItrBundle } from '../domain/export/itr'
import { downloadText } from '../lib/download'
import { formatMoney, formatQty } from '../lib/format'
import { scheduleFa } from '../domain/tax/fa'
import { scheduleFsi } from '../domain/tax/fsi'
import { scheduleTr } from '../domain/tax/tr'
import { scheduleCg } from '../domain/tax/cg'
import { fyOf } from '../domain/dates'
import { Card, Badge, Button, EmptyState, SectionTitle, Select } from '../components/Ui'

const tabs = [
  { key: 'fa', label: 'FA – A3', period: 'Calendar year' },
  { key: 'fsi', label: 'FSI', period: 'Calendar year' },
  { key: 'tr', label: 'TR', period: 'Calendar year' },
  { key: 'cg', label: 'CG', period: 'Financial year' },
] as const

type TabKey = (typeof tabs)[number]['key']

export const TaxPage = () => {
  const { taxYear, setTaxYear } = useTaxYear()
  const { transactions, prices } = usePortfolioData()
  const [tab, setTab] = useState<TabKey>('fa')
  const fy = fyOf(`${taxYear}-04-01`)

  const faRows = useMemo(() => scheduleFa(transactions, prices, taxYear), [prices, taxYear, transactions])
  const fsiRows = useMemo(() => scheduleFsi(transactions, taxYear), [taxYear, transactions])
  const trRows = useMemo(() => scheduleTr(fsiRows), [fsiRows])
  const cgResult = useMemo(() => scheduleCg(transactions, fy), [fy, transactions])
  const bundle = useMemo(() => buildItrBundle(transactions, prices, taxYear), [prices, taxYear, transactions])

  const exportCurrent = (kind: 'csv' | 'json') => {
    const payload = tab === 'fa' ? faRows : tab === 'fsi' ? fsiRows : tab === 'tr' ? trRows : cgResult.rows
    const filename = `${tab}-${taxYear}.${kind}`
    if (kind === 'json') downloadText(filename, JSON.stringify(payload, null, 2))
    if (kind === 'csv') {
      const headers = payload.length > 0 ? Object.keys(payload[0] as unknown as Record<string, unknown>) : []
      const rows = payload as unknown as Array<Record<string, unknown>>
      const csv = [headers.join(',')].concat(rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(','))).join('\n')
      downloadText(filename, csv, 'text/csv')
    }
  }

  const renderFa = () => (
    faRows.length === 0 ? <EmptyState title="No FA assets" description="Upload foreign holdings and monthly prices to generate Schedule FA rows." /> : (
      <div className="space-y-3">
        {faRows.map((row) => (
          <details key={row.securityId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{row.entityName}</div>
                  <div className="text-sm text-slate-500">{row.country} · {row.natureOfAsset}</div>
                </div>
                <div className="text-sm text-slate-600">Peak {formatMoney(row.peakValueDuringYearInr)}</div>
              </div>
            </summary>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr><th className="px-3 py-2 text-left">Month</th><th className="px-3 py-2 text-right">Price INR</th><th className="px-3 py-2 text-right">Value INR</th></tr>
                </thead>
                <tbody>
                  {row.monthlyPriceSeries.map((point) => <tr key={point.month} className={point.valueInr === row.peakValueDuringYearInr ? 'bg-emerald-50' : ''}><td className="px-3 py-2">{point.month}</td><td className="px-3 py-2 text-right">{formatMoney(point.priceInr)}</td><td className="px-3 py-2 text-right">{formatMoney(point.valueInr)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    )
  )

  const renderFsi = () => (
    fsiRows.length === 0 ? <EmptyState title="No foreign dividends" description="Dividend transactions in the selected calendar year appear here." /> : (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Country</th><th className="px-3 py-2 text-right">Income INR</th><th className="px-3 py-2 text-right">Tax paid abroad</th><th className="px-3 py-2 text-left">DTAA article</th></tr></thead>
          <tbody>{fsiRows.map((row) => <tr key={row.country}><td className="px-3 py-2">{row.country}</td><td className="px-3 py-2 text-right">{formatMoney(row.incomeInr)}</td><td className="px-3 py-2 text-right">{formatMoney(row.taxPaidAbroadInr)}</td><td className="px-3 py-2">{row.dtaaArticle}</td></tr>)}</tbody>
        </table>
      </div>
    )
  )

  const renderTr = () => (
    trRows.length === 0 ? <EmptyState title="No foreign tax credit rows" description="TR mirrors the FSI rows for foreign tax credit relief." /> : (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Country</th><th className="px-3 py-2 text-right">Foreign tax paid</th><th className="px-3 py-2 text-right">Relief claimed</th></tr></thead>
          <tbody>{trRows.map((row) => <tr key={row.country}><td className="px-3 py-2">{row.country}</td><td className="px-3 py-2 text-right">{formatMoney(row.foreignTaxPaidInr)}</td><td className="px-3 py-2 text-right">{formatMoney(row.reliefClaimedInr)}</td></tr>)}</tbody>
        </table>
      </div>
    )
  )

  const renderCg = () => (
    cgResult.rows.length === 0 ? <EmptyState title="No capital gains yet" description="Sell transactions in the selected financial year appear here." /> : (
      <div className="space-y-4">
        <Card>
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div><div className="text-slate-500">India STCG</div><div className="font-semibold">{formatMoney(cgResult.totals.stcgIndia)}</div></div>
            <div><div className="text-slate-500">India LTCG</div><div className="font-semibold">{formatMoney(cgResult.totals.ltcgIndia)}</div></div>
            <div><div className="text-slate-500">Foreign STCG</div><div className="font-semibold">{formatMoney(cgResult.totals.stcgForeign)}</div></div>
            <div><div className="text-slate-500">Foreign LTCG</div><div className="font-semibold">{formatMoney(cgResult.totals.ltcgForeign)}</div></div>
          </div>
        </Card>
        <div className="space-y-3">
          {cgResult.rows.map((row) => (
            <Card key={row.securityId + row.sellDate}>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{row.securityId}</div>
                  <div className="text-slate-500">{row.country} · {row.sellDate} · {row.term} · {row.holdingPeriodDays} days</div>
                </div>
                <div className="text-right text-slate-600">Gain {formatMoney(row.gainInr)}</div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm text-slate-600">
                <div>Qty {formatQty(row.sellQuantity)}</div>
                <div>Proceeds {formatMoney(row.proceedsInr)}</div>
                <div>Cost {formatMoney(row.costInr)}</div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 text-sm">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">STCG {formatMoney(row.stcgInr)}</div>
                <div className="rounded-xl bg-indigo-50 p-3 text-indigo-800">LTCG {formatMoney(row.ltcgInr)}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  )

  const body = tab === 'fa' ? renderFa() : tab === 'fsi' ? renderFsi() : tab === 'tr' ? renderTr() : renderCg()
  const periodLabel = tab === 'cg' ? fy : String(taxYear)

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Tax"
        subtitle={`Selected year: ${taxYear} · ${tab === 'cg' ? `Financial year ${fy}` : 'Calendar year'}.`}
        actions={<div className="flex flex-col gap-2 md:flex-row"><Select value={String(taxYear)} onChange={(event) => setTaxYear(Number(event.target.value))} className="w-36">{Array.from({ length: 10 }, (_, index) => currentYearOption(index)).map((year) => <option key={year} value={year}>{year}</option>)}</Select><Button variant="secondary" onClick={() => void exportCurrent('csv')}>Export CSV</Button><Button onClick={() => void exportCurrent('json')}>Export JSON</Button></div>}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`rounded-full px-4 py-2 text-sm font-medium ${tab === item.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200'}`}>
            {item.label} <span className="ml-2 text-xs opacity-70">{item.period}</span>
          </button>
        ))}
        <Badge tone="slate">{periodLabel}</Badge>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">{tab.toUpperCase()} summary</div>
            <p className="text-sm text-slate-500">{tab === 'cg' ? `Financial year ${fy}` : `Calendar year ${taxYear}`}</p>
          </div>
          <Button variant="ghost" onClick={() => downloadText(`${tab}-${taxYear}-bundle.json`, JSON.stringify(bundle, null, 2))}>Export ITR JSON bundle</Button>
        </div>
      </Card>

      {body}
    </div>
  )
}

const currentYearOption = (offset: number): number => new Date().getFullYear() - offset
