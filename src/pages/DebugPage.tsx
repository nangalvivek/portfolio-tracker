import {useMemo, useState} from 'react'
import {Button, Cell, Column, Heading, NumberField, Picker, PickerItem, Row, SearchField, StatusLight, TableBody, TableHeader, TableView, Text, TextField} from '@react-spectrum/s2'
import {style, space} from '@react-spectrum/s2/style' with {type: 'macro'}
import {usePortfolioData} from '../hooks/usePortfolioData'
import {computeDedupeHash} from '../domain/dedupe'
import {fifoTrace} from '../domain/fifo'
import {downloadText} from '../lib/download'
import {formatDateTime, formatMoney, formatQty} from '../lib/format'
import {EmptyState, Panel, PageHeader, SectionTitle, EmptyStateIllustrations, pageStackStyle, pageTwoColumnGridStyle, secondaryTextStyle, toStyleString} from '../components/Ui'

const categories = ['ALL', 'IMPORT', 'DEDUPE', 'FIFO', 'PRICE', 'ERROR', 'SYSTEM'] as const

type CategoryFilter = (typeof categories)[number]

type HashForm = {
  securityId: string
  accountId: string
  date: string
  type: 'BUY' | 'SELL' | 'VEST' | 'DIVIDEND' | 'SPLIT' | 'BONUS'
  quantity: number
  price: number
}

const formGridStyle: string = style({display: 'grid', gap: space(12)})
const tagListStyle: string = style({display: 'grid', gap: space(12), marginTop: space(12)})
const detailStackStyle: string = style({display: 'grid', gap: space(12), marginTop: space(12)})
const monoTextStyle: string = style({whiteSpace: 'pre-wrap', fontFamily: 'code'})

