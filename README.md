# Portfolio & Tax Tracker

A **browser-only, offline-first** personal tool for an Indian tax resident (ROR) to track
Indian and US investments, compute FIFO capital gains, and produce the tables needed for
Indian ITR filing (Schedule FA A3, FSI, TR, CG).

- **All data stays on your device** (IndexedDB). No account, no backend, no external price/FX APIs.
- **Prices are manual** — you upload a monthly price CSV (one price per security per month).
- **Transaction date is the source of truth.** FY / calendar year are derived, never stored.
- **P&L is never stored** — it's computed on demand from holdings.
- **Duplicate detection is mandatory** — the same trade across two statements is counted once and
  linked to both source files, and every import row shows why it was accepted, rejected, or deduped.
- Works **offline** after first load (PWA) and is deployable to **GitHub Pages**.

## Tech

React + TypeScript + Vite, Tailwind CSS, Dexie (IndexedDB), PapaParse, Recharts, React Router
(HashRouter), vite-plugin-pwa. Tests with Vitest.

## Develop

Requires Node 22 (see `.nvmrc`).

```bash
nvm use          # Node 22
npm install
npm run dev       # dev server
npm run typecheck # tsc -b
npm run lint      # oxlint
npm run test      # vitest run
npm run build     # tsc -b && vite build  -> dist/
```

## Deploy (GitHub Pages)

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to
Pages. The Vite `base` is `/portfolio-tracker/` (override with `BASE_PATH` if the repo is renamed).
Enable Pages in the repo settings with **Source: GitHub Actions**.

## App sections

- **Dashboard** — holdings value (India / foreign), YTD dividends, FA-reportable asset count,
  recent imports, India-vs-US allocation, quick actions.
- **Portfolio** — holdings with average cost (INR), current price, unrealized P&L; expand a row for
  FIFO lots; filter India / foreign; search by symbol or ISIN.
- **Uploads** — drag-and-drop import wizard (Zerodha tradebook/holdings/contract notes, IBKR Flex,
  E*Trade RSU, generic CSV) with Raw / Parsed / Duplicates views and a live import log; a document
  vault with original-file download; and monthly price upload with missing-month warnings.
- **Tax** — year selector (persists across tabs) with pills for FA A3, FSI, TR, CG; each with CSV /
  JSON export. FA rows expand to show the monthly prices used for the peak.
- **Debug** — system log, transaction inspector (full audit trail per txn), dedupe hash checker,
  and a step-by-step FIFO trace.

Sample files to try live in `public/samples/`.

## Data & assumptions

- Cost basis is stored in INR using the FX rate on the buy/vest date. RSU cost basis = vest FMV
  (perquisite tax on vesting is assumed already paid via payroll).
- Holding-period thresholds: Indian listed equity / equity-MF LTCG after > 12 months; foreign
  equity / RSU LTCG after > 24 months. A single sell spanning lots is split per lot for STCG/LTCG.
- Schedule FA uses the calendar year (Jan–Dec); Schedule CG uses the financial year (Apr–Mar).
- If a foreign transaction's file has no FX rate, it defaults to 1 and a warning is logged; correct
  it via monthly prices.
- Backup export/restore is available at any time; restore replaces local data.

This is a personal tool, not tax advice.
