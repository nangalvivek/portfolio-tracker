import {useEffect, useMemo, useState} from 'react'
import {Button, Cell, Column, DropZone, FileTrigger, Heading, Row, StatusLight, TableBody, TableHeader, TableView, Text} from '@react-spectrum/s2'
import {style, space} from '@react-spectrum/s2/style' with {type: 'macro'}
import {useSearchParams} from 'react-router-dom'
import {db} from '../db/db'
import {parserRegistry} from '../domain/parsers'
import {importTransactions, previewImportTransactions, type ImportCandidate, type ImportResult} from '../domain/dedupe'
import {parseMonthlyPricesCsv, missingMonthsForSecurity} from '../domain/prices'
import type {MonthlyPrice} from '../domain/types'
import {exportBackup, restoreBackup} from '../domain/export'
import {downloadBlob, downloadText} from '../lib/download'
import {formatDateTime, formatMoney, formatQty} from '../lib/format'
import {usePortfolioData} from '../hooks/usePortfolioData'
import {EmptyState, Panel, PageHeader, SectionTitle, EmptyStateIllustrations, pageStackStyle, pageTwoColumnGridStyle, pageSectionGridStyle, secondaryTextStyle, toStyleString} from '../components/Ui'

type ImportMode = 'trades' | 'prices'
type PreviewTab = 'raw' | 'parsed' | 'duplicates'

interface TradePreviewState {
  fileId: string
  filename: string
  text: string
  blob: Blob
  sha256: string
  candidates: ImportCandidate[]
  preview: ImportResult
}

interface PricePreviewState {
  filename: string
  rows: Array<MonthlyPrice & {warnings: string[]}>
  errors: string[]
}

const tradeSamples = [
  {name: 'Zerodha tradebook sample', file: 'samples/zerodha-tradebook.csv'},
  {name: 'IBKR flex trades sample', file: 'samples/ibkr-flex-trades.csv'},
  {name: 'E*Trade RSU sample', file: 'samples/etrade-rsu.csv'},
] as const

const priceSamples = [{name: 'Monthly prices sample', file: 'samples/monthly-prices.csv'}] as const