export const DebugPage = () => {
  const {logs, transactions, files, securityById} = usePortfolioData()
  const [filter, setFilter] = useState<CategoryFilter>('ALL')
  const [search, setSearch] = useState('')
  const [hashForm, setHashForm] = useState<HashForm>({securityId: '', accountId: '', date: '', type: 'BUY', quantity: 1, price: 1})
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
  const sellTxns = transactions.filter((txn) => txn.type === 'SELL')
  const trace = selectedSellId ? fifoTrace(transactions, selectedSellId) : {steps: []}

  const canonicalKey = `${hashForm.securityId}|${hashForm.accountId}|${hashForm.date}|${hashForm.type}|${hashForm.quantity.toFixed(4)}|${hashForm.price.toFixed(2)}`
  const dedupeHash = useMemo(() => {
    if (!hashForm.securityId || !hashForm.accountId || !hashForm.date) return ''
    return computeDedupeHash(hashForm)
  }, [hashForm])

  return (
    <div className={pageStackStyle}>
      <PageHeader title="Debug" subtitle="Inspect logs, verify hashes, and trace FIFO lot consumption." />

      <div className={pageTwoColumnGridStyle}>
        <Panel>
          <SectionTitle
            title="System log"
            subtitle="Newest first, with category filters and export."
            actions={
              <>
                <Button variant="secondary" onPress={() => downloadText('logs.json', JSON.stringify(filteredLogs, null, 2))}>Export log JSON</Button>
                <Button variant="secondary" onPress={() => downloadText('logs.csv', ['ts,category,message', ...filteredLogs.map((log) => `${log.ts},${log.category},${JSON.stringify(log.message)}`)].join('\n'), 'text/csv')}>Export log CSV</Button>
              </>
            }
          />
          <Picker aria-label="Log category" selectedKey={filter} onSelectionChange={(key) => setFilter(key as CategoryFilter)}>
            {categories.map((category) => <PickerItem key={category}>{category}</PickerItem>)}
          </Picker>
          {filteredLogs.length === 0 ? (
            <EmptyState title="No logs yet" description="Imports, dedupe actions, FIFO traces, and validation errors will appear here." illustration={<EmptyStateIllustrations.generic />} />
          ) : (
            <TableView aria-label="System log" density="compact">
              <TableHeader>
                <Column>Timestamp</Column>
                <Column>Category</Column>
                <Column>Message</Column>
              </TableHeader>
              <TableBody items={filteredLogs}>
                {(log) => (
                  <Row key={log.id}>
                    <Cell>{formatDateTime(log.ts)}</Cell>
                    <Cell><StatusLight variant={log.category === 'ERROR' ? 'negative' : log.category === 'DEDUPE' ? 'notice' : 'informative'}>{log.category}</StatusLight></Cell>
                    <Cell>{log.message}</Cell>
                  </Row>
                )}
              </TableBody>
            </TableView>
          )}
        </Panel>

        <Panel>
          <SectionTitle title="Transaction inspector" subtitle="Search by symbol or date and inspect source documents." />
          <SearchField label="Search transactions" description="Search by date or symbol" value={search} onChange={setSearch} />
          {searchResults.length === 0 ? (
            <EmptyState title="No results" description="Enter a date or symbol to inspect transaction source rows." illustration={<EmptyStateIllustrations.search />} />
          ) : (
            <div className={tagListStyle}>
              {searchResults.map((txn) => (
                <Button key={txn.id} variant={txn.id === selectedTxn?.id ? 'accent' : 'secondary'} onPress={() => setSelectedTxnId(txn.id)}>
                  {securityById.get(txn.securityId)?.symbol ?? txn.securityId} · {txn.date} · {txn.type}
                </Button>
              ))}
            </div>
          )}

          {selectedTxn ? (
            <Panel>
              <Heading level={4}>Transaction details</Heading>
              <Text>{selectedTxn.securityId}</Text>
              <Text>{selectedTxn.date} · Qty {formatQty(selectedTxn.quantity)} · Price {formatMoney(selectedTxn.price)}</Text>
              <Text styles={toStyleString(secondaryTextStyle)}>Source files: {(selectedTxn.sourceFileIds ?? []).map((fileId) => files.find((file) => file.id === fileId)?.filename ?? fileId).join(', ')}</Text>
              <div className={detailStackStyle}>
                {selectedTxn.rawRowRefs.map((ref) => (
                  <Panel key={`${ref.fileId}-${ref.lineNumber}`}>
                    <Text>{files.find((file) => file.id === ref.fileId)?.filename ?? ref.fileId} · line {ref.lineNumber}</Text>
                    <Text styles={toStyleString(monoTextStyle)}>{ref.rawText}</Text>
                  </Panel>
                ))}
              </div>
            </Panel>
          ) : null}
        </Panel>
      </div>

      <div className={pageTwoColumnGridStyle}>
        <Panel>
          <SectionTitle title="Hash checker" subtitle="Uses the same dedupe hash algorithm as imports." />
          <div className={formGridStyle}>
            <TextField label="Security ID" value={hashForm.securityId} onChange={(value) => setHashForm((current) => ({...current, securityId: value}))} />
            <TextField label="Account ID" value={hashForm.accountId} onChange={(value) => setHashForm((current) => ({...current, accountId: value}))} />
            <TextField label="Date" value={hashForm.date} onChange={(value) => setHashForm((current) => ({...current, date: value}))} />
            <Picker label="Type" selectedKey={hashForm.type} onSelectionChange={(key) => setHashForm((current) => ({...current, type: String(key) as HashForm['type']}))}>
              {(['BUY', 'SELL', 'VEST', 'DIVIDEND', 'SPLIT', 'BONUS'] as const).map((type) => <PickerItem key={type}>{type}</PickerItem>)}
            </Picker>
            <NumberField label="Quantity" value={hashForm.quantity} onChange={(value) => setHashForm((current) => ({...current, quantity: value ?? 0}))} />
            <NumberField label="Price" value={hashForm.price} onChange={(value) => setHashForm((current) => ({...current, price: value ?? 0}))} />
          </div>
          <Panel>
            <Text>Canonical key</Text>
            <Heading level={4}>{canonicalKey}</Heading>
            <Text>Dedupe hash</Text>
            <Heading level={4}>{dedupeHash || '—'}</Heading>
          </Panel>
        </Panel>

        <Panel>
          <SectionTitle title="FIFO trace" subtitle="Pick a sell transaction to see lot consumption step-by-step." />
          {sellTxns.length === 0 ? (
            <EmptyState title="No sell transactions yet" description="Add sell rows to inspect FIFO trace output." illustration={<EmptyStateIllustrations.generic />} />
          ) : (
            <>
              <Picker aria-label="Sell transaction" selectedKey={selectedSellId} onSelectionChange={(key) => setSelectedSellId(String(key))} items={sellTxns}>
                {(txn) => <PickerItem key={txn.id}>{securityById.get(txn.securityId)?.symbol ?? txn.securityId} · {txn.date} · {formatQty(txn.quantity)}</PickerItem>}
              </Picker>
              {trace.steps.length === 0 ? (
                <EmptyState title="Choose a sell transaction" description="FIFO lot consumption details will appear here." illustration={<EmptyStateIllustrations.generic />} />
              ) : (
                <TableView aria-label="FIFO trace" density="compact">
                  <TableHeader>
                    <Column>Buy date</Column>
                    <Column align="end">Qty taken</Column>
                    <Column align="end">Cost</Column>
                    <Column align="end">Proceeds</Column>
                    <Column>Term</Column>
                    <Column align="end">Holding days</Column>
                  </TableHeader>
                  <TableBody items={trace.steps}>
                    {(step) => (
                      <Row key={`${step.buyDate}-${step.qtyTaken}-${step.remainingLotQty}`}>
                        <Cell>{step.buyDate}</Cell>
                        <Cell>{formatQty(step.qtyTaken)}</Cell>
                        <Cell>{formatMoney(step.costInr)}</Cell>
                        <Cell>{formatMoney(step.proceedsInr)}</Cell>
                        <Cell>{step.term}</Cell>
                        <Cell>{step.holdingPeriodDays}</Cell>
                      </Row>
                    )}
                  </TableBody>
                </TableView>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
