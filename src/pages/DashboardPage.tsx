import {useMemo} from 'react'
import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip} from 'recharts'
import {Button, Heading, Text} from '@react-spectrum/s2'
import {style, space} from '@react-spectrum/s2/style' with {type: 'macro'}
import {useNavigate} from 'react-router-dom'
import {usePortfolioData} from '../hooks/usePortfolioData'
import {useTaxYear} from '../app/taxYearContext'
import {scheduleFa} from '../domain/tax/fa'
import {buildItrBundle} from '../domain/export/itr'
import {exportBackup} from '../domain/export'
import {downloadText} from '../lib/download'
import {formatDateTime, formatMoney} from '../lib/format'
import {Panel, PageHeader, SectionTitle, EmptyState, EmptyStateIllustrations, StatusBadge, MetricCard, pageStackStyle, pageMetricGridStyle, pageTwoColumnGridStyle, secondaryTextStyle, toStyleString} from '../components/Ui'

const COLORS = ['var(--spectrum-global-color-blue-600)', 'var(--spectrum-global-color-celery-600)']

const recentListStyle: string = style({display: 'grid', gap: space(12)})
const recentItemStyle: string = style({
  padding: space(12),
  borderRadius: 'sm',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'layer-1'
})
const recentItemHeaderStyle: string = style({display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: space(8), flexWrap: 'wrap'})
const actionRowStyle: string = style({display: 'flex', gap: space(8), flexWrap: 'wrap', justifyContent: 'end'})
const chartShellStyle: string = style({height: space(256)})

export const DashboardPage = () => {
  const navigate = useNavigate()
  const {taxYear} = useTaxYear()
  const {holdings, files, transactions, prices} = usePortfolioData()
  const currentYear = new Date().getFullYear()

  const summary = useMemo(() => {
    const pricedHoldings = holdings.filter((holding) => holding.currentValueInr !== undefined)
    const indian = pricedHoldings.filter((holding) => holding.region === 'IN').reduce((total, holding) => total + (holding.currentValueInr ?? 0), 0)
    const foreign = pricedHoldings.filter((holding) => holding.region === 'US').reduce((total, holding) => total + (holding.currentValueInr ?? 0), 0)
    const dividends = transactions
      .filter((txn) => txn.type === 'DIVIDEND' && txn.date.startsWith(`${currentYear}-`))
      .reduce((total, txn) => total + txn.quantity * txn.price * txn.fxRate, 0)
    const faReportable = scheduleFa(transactions, prices, currentYear).length
    return {
      indian,
      foreign,
      dividends,
      faReportable,
      allocation: [
        {name: 'India', value: indian},
        {name: 'Foreign', value: foreign},
      ],
    }
  }, [currentYear, holdings, prices, transactions])

  const exportBackupFile = async () => {
    const backup = await exportBackup()
    downloadText(`portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2))
  }

  const exportItr = () => {
    const bundle = buildItrBundle(transactions, prices, taxYear)
    downloadText(`itr-${taxYear}.json`, JSON.stringify(bundle, null, 2))
  }

  const recentFiles = files.slice(0, 5)

  return (
    <div className={pageStackStyle}>
      <PageHeader
        title="Dashboard"
        subtitle="A quick read on holdings, imports, and ITR readiness."
        actions={
          <>
            <Button variant="accent" onPress={() => navigate('/uploads')}>Upload Tradebook</Button>
            <Button variant="secondary" onPress={() => navigate('/uploads?mode=prices')}>Add Monthly Prices</Button>
            <Button variant="secondary" onPress={() => navigate(`/tax?tab=fa&year=${currentYear}`)}>Generate FA for current year</Button>
          </>
        }
      />

      <div className={pageMetricGridStyle}>
        {[
          ['Indian Holdings Value', formatMoney(summary.indian)],
          ['Foreign Holdings Value', formatMoney(summary.foreign)],
          ['Dividends received YTD', formatMoney(summary.dividends)],
          ['FA reportable assets', String(summary.faReportable)],
        ].map(([label, value]) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </div>

      <div className={pageTwoColumnGridStyle}>
        <Panel>
          <SectionTitle title="Recent activity" subtitle="Latest imports from the files vault." />
          {recentFiles.length === 0 ? (
            <EmptyState
              title="No imports yet"
              description="Upload a tradebook or try one of the sample files to populate your files vault and import history."
              action={<Button variant="accent" onPress={() => navigate('/uploads')}>Go to Uploads</Button>}
              illustration={<EmptyStateIllustrations.upload />}
            />
          ) : (
            <div className={recentListStyle}>
              {recentFiles.map((file) => (
                <div key={file.id} className={recentItemStyle}>
                  <div className={recentItemHeaderStyle}>
                    <div>
                      <Heading level={4}>{file.filename}</Heading>
                      <Text styles={toStyleString(secondaryTextStyle)}>{file.broker} · {formatDateTime(file.importedAt)}</Text>
                    </div>
                    <div className={actionRowStyle}>
                      <StatusBadge value={file.rowsError === 0 ? 'OK' : 'Partial'} />
                      <Text>{file.rowsProcessed} rows</Text>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle title="Asset allocation" subtitle="India vs foreign split by current value." />
          {summary.indian === 0 && summary.foreign === 0 ? (
            <EmptyState title="Nothing priced yet" description="Upload trade data and monthly prices to see allocation charts." illustration={<EmptyStateIllustrations.generic />} />
          ) : (
            <div className={chartShellStyle}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.allocation} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={3}>
                    {summary.allocation.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(typeof value === 'number' ? value : undefined)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <SectionTitle title="Backup and export" subtitle="Keep a portable copy of everything stored on this device." />
        <div className={actionRowStyle}>
          <Button variant="accent" onPress={() => { void exportBackupFile() }}>Export full backup</Button>
          <Button variant="secondary" onPress={exportItr}>Export ITR JSON</Button>
          <Button variant="secondary" onPress={() => navigate('/tax')}>Open Tax schedules</Button>
        </div>
      </Panel>
    </div>
  )
}
