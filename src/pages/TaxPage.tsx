import {useEffect, useMemo, useState} from 'react'
import {Button, Cell, Column, Heading, Picker, PickerItem, Row, TableBody, TableHeader, TableView, Tabs, TabList, Tab, TabPanel} from '@react-spectrum/s2'
import {style, space} from '@react-spectrum/s2/style' with {type: 'macro'}
import {useSearchParams} from 'react-router-dom'
import {usePortfolioData} from '../hooks/usePortfolioData'
import {scheduleFa} from '../domain/tax/fa'
import {scheduleFsi} from '../domain/tax/fsi'
import {scheduleTr} from '../domain/tax/tr'
import {scheduleCg, type ScheduleCgRow} from '../domain/tax/cg'
import {buildItrBundle} from '../domain/export/itr'
import {toCsv} from '../domain/export'
import {downloadText} from '../lib/download'
import {formatDate, formatMoney, formatQty} from '../lib/format'
import {useTaxYear} from '../app/taxYearContext'
import {EmptyState, Panel, PageHeader, SectionTitle, MetricCard, EmptyStateIllustrations, pageSectionGridStyle} from '../components/Ui'

type TabKey = 'fa' | 'fsi' | 'tr' | 'cg'

const tabLabels: Record<TabKey, string> = {
  fa: 'FA – A3',
  fsi: 'FSI',
  tr: 'TR',
  cg: 'CG',
}

const years = Array.from({length: 10}, (_, index) => new Date().getFullYear() - index)
const fyLabel = (year: number): string => `FY ${year - 1}-${String(year).slice(-2)}`

const yearPickerRingStyle: string = style({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 'lg',
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: 'accent-900',
  paddingX: space(8),
  paddingY: space(2)
})

const taxPageStackStyle: string = style({display: 'grid', gap: space(24)})
const cgGridStyle: string = style({display: 'grid', gap: space(20)})
const cgMetricGridStyle: string = style({display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: space(12)})

