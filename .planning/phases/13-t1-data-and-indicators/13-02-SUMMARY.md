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
  - scripts/ta/seed-tickers.json: written at runtime, committed after human runs pnpm ta:seed (D-02)
  - package.json ta:seed script entry

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
  modified:
    - package.json (added ta:seed script)

key-decisions:
  - "Used static LQ45+IDX80 candidate list (111 tickers) as input universe per RESEARCH.md Open Q2 — avoids dependency on a yahoo-finance2 bulk ranking endpoint that does not exist"
  - "firstTradeDateMilliseconds used for ≥2yr filter (D-03) — yahoo-finance2 quote() exposes this field; converted to Date for comparison"
  - "Bar validation inlined in seed script with comment 'keep in sync with fetch-ohlcv.ts TA-INGEST-01 rules' — avoids circular import from lib into scripts/"
  - "withBackoff (500/1000/2000ms) applied to both quote() and historical() calls — rate-limit resilience per T-13-06 threat"

metrics:
  duration: ~5min (Task 1 only; Task 2 awaiting human run)
  completed: 2026-06-06
  tasks: 1/2 (Task 2 is checkpoint:human-action — blocked on live credentials)
  files: 2 created, 1 modified
---

# Phase 13 Plan 02: Seed + Backfill Script Summary

**One-shot seed + 5yr OHLCV backfill pipeline: `pnpm ta:seed` ranks 111 IDX candidates by market cap, filters ≥2yr history, writes committed JSON list, upserts ticker_metadata, and backfills validated 5yr OHLCV into ohlcv_cache with log-and-continue gap handling.**

## Performance

- **Duration:** ~5 min (executor time; script runtime ~2 min when run by human)
- **Started:** 2026-06-06T15:07:41Z
- **Completed (Task 1):** 2026-06-06T15:13:00Z
- **Tasks:** 1/2 complete (Task 2 is human-action checkpoint)
- **Files modified:** 2 created, 1 modified

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
- Sorts by `market_cap` desc, takes top 100 — expected 85-100 pass filter
- Writes `scripts/ta/seed-tickers.json` sorted by ticker code (stable git diffs, D-02)
- Upserts into `ticker_metadata` with `onConflict: "ticker"` — idempotent re-runs (T-13-07)
- Per-ticker `historical("${ticker}.JK", { period1: 5yr, period2: today, interval: "1d" })` (withBackoff)
- Four-rule bar validation (TA-INGEST-01): rejects `high < low`, `close <= 0`, `volume < 0`, `|return| > 50%` — mitigates T-13-05
- Upserts valid bars in batches of 500 with `onConflict: "ticker,date"` — idempotent (T-13-07)
- Per-ticker log-and-continue (D-06) — one yahoo failure does not abort the entire run
- `main().catch((e) => { console.error(e); process.exit(1); })`

**`package.json`** — added `"ta:seed": "tsx scripts/ta/seed-and-backfill.ts"`

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
- **Fix:** Removed the silencing line — validation warnings will appear in console output when running the script (acceptable for a one-shot ops script)
- **Files modified:** scripts/ta/seed-and-backfill.ts
- **Commit:** e10e98a

**3. [Rule 1 - Bug] Duplicate GJLT entry in idx-candidates.json**
- **Found during:** Task 1 candidate list construction
- **Issue:** Initial draft included both `GJLT` (typo) and `GJTL` (correct ticker)
- **Fix:** Removed `GJLT` entry; final list has 111 unique tickers all in valid `[A-Z]{1,5}` format
- **Files modified:** scripts/ta/idx-candidates.json
- **Commit:** e10e98a

### Pre-existing Typecheck Errors (Out of Scope)

`src/lib/chat/session-restore.test.ts` (lines 69) — 2 pre-existing TS errors documented in Plan 01 SUMMARY.md as out-of-scope; unchanged by this plan.

## Task 2 Status: Awaiting Human Action

Task 2 is a `checkpoint:human-action` — the script requires live `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and network access to yahoo-finance2. These are not available to the autonomous executor.

**To complete Task 2:**
1. Ensure Plan 01 migration is applied (ohlcv_cache + ticker_metadata exist)
2. With env vars set: `pnpm ta:seed` (~2 min runtime for ~100 tickers)
3. Commit the generated `scripts/ta/seed-tickers.json`
4. Verify DB population (see Task 2 how-to-verify in PLAN.md)

## Known Stubs

None — the seed script is fully implemented. `seed-tickers.json` will be written at script runtime (Task 2).

## Threat Surface Scan

No new network endpoints or auth paths introduced. Script uses service_role key from env (T-13-08: accepted risk, standard for one-shot ops scripts per existing smoke-vector-perf.ts pattern). All four STRIDE mitigations from the plan's threat register are implemented:
- T-13-05: Four-rule bar validation implemented in `isValidBar()`
- T-13-06: `withBackoff` on both quote() and historical() calls
- T-13-07: Both upsert calls use `onConflict` keys
- T-13-08: Service-role key read from env via `requireEnv()`, never hardcoded

## Self-Check: PASSED

```
FOUND: scripts/ta/seed-and-backfill.ts
FOUND: scripts/ta/idx-candidates.json (111 tickers, BBCA/TLKM/GOTO present)
FOUND: onConflict:"ticker" (line 229)
FOUND: onConflict:"ticker,date" (line 323)
FOUND: historical( (line 256)
FOUND: ticker_metadata upsert (line 228)
FOUND: ≥2yr filter — twoYearsAgo + firstTradeDateMilliseconds (lines 123-174)
FOUND: four-rule validation — high<low, close<=0, volume<0, >50% (lines 82-90)
FOUND: ta:seed in package.json (line 19)
FOUND: e10e98a (Task 1 commit)
```
