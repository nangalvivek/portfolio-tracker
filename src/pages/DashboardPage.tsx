import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, EmptyState, Button, SectionTitle, Badge } from '../components/Ui'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { formatDateTime, formatMoney } from '../lib/format'
import { scheduleFa } from '../domain/tax/fa'
import { useTaxYear } from '../app/taxYearContext'
import { downloadText } from '../lib/download'
import { buildItrBundle } from '../domain/export/itr'
import { exportBackup } from '../domain/export'

const COLORS = ['#4f46e5', '#0f172a']

export const DashboardPage = () => {
  const navigate = useNavigate()
  const { taxYear } = useTaxYear()
  const { holdings, files, transactions, prices, securityById } = usePortfolioData()
  const currentYear = new Date().getFullYear()

  const summary = useMemo(() => {
    const values = holdings.filter((holding) => holding.currentValueInr !== undefined)
    const indian = values.filter((holding) => holding.region === 'IN').reduce((total, holding) => total + (holding.currentValueInr ?? 0), 0)
    const foreign = values.filter((holding) => holding.region === 'US').reduce((total, holding) => total + (holding.currentValueInr ?? 0), 0)
    const dividends = transactions
      .filter((txn) => txn.type === 'DIVIDEND' && txn.date.startsWith(`${currentYear}-`))
      .reduce((total, txn) => total + txn.quantity * txn.price * txn.fxRate, 0)
    const faReportable = scheduleFa(transactions, prices, currentYear).length
    const allocation = [
      { name: 'India', value: indian },
      { name: 'Foreign', value: foreign },
    ]
    return { indian, foreign, dividends, faReportable, allocation }
  }, [currentYear, holdings, prices, transactions])

  const recentFiles = files.slice(0, 5)
  const canExportItr = transactions.length > 0 || prices.length > 0

  const exportBackupFile = async () => {
    const backup = await exportBackup()
    downloadText(`portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2))
  }

  const exportItr = async () => {
    const bundle = buildItrBundle(transactions, prices, taxYear)
    downloadText(`itr-${taxYear}.json`, JSON.stringify(bundle, null, 2))
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Dashboard"
        subtitle="A quick read on holdings, imports, and ITR readiness."
        actions={<div className="flex gap-2"><Button onClick={() => navigate('/uploads')}>Upload Tradebook</Button><Button variant="secondary" onClick={() => navigate('/uploads#prices')}>Add Monthly Prices</Button></div>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-slate-500">Indian Holdings Value</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(summary.indian)}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Foreign Holdings Value</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(summary.foreign)}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Dividends received YTD</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(summary.dividends)}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">FA reportable assets</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.faReportable}</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Recent activity" subtitle="Latest imports from the files vault." />
          {recentFiles.length === 0 ? (
            <EmptyState
              title="No imports yet"
              description="Upload a tradebook or try one of the sample files to populate your files vault and import history."
              action={<Button onClick={() => navigate('/uploads')}>Go to Uploads</Button>}
            />
          ) : (
            <div className="space-y-3">
              {recentFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{file.filename}</div>
                    <div className="text-slate-500">{file.broker} · {formatDateTime(file.importedAt)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={file.rowsError === 0 ? 'green' : 'amber'}>{file.rowsError === 0 ? 'OK' : 'Partial'}</Badge>
                    <div className="text-right text-slate-500">{file.rowsProcessed} rows</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Asset allocation" subtitle="India vs foreign split by current value." />
          {summary.indian === 0 && summary.foreign === 0 ? (
            <EmptyState title="Nothing priced yet" description="Upload trade data and monthly prices to see allocation charts." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.allocation} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {summary.allocation.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(typeof value === 'number' ? value : undefined)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle title="Backup / Restore" subtitle="Export a full backup or ITR bundle for the selected year." />
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void exportBackupFile()}>Export full backup</Button>
          <Button variant="secondary" onClick={() => void exportItr()} disabled={!canExportItr}>Export ITR JSON</Button>
          <Button variant="ghost" onClick={() => navigate('/tax')}>Generate FA for current year</Button>
        </div>
        <p className="mt-3 text-sm text-slate-500">Restore is handled from the Uploads tab once you choose a backup JSON file.</p>
      </Card>

      <Card>
        <SectionTitle title="Data sanity" subtitle="Live snapshot of local data tables." />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase text-slate-500">Securities</div><div className="mt-1 text-xl font-semibold">{securityById.size}</div></div>
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase text-slate-500">Transactions</div><div className="mt-1 text-xl font-semibold">{transactions.length}</div></div>
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase text-slate-500">Monthly prices</div><div className="mt-1 text-xl font-semibold">{prices.length}</div></div>
        </div>
      </Card>
    </div>
  )
}
