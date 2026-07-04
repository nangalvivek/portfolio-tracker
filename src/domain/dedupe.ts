import { db, log } from '../db/db'
import { round2, round4 } from './money'
import { stableHash } from './hash'
import type { Currency, Transaction, TransactionDraft, TransactionRawRowRef } from './types'

export interface ImportSourceRow {
  lineNumber: number
  rawText: string
}

export interface ImportCandidate extends TransactionDraft {
  sourceFileId: string
  rawRow: ImportSourceRow
}

export interface ImportResultRow {
  status: 'NEW' | 'DUPLICATE' | 'ERROR'
  txn?: Transaction
  existingTxnId?: string
  reason: string
  lineNumber: number
  raw: string
}

export interface ImportResult {
  rows: ImportResultRow[]
  counts: {
    new: number
    duplicate: number
    error: number
    processed: number
  }
}

const mergeUniqueStrings = (left: string[], right: string[]): string[] => Array.from(new Set([...left, ...right]))

const canonicalHashKey = (candidate: Pick<TransactionDraft, 'securityId' | 'accountId' | 'date' | 'type' | 'quantity' | 'price'>): string =>
  [
    candidate.securityId,
    candidate.accountId,
    candidate.date,
    candidate.type,
    round4(candidate.quantity).toFixed(4),
    round2(candidate.price).toFixed(2),
  ].join('|')

export const computeDedupeHash = (
  candidate: Pick<TransactionDraft, 'securityId' | 'accountId' | 'date' | 'type' | 'quantity' | 'price'>,
): string => stableHash(canonicalHashKey(candidate))

const validateDraft = (candidate: TransactionDraft): string | null => {
  if (!candidate.securityId) return 'missing securityId'
  if (!candidate.accountId) return 'missing accountId'
  if (!candidate.date || Number.isNaN(Date.parse(`${candidate.date}T00:00:00Z`))) return 'missing or invalid date'
  if (candidate.quantity <= 0) return 'quantity must be positive'
  if (!Number.isFinite(candidate.price) || candidate.price < 0) return 'missing or invalid price'
  if (!Number.isFinite(candidate.fxRate) || candidate.fxRate <= 0) return 'missing or invalid fxRate'
  if (!candidate.currency) return 'missing currency'
  return null
}

