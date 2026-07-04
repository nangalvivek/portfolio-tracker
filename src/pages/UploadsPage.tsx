import { useMemo, useRef, useState } from 'react'
import { db } from '../db/db'
import { parserRegistry, type ParsedImport } from '../domain/parsers'
import { importTransactions, previewImportTransactions, type ImportCandidate, type ImportResult } from '../domain/dedupe'
import { parseMonthlyPricesCsv, missingMonthsForSecurity } from '../domain/prices'
import type { Account, MonthlyPrice, Security, Transaction } from '../domain/types'
import { downloadBlob } from '../lib/download'
import { formatDateTime, formatMoney, formatQty } from '../lib/format'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../components/Ui'

const tradeSamples = [
  { name: 'Zerodha tradebook sample', file: '/samples/zerodha-tradebook.csv' },
  { name: 'IBKR flex trades sample', file: '/samples/ibkr-flex-trades.csv' },
  { name: 'E*Trade RSU sample', file: '/samples/etrade-rsu.csv' },
]

const priceSamples = [{ name: 'Monthly prices sample', file: '/samples/monthly-prices.csv' }]

type ImportMode = 'trades' | 'prices'
type ViewMode = 'raw' | 'parsed' | 'duplicates'

interface TradePreviewState {
  fileId: string
  filename: string
  text: string
  blob: Blob
  sha256: string
  parsed: ParsedImport
  candidates: ImportCandidate[]
  preview: ImportResult
}

interface PricePreviewState {
  filename: string
  text: string
  rows: Array<MonthlyPrice & { warnings: string[] }>
  warnings: string[]
}