const sha256Hex = async (buffer: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const readFile = async (file: File): Promise<{text: string; blob: Blob; sha256: string}> => {
  const [text, buffer] = await Promise.all([file.text(), file.arrayBuffer()])
  return {text, blob: file.slice(0, file.size, file.type || 'text/csv'), sha256: await sha256Hex(buffer)}
}

const splitLines = (text: string): string[] => text.split(/\r?\n/)

const appendBasePath = (file: string): string => `${import.meta.env.BASE_URL}${file}`

const toolbarStyle: string = style({display: 'flex', gap: space(8), flexWrap: 'wrap'})
const centeredDropStyle: string = style({padding: space(24), textAlign: 'center'})
const previewStackStyle: string = style({display: 'grid', gap: space(16)})
const previewGridStyle: string = style({display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', gap: space(12)})
const sampleRowStyle: string = style({display: 'flex', gap: space(8), flexWrap: 'wrap', justifyContent: 'center', marginTop: space(12)})
const rawTextStyle: string = style({whiteSpace: 'pre-wrap', fontFamily: 'code'})
const monoTextStyle: string = style({whiteSpace: 'pre-wrap', fontFamily: 'code'})
const scrollBoxStyle: string = style({display: 'grid', gap: space(8), maxHeight: space(192), overflow: 'auto'})
const actionRowStyle: string = style({display: 'flex', gap: space(8), flexWrap: 'wrap', justifyContent: 'end'})

export const UploadsPage = () => {
  const {files, transactions, securityById} = usePortfolioData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<ImportMode>(searchParams.get('mode') === 'prices' ? 'prices' : 'trades')
  const [tab, setTab] = useState<PreviewTab>('raw')
  const [tradePreview, setTradePreview] = useState<TradePreviewState | null>(null)
  const [pricePreview, setPricePreview] = useState<PricePreviewState | null>(null)
  const [selectedDuplicateIndex, setSelectedDuplicateIndex] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const nextMode = searchParams.get('mode') === 'prices' ? 'prices' : 'trades'
    setMode(nextMode)
  }, [searchParams])

  const fileNames = useMemo(() => new Map(files.map((file) => [file.id, file.filename])), [files])
  const duplicateRows = useMemo(() => tradePreview?.preview.rows.filter((row) => row.status === 'DUPLICATE') ?? [], [tradePreview])
  const parsedPreviewRows = useMemo(() => tradePreview?.preview.rows.map((row, index) => ({row, txn: tradePreview.candidates[index]})) ?? [], [tradePreview])
  const duplicatePreviewRows = useMemo(() => duplicateRows.map((row, index) => ({row, index})), [duplicateRows])
  const rawLines = tradePreview ? splitLines(tradePreview.text) : []
  const importWarnings = tradePreview ? [...tradePreview.preview.rows.map((row) => row.reason)] : []
  const selectedDuplicate = duplicateRows[selectedDuplicateIndex]
  const selectedDuplicateCandidate = tradePreview && selectedDuplicate ? tradePreview.candidates[tradePreview.preview.rows.findIndex((row) => row === selectedDuplicate)] : undefined
  const selectedDuplicateExisting = selectedDuplicate?.existingTxnId ? transactions.find((txn) => txn.id === selectedDuplicate.existingTxnId) : undefined

  const previewTradeFile = async (file: File): Promise<void> => {
    const {text, blob, sha256} = await readFile(file)
    const parsed = parserRegistry.parseImportText(file.name, text)
    const fileId = crypto.randomUUID()
    const candidates = parsed.transactions.map((txn, index) => ({
      ...txn,
      sourceFileId: fileId,
      rawRow: {lineNumber: index + 2, rawText: splitLines(text)[index + 1] ?? ''},
    }))
    const preview = await previewImportTransactions(candidates)
    setTradePreview({fileId, filename: file.name, text, blob, sha256, candidates, preview})
    setSelectedDuplicateIndex(0)
    setTab('parsed')
    setMessage(`Parsed ${parsed.transactions.length} rows from ${file.name}`)
  }

  const previewPriceFile = async (file: File): Promise<void> => {
    const {text} = await readFile(file)
    const parsed = parseMonthlyPricesCsv(text)
    const rows = parsed.rows.map((row) => ({
      ...row,
      id: `${row.securityId}:${row.month}`,
      source: 'MANUAL' as const,
      warnings: missingMonthsForSecurity(transactions, parsed.rows.filter((price) => price.securityId === row.securityId).map((price) => price.month), row.securityId, new Date().getFullYear()),
    }))
    setPricePreview({filename: file.name, rows, errors: parsed.errors})
    setMessage(`Parsed ${rows.length} monthly price rows from ${file.name}`)
  }

  const commitTradeImport = async (): Promise<void> => {
    if (!tradePreview) return
    const parsed = parserRegistry.parseImportText(tradePreview.filename, tradePreview.text)
    await db.transaction('rw', db.securities, db.accounts, db.transactions, db.files, async () => {
      await db.securities.bulkPut(parsed.securities)
      await db.accounts.bulkPut(parsed.accounts)
      await importTransactions(tradePreview.candidates)
      await db.files.put({
        id: tradePreview.fileId,
        filename: tradePreview.filename,
        broker: parsed.broker,
        importedAt: new Date().toISOString(),
        sizeBytes: tradePreview.blob.size,
        sha256: tradePreview.sha256,
        rowsProcessed: tradePreview.preview.counts.processed,
        rowsNew: tradePreview.preview.counts.new,
        rowsDuplicate: tradePreview.preview.counts.duplicate,
        rowsError: tradePreview.preview.counts.error,
        originalBlob: tradePreview.blob,
        rawText: tradePreview.text,
      })
    })
    setMessage(`Committed ${tradePreview.preview.counts.new} new rows and linked ${tradePreview.preview.counts.duplicate} duplicates`)
  }

  const commitPriceImport = async (): Promise<void> => {
    if (!pricePreview) return
    await db.prices.bulkPut(pricePreview.rows)
    setMessage(`Saved ${pricePreview.rows.length} monthly price rows`)
  }

  const restoreFromBackupFile = async (file: File): Promise<void> => {
    const backup = JSON.parse(await file.text()) as Parameters<typeof restoreBackup>[0]
    await restoreBackup(backup)
    setMessage('Backup restored into local IndexedDB')
  }

  const exportBackupFile = async (): Promise<void> => {
    const backup = await exportBackup()
    downloadText(`portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2))
  }

  return (
    <div className={pageStackStyle}>
      <PageHeader
        title="Uploads"
        subtitle="Preview imports before committing them. Sample files are available for quick testing."
        actions={
          <>
            <Button variant={mode === 'trades' ? 'accent' : 'secondary'} onPress={() => { setMode('trades'); setSearchParams({mode: 'trades'}) }}>Trade import</Button>
            <Button variant={mode === 'prices' ? 'accent' : 'secondary'} onPress={() => { setMode('prices'); setSearchParams({mode: 'prices'}) }}>Monthly prices</Button>
            <Button variant="secondary" onPress={() => void exportBackupFile()}>Export full backup</Button>
          </>
        }
      />

      {message ? <Panel><Text>{message}</Text></Panel> : null}

      {mode === 'trades' ? (
        <div className={pageTwoColumnGridStyle}>
          <Panel>
            <SectionTitle title="Import wizard" subtitle="Drop a CSV or choose a sample. Preview first, then commit." />
            <DropZone
              isFilled={!!tradePreview}
              getDropOperation={() => 'copy'}
              onDrop={async (event) => {
                const fileItem = event.items.find((item) => item.kind === 'file')
                if (fileItem) await previewTradeFile(await fileItem.getFile())
              }}
            >
              <div className={centeredDropStyle}>
                <Heading level={4}>Drag and drop a tradebook here</Heading>
                <Text styles={toStyleString(secondaryTextStyle)}>or pick a sample below</Text>
                <div className={sampleRowStyle}>
                  {tradeSamples.map((sample) => (
                    <Button key={sample.file} variant="secondary" onPress={async () => {
                      const response = await fetch(appendBasePath(sample.file))
                      await previewTradeFile(new File([await response.text()], sample.name, {type: 'text/csv'}))
                    }}>{sample.name}</Button>
                  ))}
                </div>
                <FileTrigger acceptedFileTypes={["text/csv"]} onSelect={(files) => { const file = files?.[0]; if (file) void previewTradeFile(file) }}>
                  <Button variant="accent">Browse files</Button>
                </FileTrigger>
              </div>
            </DropZone>

            {tradePreview ? (
              <div className={previewStackStyle}>
                <div className={toolbarStyle}>
                  {(['raw', 'parsed', 'duplicates'] as const).map((item) => (
                    <Button key={item} variant={tab === item ? 'accent' : 'secondary'} onPress={() => setTab(item)}>{item === 'raw' ? 'Raw Preview' : item === 'parsed' ? 'Parsed' : 'Duplicates'}</Button>
                  ))}
                  <Button variant="accent" onPress={() => void commitTradeImport()}>Commit import</Button>
                </div>

                {tab === 'raw' ? (
                  <Panel>
                    <div className={rawTextStyle}>
                      {rawLines.map((line, index) => `${String(index + 1).padStart(3, ' ')}  ${line}`).join('\n')}
                    </div>
                  </Panel>
                ) : null}

                {tab === 'parsed' ? (
                  <TableView aria-label="Parsed trades" density="compact">
                    <TableHeader>
                      <Column>Line</Column>
                      <Column>Date</Column>
                      <Column>Symbol</Column>
                      <Column>Type</Column>
                      <Column align="end">Qty</Column>
                      <Column align="end">Price</Column>
                      <Column>Status</Column>
                    </TableHeader>
                    <TableBody items={parsedPreviewRows}>
                      {({row, txn}) => {
                        const security = txn ? securityById.get(txn.securityId) : undefined
                        return (
                          <Row key={`${row.lineNumber}-${txn?.securityId ?? 'unknown'}`}>
                            <Cell>{row.lineNumber}</Cell>
                            <Cell>{txn?.date ?? '—'}</Cell>
                            <Cell>{security?.symbol ?? txn?.securityId ?? '—'}</Cell>
                            <Cell>{txn?.type ?? '—'}</Cell>
                            <Cell>{formatQty(txn?.quantity)}</Cell>
                            <Cell>{formatMoney(txn?.price)}</Cell>
                            <Cell><StatusLight variant={row.status === 'NEW' ? 'positive' : row.status === 'DUPLICATE' ? 'notice' : 'negative'}>{row.status}</StatusLight></Cell>
                          </Row>
                        )
                      }}
                    </TableBody>
                  </TableView>
                ) : null}

                {tab === 'duplicates' ? (
                  duplicateRows.length === 0 ? (
                    <EmptyState title="No duplicates detected" description="This file does not match an existing transaction hash." illustration={<EmptyStateIllustrations.generic />} />
                  ) : (
                    <div className={previewStackStyle}>
                      <TableView aria-label="Duplicate rows" density="compact">
                        <TableHeader>
                          <Column>Line</Column>
                          <Column>Existing transaction</Column>
                          <Column>Action</Column>
                        </TableHeader>
                        <TableBody items={duplicatePreviewRows}>
                          {({row, index}) => (
                            <Row key={`${row.lineNumber}-${row.existingTxnId}`}>
                              <Cell>{row.lineNumber}</Cell>
                              <Cell>{row.existingTxnId}</Cell>
                              <Cell><Button variant="secondary" onPress={() => setSelectedDuplicateIndex(index)}>View details</Button></Cell>
                            </Row>
                          )}
                        </TableBody>
                      </TableView>
                      {selectedDuplicate && tradePreview ? (
                        <div className={previewGridStyle}>
                          <Panel>
                            <Heading level={4}>Incoming row</Heading>
                            <Text styles={toStyleString(monoTextStyle)}>{selectedDuplicateCandidate?.rawRow.rawText}</Text>
                          </Panel>
                          <Panel>
                            <Heading level={4}>Matched existing txn</Heading>
                            <Text>{selectedDuplicateExisting?.securityId}</Text>
                            <Text>{selectedDuplicateExisting?.date} · {selectedDuplicateExisting?.type} · {formatQty(selectedDuplicateExisting?.quantity)}</Text>
                            <Text styles={toStyleString(secondaryTextStyle)}>Files: {(selectedDuplicateExisting?.sourceFileIds ?? []).map((fileId) => fileNames.get(fileId) ?? fileId).join(', ')}</Text>
                          </Panel>
                        </div>
                      ) : null}
                    </div>
                  )
                ) : null}

                {importWarnings.length > 0 ? (
                  <Panel>
                    <SectionTitle title="Import log" subtitle="Reasons and warnings collected during preview." />
                    <div className={scrollBoxStyle}>
                      {importWarnings.map((warning, index) => <Text key={`${warning}-${index}`}>• {warning}</Text>)}
                    </div>
                  </Panel>
                ) : null}
              </div>
            ) : (
              <EmptyState title="Preview an import" description="Choose a sample file or upload your own tradebook to see parsing, dedupe, and commit controls." illustration={<EmptyStateIllustrations.upload />} />
            )}
          </Panel>

          <div className={pageSectionGridStyle}>
            <Panel>
              <SectionTitle title="Document vault" subtitle="Original imports stored as Blobs for audit and download." />
              {files.length === 0 ? (
                <EmptyState
                  title="No documents yet"
                  description="Committed imports appear here."
                  illustration={<EmptyStateIllustrations.upload />}
                  action={<Button variant="accent" onPress={() => { setMode('trades'); setSearchParams({mode: 'trades'}) }}>Upload tradebook</Button>}
                />
              ) : (
                <TableView aria-label="Documents" density="compact">
                  <TableHeader>
                    <Column>Filename</Column>
                    <Column>Broker</Column>
                    <Column>Import date</Column>
                    <Column align="end">Size</Column>
                    <Column>Action</Column>
                  </TableHeader>
                  <TableBody items={files}>
                    {(file) => (
                      <Row key={file.id}>
                        <Cell>{file.filename}</Cell>
                        <Cell>{file.broker}</Cell>
                        <Cell>{formatDateTime(file.importedAt)}</Cell>
                        <Cell>{file.sizeBytes.toLocaleString()}</Cell>
                        <Cell><Button variant="secondary" onPress={() => downloadBlob(file.filename, file.originalBlob)}>Download original</Button></Cell>
                      </Row>
                    )}
                  </TableBody>
                </TableView>
              )}
            </Panel>

            <Panel>
              <SectionTitle title="Monthly prices" subtitle="Upload price CSVs to drive current value and tax valuation." />
              <DropZone
                isFilled={!!pricePreview}
                getDropOperation={() => 'copy'}
                onDrop={async (event) => {
                  const fileItem = event.items.find((item) => item.kind === 'file')
                  if (fileItem) await previewPriceFile(await fileItem.getFile())
                }}
              >
                <div className={centeredDropStyle}>
                  <Heading level={4}>Drop monthly prices here</Heading>
                  <Text styles={toStyleString(secondaryTextStyle)}>or pick the sample file below</Text>
                  <div className={sampleRowStyle}>
                    {priceSamples.map((sample) => (
                      <Button key={sample.file} variant="secondary" onPress={async () => {
                        const response = await fetch(appendBasePath(sample.file))
                        await previewPriceFile(new File([await response.text()], sample.name, {type: 'text/csv'}))
                      }}>{sample.name}</Button>
                    ))}
                  </div>
                  <FileTrigger acceptedFileTypes={["text/csv"]} onSelect={(files) => { const file = files?.[0]; if (file) void previewPriceFile(file) }}>
                    <Button variant="accent">Browse files</Button>
                  </FileTrigger>
                </div>
              </DropZone>

              {pricePreview ? (
                <div className={previewStackStyle}>
                  <Button variant="accent" onPress={() => void commitPriceImport()}>Save prices</Button>
                  {pricePreview.errors.length > 0 ? <Panel><Text>{pricePreview.errors.join(' · ')}</Text></Panel> : null}
                  <TableView aria-label="Monthly prices" density="compact">
                    <TableHeader>
                      <Column>Security</Column>
                      <Column>Month</Column>
                      <Column align="end">Price</Column>
                      <Column>Currency</Column>
                      <Column align="end">FX</Column>
                    </TableHeader>
                    <TableBody items={pricePreview.rows}>
                      {(row) => (
                        <Row key={row.id}>
                          <Cell>{row.securityId}</Cell>
                          <Cell>{row.month}</Cell>
                          <Cell>{row.price}</Cell>
                          <Cell>{row.currency}</Cell>
                          <Cell>{row.fxRate}</Cell>
                        </Row>
                      )}
                    </TableBody>
                  </TableView>
                </div>
              ) : (
                <EmptyState
                  title="No price file yet"
                  description="Upload monthly prices to power current value, peak FA, and tax calculations."
                  illustration={<EmptyStateIllustrations.upload />}
                  action={<Button variant="accent" onPress={() => { setMode('prices'); setSearchParams({mode: 'prices'}) }}>Add monthly prices</Button>}
                />
              )}
            </Panel>

            <Panel>
              <SectionTitle title="Restore from backup" subtitle="Choose a JSON backup to wipe and reload local tables." />
              <div className={actionRowStyle}>
                <FileTrigger acceptedFileTypes={["application/json"]} onSelect={(files) => { const file = files?.[0]; if (file) void restoreFromBackupFile(file) }}>
                  <Button variant="secondary">Restore backup</Button>
                </FileTrigger>
                <Button variant="secondary" onPress={() => void exportBackupFile()}>Export full backup</Button>
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <Panel>
          <SectionTitle title="Monthly prices" subtitle="Upload the monthly price CSV from the toolbar above." />
          <EmptyState title="Switch to Monthly prices" description="Use the Monthly prices button to open the price upload workspace." illustration={<EmptyStateIllustrations.upload />} />
        </Panel>
      )}
    </div>
  )
}