const mergeRawRowRefs = (left: TransactionRawRowRef[], right: TransactionRawRowRef[]): TransactionRawRowRef[] => {
  const seen = new Set(left.map((item) => `${item.fileId}:${item.lineNumber}:${item.rawText}`))
  const merged = [...left]
  for (const item of right) {
    const key = `${item.fileId}:${item.lineNumber}:${item.rawText}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(item)
    }
  }
  return merged
}

const evaluateImportCandidates = async (candidates: ImportCandidate[]): Promise<ImportResult> => {
  const rows: ImportResultRow[] = []
  let newCount = 0
  let duplicateCount = 0
  let errorCount = 0

  for (const candidate of candidates) {
    const validationError = validateDraft(candidate)
    if (validationError) {
      errorCount += 1
      rows.push({
        status: 'ERROR',
        reason: validationError,
        lineNumber: candidate.rawRow.lineNumber,
        raw: candidate.rawRow.rawText,
      })
      continue
    }

    const dedupeHash = computeDedupeHash(candidate)
    const existing = await db.transactions.where('dedupeHash').equals(dedupeHash).first()

    const grossAmountNative = round2(candidate.quantity * candidate.price)
    const grossAmountInr = round2(grossAmountNative * candidate.fxRate)

    if (existing) {
      const rawRowRef: TransactionRawRowRef = {
        fileId: candidate.sourceFileId,
        lineNumber: candidate.rawRow.lineNumber,
        rawText: candidate.rawRow.rawText,
      }
      const merged: Transaction = {
        ...existing,
        grossAmountNative: round2(existing.quantity * existing.price),
        grossAmountInr: round2(round2(existing.quantity * existing.price) * existing.fxRate),
        sourceFileIds: mergeUniqueStrings(existing.sourceFileIds, [candidate.sourceFileId]),
        rawRowRefs: mergeRawRowRefs(existing.rawRowRefs, [rawRowRef]),
      }
      await db.transactions.put(merged)
      await log('DEDUPE', `Matched existing txn ${existing.id} on hash`, {
        dedupeHash,
        existingTxnId: existing.id,
        fileId: candidate.sourceFileId,
        lineNumber: candidate.rawRow.lineNumber,
      })
      duplicateCount += 1
      rows.push({
        status: 'DUPLICATE',
        existingTxnId: existing.id,
        reason: `matched existing txn ${existing.id} on hash`,
        lineNumber: candidate.rawRow.lineNumber,
        raw: candidate.rawRow.rawText,
      })
      continue
    }

    const txn: Transaction = {
      id: crypto.randomUUID(),
      securityId: candidate.securityId,
      accountId: candidate.accountId,
      date: candidate.date,
      type: candidate.type,
      quantity: round4(candidate.quantity),
      price: round2(candidate.price),
      currency: candidate.currency as Currency,
      fees: candidate.fees === undefined ? undefined : round2(candidate.fees),
      fxRate: round4(candidate.fxRate),
      grossAmountNative,
      grossAmountInr,
      dedupeHash,
      sourceFileIds: [candidate.sourceFileId],
      rawRowRefs: [
        {
          fileId: candidate.sourceFileId,
          lineNumber: candidate.rawRow.lineNumber,
          rawText: candidate.rawRow.rawText,
        },
      ],
      notes: candidate.notes,
      foreignTaxPaid: candidate.foreignTaxPaid === undefined ? undefined : round2(candidate.foreignTaxPaid),
    }

    newCount += 1
    rows.push({
      status: 'NEW',
      txn,
      reason: 'new transaction inserted',
      lineNumber: candidate.rawRow.lineNumber,
      raw: candidate.rawRow.rawText,
    })
  }

  return {
    rows,
    counts: {
      new: newCount,
      duplicate: duplicateCount,
      error: errorCount,
      processed: candidates.length,
    },
  }
}

export const previewImportTransactions = async (candidates: ImportCandidate[]): Promise<ImportResult> =>
  evaluateImportCandidates(candidates)

export const importTransactions = async (candidates: ImportCandidate[]): Promise<ImportResult> => {
  const result = await evaluateImportCandidates(candidates)
  for (const row of result.rows) {
    const candidate = candidates[row.lineNumber - 2]
    if (!candidate) continue
    const dedupeHash = computeDedupeHash(candidate)
    if (row.status === 'NEW' && row.txn) {
      await db.transactions.put(row.txn)
      await log('IMPORT', `Imported new txn ${row.txn.id}`, {
        dedupeHash,
        fileId: candidate.sourceFileId,
        lineNumber: candidate.rawRow.lineNumber,
      })
    }
    if (row.status === 'DUPLICATE' && row.existingTxnId) {
      const existing = await db.transactions.get(row.existingTxnId)
      if (!existing) continue
      const rawRowRef: TransactionRawRowRef = {
        fileId: candidate.sourceFileId,
        lineNumber: candidate.rawRow.lineNumber,
        rawText: candidate.rawRow.rawText,
      }
      const merged: Transaction = {
        ...existing,
        sourceFileIds: mergeUniqueStrings(existing.sourceFileIds, [candidate.sourceFileId]),
        rawRowRefs: mergeRawRowRefs(existing.rawRowRefs, [rawRowRef]),
      }
      await db.transactions.put(merged)
      await log('DEDUPE', `Matched existing txn ${existing.id} on hash`, {
        dedupeHash,
        existingTxnId: existing.id,
        fileId: candidate.sourceFileId,
        lineNumber: candidate.rawRow.lineNumber,
      })
    }
  }
  return result
}
