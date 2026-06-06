---
phase: 13-t1-data-and-indicators
plan: 02
subsystem: data-pipeline, scripts
tags: [ohlcv, yahoo-finance2, seed, backfill, ticker-metadata, idempotent]

requires:
  - phase: 13-t1-data-and-indicators
    plan: 01
    provides: ohlcv_cache + ticker_metadata tables with UNIQUE(ticker,date) constraint

provides:
  - scripts/ta/idx-candidates.json: 111 LQ45/IDX80 candidate tickers (committed, deterministic input universe)
  - scripts/ta/seed-and-backfill.ts: one-shot seed + 5yr OHLCV backfill pipeline (TA-DATA-01)
  - scripts/ta/seed-tickers.json: 100 tickers committed (D-02) — BBCA/TLKM/GOTO present
  - package.json ta:seed script entry
  - ticker_metadata: 100 rows populated
  - ohlcv_cache: 117,577 rows backfilled (5yr OHLCV per seeded ticker)

affects: [13-03, 13-04, 13-05, 13-06, 13-07, 15-T3-training-data]

tech-stack:
  added: []
  patterns:
    - one-shot ops script pattern (requireEnv + createClient no-session + main()/catch) — mirrors smoke-vector-perf.ts
    - log-and-continue per-ticker gap handling (D-06 best-available defence)
    - idempotent upsert with onConflict keys (ticker_metadata + ohlcv_cache)

key-files:
  created:
    - scripts/ta/idx-candidates.json
    - scripts/ta/seed-and-backfill.ts
    - scripts/ta/seed-tickers.json (written by script, committed by human after run)
  modified:
    - package.json (added ta:seed script)

key-decisions:
  - "Used static LQ45+IDX80 candidate list (111 tickers) as input universe per RESEARCH.md Open Q2 — avoids dependency on a yahoo-finance2 bulk ranking endpoint that does not exist"
  - "firstTradeDateMilliseconds used for ≥2yr filter (D-03) — yahoo-finance2 quote() exposes this field; converted to Date for comparison"
  - "Bar validation inlined in seed script with comment 'keep in sync with fetch-ohlcv.ts TA-INGEST-01 rules' — avoids circular import from lib into scripts/"
  - "withBackoff (500/1000/2000ms) applied to both quote() and historical() calls — rate-limit resilience per T-13-06 threat"
  - "'sector' field removed from quote() fields array — yahoo-finance2 field validation rejects it; sector is nullable in ticker_metadata and can be backfilled separately"

metrics:
  duration: ~25min total (Task 1: ~5min executor; Task 2: ~2min script runtime + human verification)
  completed: 2026-06-06
  tasks: 2/2
  files: 3 created, 1 modified
---

# Phase 13 Plan 02: Seed + Backfill Script Summary

**One-shot seed + 5yr OHLCV backfill pipeline: `pnpm ta:seed` ranked 111 IDX candidates by market cap, filtered ≥2yr history, seeded 100 tickers into ticker_metadata, and backfilled 117,577 validated OHLCV bars into ohlcv_cache. BBCA shows 1,203 bars (~5yr of trading days). Zero high<low violations.**

## Performance

- **Duration:** ~25 min total (Task 1: ~5min build, Task 2: ~2min script + human verify)
- **Started:** 2026-06-06T15:07:41Z
- **Completed:** 2026-06-06T22:32:28Z (seed-tickers.json committed)
- **Tasks:** 2/2 complete
- **Files modified:** 3 created, 1 modified

## Accomplishments

### Task 1: Build the seed + 5yr backfill script

**`scripts/ta/idx-candidates.json`**
- 111 deduplicated, alphabetically-sorted IDX tickers drawn from LQ45 + IDX80 constituent lists
- Includes required minimum set: BBCA, TLKM, GOTO, BBRI, BMRI, ASII, UNVR, ICBP, INDF, BBNI, ANTM, ADRO, PGAS, KLBF, SMGR, UNTR, AKRA, CPIN, EXCL, MDKA plus broader LQ45/IDX80 coverage
- Static candidate list is deterministic — no dependency on a bulk ranking API (RESEARCH.md Open Q2)

**`scripts/ta/seed-and-backfill.ts`**
- `requireEnv("SUPABASE_URL")` + `requireEnv("SUPABASE_SERVICE_ROLE_KEY")` — fatal if missing
- `createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })` — no session overhead
- `withBackoff` (500/1000/2000ms) on rate-limit errors — mitigates T-13-06
- Per-candidate `quote("${code}.JK")` to fetch `marketCap` + `firstTradeDateMilliseconds`
- `≥2yr filter`: drops tickers where `firstTradeDate > twoYearsAgo` (D-03)
- Sorts by `market_cap` desc, takes top 100 — exactly 100 tickers passed filter
- Writes `scripts/ta/seed-tickers.json` sorted by ticker code (stable git diffs, D-02)
- Upserts into `ticker_metadata` with `onConflict: "ticker"` — idempotent re-runs (T-13-07)
- Per-ticker `historical("${ticker}.JK", { period1: 5yr, period2: today, interval: "1d" })` (withBackoff)
- Four-rule bar validation (TA-INGEST-01): rejects `high < low`, `close <= 0`, `volume < 0`, `|return| > 50%` — mitigates T-13-05
- Upserts valid bars in batches of 500 with `onConflict: "ticker,date"` — idempotent (T-13-07)
- Per-ticker log-and-continue (D-06) — one yahoo failure does not abort the entire run
- `main().catch((e) => { console.error(e); process.exit(1); })`