export const TaxPage = () => {
  const {taxYear, setTaxYear} = useTaxYear()
  const {transactions, prices} = usePortfolioData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<TabKey>((searchParams.get('tab') as TabKey) ?? 'fa')
  const [selectedFaId, setSelectedFaId] = useState('')

  useEffect(() => {
    const queryYear = Number(searchParams.get('year'))
    if (Number.isFinite(queryYear) && queryYear > 2000) setTaxYear(queryYear)
    const queryTab = searchParams.get('tab') as TabKey | null
    if (queryTab && queryTab in tabLabels) setTab(queryTab)
  }, [searchParams, setTaxYear])

  const faRows = useMemo(() => scheduleFa(transactions, prices, taxYear), [prices, taxYear, transactions])
  const fsiRows = useMemo(() => scheduleFsi(transactions, taxYear), [taxYear, transactions])
  const trRows = useMemo(() => scheduleTr(fsiRows), [fsiRows])
  const cgResult = useMemo(() => scheduleCg(transactions, `FY${taxYear - 1}-${String(taxYear).slice(-2)}`), [taxYear, transactions])
  const bundle = useMemo(() => buildItrBundle(transactions, prices, taxYear), [prices, taxYear, transactions])

  useEffect(() => {
    if (!selectedFaId && faRows[0]) setSelectedFaId(faRows[0].securityId)
    if (selectedFaId && !faRows.some((row) => row.securityId === selectedFaId)) setSelectedFaId(faRows[0]?.securityId ?? '')
  }, [faRows, selectedFaId])

  const selectedFaRow = faRows.find((row) => row.securityId === selectedFaId)

  const exportCurrent = (kind: 'csv' | 'json') => {
    const payload = tab === 'fa' ? faRows : tab === 'fsi' ? fsiRows : tab === 'tr' ? trRows : cgResult.rows
    const filename = `${tab}-${taxYear}.${kind}`
    if (kind === 'json') downloadText(filename, JSON.stringify(payload, null, 2))
    if (kind === 'csv') downloadText(filename, toCsv(payload as unknown as Array<Record<string, unknown>>), 'text/csv')
  }

  return (
    <div className={taxPageStackStyle}>
      <PageHeader
        title="Tax"
        titleAdornment={
          <div className={yearPickerRingStyle}>
            <Picker aria-label="Financial year" isQuiet size="XL" selectedKey={String(taxYear)} onSelectionChange={(key) => setTaxYear(Number(key))}>
              {years.map((year) => <PickerItem key={String(year)} id={String(year)} textValue={fyLabel(year)}>{fyLabel(year)}</PickerItem>)}
            </Picker>
          </div>
        }
        actions={
          <>
            <Button variant="secondary" onPress={() => exportCurrent('csv')}>Export CSV</Button>
            <Button variant="accent" onPress={() => exportCurrent('json')}>Export JSON</Button>
            <Button variant="secondary" onPress={() => downloadText(`itr-${taxYear}-bundle.json`, JSON.stringify(bundle, null, 2))}>Export ITR JSON bundle</Button>
          </>
        }
      />

      <Tabs aria-label="Tax schedules" selectedKey={tab} onSelectionChange={(key) => { const next = key as TabKey; setTab(next); setSearchParams({tab: next, year: String(taxYear)}) }}>
        <TabList aria-label="Tax schedules">
          {(Object.entries(tabLabels) as Array<[TabKey, string]>).map(([key, label]) => <Tab key={key}>{label}</Tab>) }
        </TabList>

        <TabPanel id="fa">
          <Panel>
            <SectionTitle title={`FA – A3 (${taxYear})`} subtitle="Foreign assets held during the calendar year." />
            {faRows.length === 0 ? (
              <EmptyState title="No FA rows yet" description="Foreign securities held during the selected calendar year will appear here." illustration={<EmptyStateIllustrations.generic />} />
            ) : (
              <div className={pageSectionGridStyle}>
                <TableView aria-label="FA schedule" density="compact">
                  <TableHeader>
                    <Column>Country</Column>
                    <Column>Entity Name</Column>
                    <Column>Nature of Asset</Column>
                    <Column>Date of Acquisition</Column>
                    <Column align="end">Initial Investment INR</Column>
                    <Column align="end">Peak Value During Year INR</Column>
                    <Column align="end">Closing Value INR</Column>
                    <Column align="end">Gross Income INR</Column>
                    <Column>Action</Column>
                  </TableHeader>
                  <TableBody items={faRows}>
                    {(row) => (
                      <Row key={row.securityId}>
                        <Cell>{row.country}</Cell>
                        <Cell>{row.entityName}</Cell>
                        <Cell>{row.natureOfAsset}</Cell>
                        <Cell>{formatDate(row.dateOfAcquisition)}</Cell>
                        <Cell>{formatMoney(row.initialInvestmentInr)}</Cell>
                        <Cell>{formatMoney(row.peakValueDuringYearInr)}</Cell>
                        <Cell>{formatMoney(row.closingValueInr)}</Cell>
                        <Cell>{formatMoney(row.grossIncomeInr)}</Cell>
                        <Cell><Button variant="secondary" onPress={() => setSelectedFaId(row.securityId)}>Monthly view</Button></Cell>
                      </Row>
                    )}
                  </TableBody>
                </TableView>
                {selectedFaRow ? (
                  <Panel>
                    <Heading level={4}>Monthly prices used to compute the peak</Heading>
                    <TableView aria-label="FA monthly price series" density="compact">
                      <TableHeader>
                        <Column>Month</Column>
                        <Column align="end">Held qty</Column>
                        <Column align="end">Price native</Column>
                        <Column align="end">FX</Column>
                        <Column align="end">Price INR</Column>
                        <Column align="end">Value INR</Column>
                      </TableHeader>
                      <TableBody items={selectedFaRow.monthlyPriceSeries}>
                        {(point) => (
                          <Row key={point.month}>
                            <Cell>{point.month}</Cell>
                            <Cell>{point.heldQty}</Cell>
                            <Cell>{point.priceNative}</Cell>
                            <Cell>{point.fxRate}</Cell>
                            <Cell>{formatMoney(point.priceInr)}</Cell>
                            <Cell>{formatMoney(point.valueInr)}</Cell>
                          </Row>
                        )}
                      </TableBody>
                    </TableView>
                  </Panel>
                ) : null}
              </div>
            )}
          </Panel>
        </TabPanel>

        <TabPanel id="fsi">
          <Panel>
            <SectionTitle title={`FSI (${taxYear})`} subtitle="Foreign dividends grouped by country." />
            {fsiRows.length === 0 ? (
              <EmptyState title="No FSI rows yet" description="Dividend transactions in the selected calendar year will appear here." illustration={<EmptyStateIllustrations.generic />} />
            ) : (
              <TableView aria-label="FSI schedule" density="compact">
                <TableHeader>
                  <Column>Country</Column>
                  <Column align="end">Income INR</Column>
                  <Column align="end">Tax paid abroad INR</Column>
                  <Column>DTAA article</Column>
                  <Column>Security IDs</Column>
                </TableHeader>
                <TableBody items={fsiRows}>
                  {(row) => (
                    <Row key={row.country}>
                      <Cell>{row.country}</Cell>
                      <Cell>{formatMoney(row.incomeInr)}</Cell>
                      <Cell>{formatMoney(row.taxPaidAbroadInr)}</Cell>
                      <Cell>{row.dtaaArticle}</Cell>
                      <Cell>{row.securityIds.join(', ')}</Cell>
                    </Row>
                  )}
                </TableBody>
              </TableView>
            )}
          </Panel>
        </TabPanel>

        <TabPanel id="tr">
          <Panel>
            <SectionTitle title={`TR (${taxYear})`} subtitle="Foreign tax credit relief summary." />
            {trRows.length === 0 ? (
              <EmptyState title="No TR rows yet" description="Foreign tax paid will be summarized here based on FSI rows." illustration={<EmptyStateIllustrations.generic />} />
            ) : (
              <TableView aria-label="TR schedule" density="compact">
                <TableHeader>
                  <Column>Country</Column>
                  <Column align="end">Foreign tax paid INR</Column>
                  <Column align="end">Relief claimed INR</Column>
                </TableHeader>
                <TableBody items={trRows}>
                  {(row) => (
                    <Row key={row.country}>
                      <Cell>{row.country}</Cell>
                      <Cell>{formatMoney(row.foreignTaxPaidInr)}</Cell>
                      <Cell>{formatMoney(row.reliefClaimedInr)}</Cell>
                    </Row>
                  )}
                </TableBody>
              </TableView>
            )}
          </Panel>
        </TabPanel>

        <TabPanel id="cg">
          <div className={cgGridStyle}>
            <Panel>
              <SectionTitle title={`CG (${cgResult.rows[0]?.fy ?? `FY${taxYear - 1}-${String(taxYear).slice(-2)}`})`} subtitle="Capital gains for the selected financial year." />
              <div className={cgMetricGridStyle}>
                {[
                  ['STCG India', formatMoney(cgResult.totals.stcgIndia)],
                  ['LTCG India', formatMoney(cgResult.totals.ltcgIndia)],
                  ['STCG Foreign', formatMoney(cgResult.totals.stcgForeign)],
                  ['LTCG Foreign', formatMoney(cgResult.totals.ltcgForeign)],
                ].map(([label, value]) => (
                  <MetricCard key={label} label={String(label)} value={String(value)} />
                ))}
              </div>
            </Panel>

            {(['STCG', 'LTCG'] as const).map((term) => {
              const rows = cgResult.rows.filter((row) => row.term === term)
              return (
                <Panel key={term}>
                  <SectionTitle title={`${term} rows`} subtitle="Per-sell rows split by lot classification." />
                  {rows.length === 0 ? (
                    <EmptyState title={`No ${term} rows`} description={`No ${term} disposals were realized in this financial year.`} illustration={<EmptyStateIllustrations.generic />} />
                  ) : (
                    <TableView aria-label={`${term} capital gains`} density="compact">
                      <TableHeader>
                        <Column>Sell date</Column>
                        <Column>Security</Column>
                        <Column>Country</Column>
                        <Column align="end">Qty</Column>
                        <Column align="end">Proceeds INR</Column>
                        <Column align="end">Cost INR</Column>
                        <Column align="end">Gain INR</Column>
                        <Column>Holding days</Column>
                      </TableHeader>
                      <TableBody items={rows}>
                        {(row: ScheduleCgRow) => (
                          <Row key={`${row.securityId}-${row.sellDate}-${row.accountId}`}>
                            <Cell>{row.sellDate}</Cell>
                            <Cell>{row.securityId}</Cell>
                            <Cell>{row.country}</Cell>
                            <Cell>{formatQty(row.sellQuantity)}</Cell>
                            <Cell>{formatMoney(row.proceedsInr)}</Cell>
                            <Cell>{formatMoney(row.costInr)}</Cell>
                            <Cell>{formatMoney(row.gainInr)}</Cell>
                            <Cell>{row.holdingPeriodDays}</Cell>
                          </Row>
                        )}
                      </TableBody>
                    </TableView>
                  )}
                </Panel>
              )
            })}
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
}