const sha256Hex = async (buffer: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const readFile = async (file: File): Promise<{ text: string; sha256: string; blob: Blob }> => {
  const [text, buffer] = await Promise.all([file.text(), file.arrayBuffer()])
  return { text, sha256: await sha256Hex(buffer), blob: file.slice(0, file.size, file.type || 'text/csv') }
}

const splitLines = (text: string): string[] => text.split(/\r?\n/)

const candidateRowsFromParsed = (fileId: string, text: string, parsed: ParsedImport): ImportCandidate[] => {
  const lines = splitLines(text)
  return parsed.transactions.map((txn, index) => ({
    ...txn,
    sourceFileId: fileId,
    rawRow: {
      lineNumber: index + 2,
      rawText: lines[index + 1] ?? '',
    },
  }))
}

const upsertSecurityAccounts = async (parsed: ParsedImport): Promise<void> => {
  await db.transaction('rw', [db.securities, db.accounts], async () => {
    await db.securities.bulkPut(parsed.securities)
    await db.accounts.bulkPut(parsed.accounts)
  })
}

const fileNameById = (files: Array<{ id: string; filename: string }>): Map<string, string> => new Map(files.map((file) => [file.id, file.filename]))

export const UploadsPage = () => {
  const { files, transactions, securityById } = usePortfolioData()
  const [mode, setMode] = useState<ImportMode>('trades')
  const [view, setView] = useState<ViewMode>('raw')
  const [tradePreview, setTradePreview] = useState<TradePreviewState | null>(null)
  const [pricePreview, setPricePreview] = useState<PricePreviewState | null>(null)
  const [selectedRow, setSelectedRow] = useState<number>(0)
  const [message, setMessage] = useState<string>('')
  const tradeInputRef = useRef<HTMLInputElement | null>(null)
  const priceInputRef = useRef<HTMLInputElement | null>(null)
  const restoreInputRef = useRef<HTMLInputElement | null>(null)

  const fileNames = useMemo(() => fileNameById(files), [files])
  const duplicateRows = useMemo(() => tradePreview?.preview.rows.filter((row) => row.status === 'DUPLICATE') ?? [], [tradePreview])
  const parsedRows = tradePreview?.parsed.transactions ?? []
  const rawLines = tradePreview ? splitLines(tradePreview.text) : []

  const loadTradeFile = async (file: File): Promise<void> => {
    const { text, sha256, blob } = await readFile(file)
    const fileId = crypto.randomUUID()
    const parsed = parserRegistry.parseImportText(file.name, text)
    const candidates = candidateRowsFromParsed(fileId, text, parsed)
    const preview = await previewImportTransactions(candidates)
    setTradePreview({ fileId, filename: file.name, text, blob, sha256, parsed, candidates, preview })
    setView('parsed')
    setSelectedRow(0)
    setMessage(`Parsed ${parsed.transactions.length} transactions from ${file.name}`)
  }

  const loadPriceFile = async (file: File): Promise<void> => {
    const { text } = await readFile(file)
    const parsed = parseMonthlyPricesCsv(text)
    const validRows = parsed.rows.map((row) => ({
      ...row,
      id: `${row.securityId}:${row.month}`,
      source: 'MANUAL' as const,
      warnings: missingMonthsForSecurity(transactions, [row.month], row.securityId, new Date().getFullYear()),
    }))
    setPricePreview({ filename: file.name, text, rows: validRows, warnings: parsed.errors })
    setMessage(`Parsed ${validRows.length} monthly price rows from ${file.name}`)
  }

  const handleTradeCommit = async (): Promise<void> => {
    if (!tradePreview) return
    await upsertSecurityAccounts(tradePreview.parsed)
    await importTransactions(tradePreview.candidates)
    await db.files.put({
      id: tradePreview.fileId,
      filename: tradePreview.filename,
      broker: tradePreview.parsed.broker,
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
    setMessage(`Committed ${tradePreview.preview.counts.new} new and ${tradePreview.preview.counts.duplicate} duplicate rows`)
  }

  const handlePriceCommit = async (): Promise<void> => {
    if (!pricePreview) return
    await db.prices.bulkPut(pricePreview.rows)
    setMessage(`Saved ${pricePreview.rows.length} monthly prices`)
  }

  const restoreFromBackup = async (file: File): Promise<void> => {
    const text = await file.text()
    const backup = JSON.parse(text) as {
      securities: Security[]
      accounts: Account[]
      transactions: Transaction[]
      prices: MonthlyPrice[]
      files: Array<{ id: string; filename: string; broker: string; importedAt: string; sizeBytes: number; sha256: string; rowsProcessed: number; rowsNew: number; rowsDuplicate: number; rowsError: number; rawText?: string }>
      logs: Array<{ id: string; ts: string; category: 'IMPORT' | 'DEDUPE' | 'FIFO' | 'PRICE' | 'ERROR' | 'SYSTEM'; message: string; detail?: unknown }>
    }
    await db.transaction('rw', [db.securities, db.accounts, db.transactions, db.prices, db.files, db.logs], async () => {
      await Promise.all([db.securities.clear(), db.accounts.clear(), db.transactions.clear(), db.prices.clear(), db.files.clear(), db.logs.clear()])
      await db.securities.bulkPut(backup.securities)
      await db.accounts.bulkPut(backup.accounts)
      await db.transactions.bulkPut(backup.transactions)
      await db.prices.bulkPut(backup.prices)
      await db.files.bulkPut(backup.files.map((entry) => ({ ...entry, broker: entry.broker as 'ZERODHA' | 'IBKR' | 'ETRADE' | 'OTHER', originalBlob: new Blob([], { type: 'application/octet-stream' }) })))
      await db.logs.bulkPut(backup.logs)
    })
    setMessage('Restored backup by wiping and reloading local tables')
  }

  const importWarnings = tradePreview ? [...tradePreview.parsed.warnings.map((warning) => warning.reason), ...tradePreview.preview.rows.map((row) => row.reason)] : []

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Uploads"
        subtitle="Preview imports before committing them to IndexedDB. Use the sample files to exercise parsers."
        actions={<div className="flex gap-2"><Button variant={mode === 'trades' ? 'primary' : 'secondary'} onClick={() => setMode('trades')}>Trade import</Button><Button variant={mode === 'prices' ? 'primary' : 'secondary'} onClick={() => setMode('prices')}>Monthly prices</Button></div>}
      />

      {message ? <Card><p className="text-sm text-slate-700">{message}</p></Card> : null}

      {mode === 'trades' ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <SectionTitle title="Import wizard" subtitle="Drop a CSV or pick a sample. Preview first, then commit." />
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={async (event) => {
                event.preventDefault()
                const file = event.dataTransfer.files.item(0)
                if (file) await loadTradeFile(file)
              }}
              onClick={() => tradeInputRef.current?.click()}
            >
              <div className="text-sm font-medium text-slate-900">Drag and drop a tradebook here</div>
              <p className="mt-1 text-sm text-slate-500">or click to browse your device</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {tradeSamples.map((sample) => (
                  <Button key={sample.file} variant="secondary" onClick={async (event) => {
                    event.stopPropagation()
                    const response = await fetch(sample.file)
                    const text = await response.text()
                    await loadTradeFile(new File([text], sample.name, { type: 'text/csv' }))
                  }}>{sample.name}</Button>
                ))}
              </div>
              <input ref={tradeInputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={async (event) => {
                const file = event.target.files?.[0]
                if (file) await loadTradeFile(file)
              }} />
            </div>

            {tradePreview ? (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(['raw', 'parsed', 'duplicates'] as const).map((item) => (
                    <Button key={item} variant={view === item ? 'primary' : 'secondary'} onClick={() => setView(item)}>{item === 'raw' ? 'Raw Preview' : item === 'parsed' ? 'Parsed' : 'Duplicates'}</Button>
                  ))}
                  <Button onClick={() => void handleTradeCommit()}>Commit import</Button>
                </div>

                {view === 'raw' ? (
                  <Card className="bg-slate-50">
                    <pre className="overflow-x-auto text-xs leading-6 text-slate-700">{rawLines.map((line, index) => `${String(index + 1).padStart(3, ' ')}  ${line}`).join('\n')}</pre>
                  </Card>
                ) : null}

                {view === 'parsed' ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Line</th>
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-left font-medium">Symbol</th>
                          <th className="px-3 py-2 text-left font-medium">Type</th>
                          <th className="px-3 py-2 text-right font-medium">Qty</th>
                          <th className="px-3 py-2 text-right font-medium">Price</th>
                          <th className="px-3 py-2 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {tradePreview.preview.rows.map((row, index) => {
                          const transaction = parsedRows[index]
                          const security = transaction ? securityById.get(transaction.securityId) : undefined
                          return (
                            <tr key={`${row.lineNumber}-${index}`} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedRow(index)}>
                              <td className="px-3 py-2">{row.lineNumber}</td>
                              <td className="px-3 py-2">{transaction ? transaction.date : '—'}</td>
                              <td className="px-3 py-2">{security?.symbol ?? transaction?.securityId ?? '—'}</td>
                              <td className="px-3 py-2">{transaction?.type ?? '—'}</td>
                              <td className="px-3 py-2 text-right">{formatQty(transaction?.quantity)}</td>
                              <td className="px-3 py-2 text-right">{formatMoney(transaction?.price)}</td>
                              <td className="px-3 py-2">
                                <Badge tone={row.status === 'NEW' ? 'green' : row.status === 'DUPLICATE' ? 'amber' : 'red'}>{row.status}</Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {view === 'duplicates' ? (
                  duplicateRows.length === 0 ? <EmptyState title="No duplicates detected" description="This import does not match any existing transaction hash." /> : (
                    <div className="space-y-3">
                      {duplicateRows.map((row) => {
                        const index = tradePreview.preview.rows.indexOf(row)
                        const candidate = tradePreview.candidates[index]
                        const existing = tradePreview.preview.rows.find((item) => item.existingTxnId === row.existingTxnId)
                        const existingTxn = existing?.existingTxnId ? transactions.find((txn) => txn.id === existing.existingTxnId) : undefined
                        return (
                          <Card key={`${row.existingTxnId}-${row.lineNumber}`}>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <div className="text-sm font-medium text-slate-900">Incoming row</div>
                                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{candidate?.rawRow.rawText}</pre>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900">Matched existing txn</div>
                                <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                                  <div>{existingTxn?.securityId}</div>
                                  <div>{existingTxn?.date} · {existingTxn?.type} · {formatQty(existingTxn?.quantity)}</div>
                                  <div className="mt-2">Files: {(existingTxn?.sourceFileIds ?? []).map((fileId) => fileNames.get(fileId) ?? fileId).join(', ')}</div>
                                </div>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  )
                ) : null}

                {importWarnings.length > 0 ? (
                  <Card>
                    <SectionTitle title="Import log" subtitle="Warnings and dedupe decisions for this file." />
                    <ul className="space-y-2 text-sm text-slate-600">
                      {importWarnings.map((warning, index) => <li key={`${warning}-${index}`}>• {warning}</li>)}
                    </ul>
                  </Card>
                ) : null}

                {selectedRow >= 0 && tradePreview.preview.rows[selectedRow] ? (
                  <Card>
                    <SectionTitle title="Selected row details" subtitle="Raw row and decision reason." />
                    <div className="grid gap-4 md:grid-cols-2 text-sm">
                      <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{tradePreview.candidates[selectedRow]?.rawRow.rawText ?? ''}</pre>
                      <div className="rounded-xl bg-slate-50 p-3 text-slate-600">
                        <div className="font-medium text-slate-900">Reason</div>
                        <p className="mt-2">{tradePreview.preview.rows[selectedRow]?.reason}</p>
                      </div>
                    </div>
                  </Card>
                ) : null}
              </div>
            ) : (
              <EmptyState title="Preview an import" description="Choose a sample file or upload your own tradebook to see parsing, dedupe, and commit controls." />
            )}
          </Card>

          <Card>
            <SectionTitle title="Document vault" subtitle="Stored imports with a download link for each original file." />
            {files.length === 0 ? (
              <EmptyState title="No documents yet" description="Committed imports appear here with original files stored as Blobs." />
            ) : (
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="font-medium text-slate-900">{file.filename}</div>
                    <div className="mt-1 text-slate-500">{file.broker} · {formatDateTime(file.importedAt)}</div>
                    <div className="mt-1 text-slate-500">{file.sizeBytes.toLocaleString()} bytes</div>
                    <Button
                      className="mt-3"
                      variant="secondary"
                      onClick={() => downloadBlob(file.filename, file.originalBlob)}
                    >
                      Download original
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <SectionTitle title="Monthly prices" subtitle="Upload a CSV with month, security, price, currency, and optional FX rate." />
            <div
              id="prices"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={async (event) => {
                event.preventDefault()
                const file = event.dataTransfer.files.item(0)
                if (file) await loadPriceFile(file)
              }}
              onClick={() => priceInputRef.current?.click()}
            >
              <div className="text-sm font-medium text-slate-900">Drop monthly prices here</div>
              <p className="mt-1 text-sm text-slate-500">or choose a CSV from your device</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {priceSamples.map((sample) => (
                  <Button key={sample.file} variant="secondary" onClick={async (event) => {
                    event.stopPropagation()
                    const response = await fetch(sample.file)
                    const text = await response.text()
                    await loadPriceFile(new File([text], sample.name, { type: 'text/csv' }))
                  }}>{sample.name}</Button>
                ))}
              </div>
              <input ref={priceInputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={async (event) => {
                const file = event.target.files?.[0]
                if (file) await loadPriceFile(file)
              }} />
            </div>
            {pricePreview ? (
              <div className="mt-6 space-y-4">
                <Button onClick={() => void handlePriceCommit()}>Save prices</Button>
                {pricePreview.warnings.length > 0 ? <Card className="bg-amber-50 text-amber-900"><div className="text-sm font-medium">Parser warnings</div><ul className="mt-2 list-disc pl-5 text-sm">{pricePreview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></Card> : null}
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr><th className="px-3 py-2 text-left">Security</th><th className="px-3 py-2 text-left">Month</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-left">Currency</th><th className="px-3 py-2 text-right">FX</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {pricePreview.rows.map((row) => <tr key={row.id}><td className="px-3 py-2">{row.securityId}</td><td className="px-3 py-2">{row.month}</td><td className="px-3 py-2 text-right">{row.price}</td><td className="px-3 py-2">{row.currency}</td><td className="px-3 py-2 text-right">{row.fxRate}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <EmptyState title="No price file yet" description="Upload monthly prices to power current value, peak FA, and tax calculations." />}
          </Card>

          <Card>
            <SectionTitle title="Restore from backup" subtitle="This restores by wiping local tables and reloading the backup JSON." />
            <p className="text-sm text-slate-600">Import a full backup JSON to replace your current local IndexedDB state.</p>
            <Button className="mt-4" onClick={() => restoreInputRef.current?.click()}>Restore from backup</Button>
            <input ref={restoreInputRef} className="hidden" type="file" accept="application/json,.json" onChange={async (event) => {
              const file = event.target.files?.[0]
              if (file) await restoreFromBackup(file)
            }} />
          </Card>
        </div>
      )}
    </div>
  )
}