**`package.json`** — added `"ta:seed": "tsx scripts/ta/seed-and-backfill.ts"`

### Task 2: Run the seed + backfill — DB population verified

Script executed successfully. DB counts confirmed by human:

| Check | Result | Acceptance Threshold | Status |
|-------|--------|----------------------|--------|
| `select count(*) from ticker_metadata` | **100** | 85-100 | PASS |
| `select count(*) from ohlcv_cache` | **117,577** | ~100k-126k | PASS |
| `select count(*) from ohlcv_cache where ticker='BBCA'` | **1,203** | ≥400 (expected ~1200) | PASS |
| `select count(*) from ohlcv_cache where high < low` | **0** | 0 | PASS |
| seed-tickers.json committed with BBCA/TLKM/GOTO | confirmed | required | PASS |

All Task 2 acceptance criteria met.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict-mode inference collapses array element type to `string | undefined`**
- **Found during:** Task 1 typecheck
- **Issue:** `candidateCodes[i]` typed as `string | undefined` under `noUncheckedIndexedAccess`; `sorted[i]` similarly typed as `TickerRow | undefined`
- **Fix:** Added `as string` cast for `candidateCodes[i]` and early-continue guard for `sorted[i]`
- **Files modified:** scripts/ta/seed-and-backfill.ts
- **Commit:** e10e98a

**2. [Rule 1 - Bug] `yahooFinance.options.validation` not on typed API**
- **Found during:** Task 1 typecheck
- **Issue:** Attempted to silence yahoo-finance2 schema validation warnings via `yahooFinance.options.validation` but this property is not typed on the `YahooFinance` class
- **Fix:** Removed the silencing line
- **Files modified:** scripts/ta/seed-and-backfill.ts
- **Commit:** e10e98a

**3. [Rule 1 - Bug] Duplicate GJLT entry in idx-candidates.json**
- **Found during:** Task 1 candidate list construction
- **Issue:** Initial draft included both `GJLT` (typo) and `GJTL` (correct ticker)
- **Fix:** Removed `GJLT` entry; final list has 111 unique tickers
- **Files modified:** scripts/ta/idx-candidates.json
- **Commit:** e10e98a

**4. [Rule 1 - Bug] 'sector' field rejected by yahoo-finance2 quote() validation**
- **Found during:** Task 2 human run
- **Issue:** `quote()` with `fields: ["sector"]` triggers a yahoo-finance2 schema validation warning/error; sector field not reliably exposed via quote() for .JK tickers
- **Fix:** Removed `"sector"` from the quote() fields array. Sector remains nullable in `ticker_metadata` (all 100 rows have `sector: null`). Can be backfilled from a separate data source if needed.
- **Files modified:** scripts/ta/seed-and-backfill.ts
- **Commit:** de6a62c

### Pre-existing Typecheck Errors (Out of Scope)

`src/lib/chat/session-restore.test.ts` (line 69) — 2 pre-existing TS errors documented in Plan 01 SUMMARY.md as out-of-scope; unchanged by this plan.

## Known Stubs

None — all deliverables are fully populated. `seed-tickers.json` is committed with 100 entries.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Script uses service_role key from env (T-13-08: accepted risk, standard for one-shot ops scripts per existing smoke-vector-perf.ts pattern). All four STRIDE mitigations from the plan's threat register are implemented and verified:
- T-13-05: Four-rule bar validation in `isValidBar()` — 0 high<low violations in 117,577 rows confirms effectiveness
- T-13-06: `withBackoff` on both `quote()` and `historical()` calls
- T-13-07: Both upserts use `onConflict` keys — re-running `pnpm ta:seed` is safe
- T-13-08: Service-role key read from env via `requireEnv()`, never committed

## Self-Check: PASSED

```
FOUND: scripts/ta/seed-and-backfill.ts
FOUND: scripts/ta/idx-candidates.json (111 tickers, BBCA/TLKM/GOTO present)
FOUND: scripts/ta/seed-tickers.json (100 entries, BBCA/TLKM/GOTO present)
FOUND: onConflict:"ticker" in seed-and-backfill.ts
FOUND: onConflict:"ticker,date" in seed-and-backfill.ts
FOUND: historical( in seed-and-backfill.ts
FOUND: ticker_metadata upsert in seed-and-backfill.ts
FOUND: ≥2yr filter (twoYearsAgo + firstTradeDateMilliseconds)
FOUND: four-rule validation (high<low, close<=0, volume<0, >50%)
FOUND: ta:seed in package.json
FOUND: e10e98a (Task 1 commit)
FOUND: 4330f01 (seed-tickers.json committed)
FOUND: de6a62c (sector field fix)
DB: ticker_metadata=100, ohlcv_cache=117577, BBCA=1203, high<low=0
```
