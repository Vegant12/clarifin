---
phase: 13-t1-data-and-indicators
plan: 01
subsystem: database, infra, testing
tags: [ohlcv, supabase, pgvector, migrations, internal-auth, tdd, vitest, lightweight-charts, technicalindicators]

requires:
  - phase: 12-disclaimers
    provides: v1.0 MVP baseline — all existing internal routes (parse-batch, embed-batch, analyze-batch)

provides:
  - lightweight-charts@5.2.0 and technicalindicators@3.1.0 installed and importable
  - ohlcv_cache + ticker_metadata Supabase tables with UNIQUE(ticker,date) constraint (migration ready to apply)
  - src/lib/internal-auth.ts as single source of timingSafeStringEq/extractBearer/resolveCandidate
  - three existing internal routes updated to import from internal-auth.ts (no duplicate definitions)
  - src/lib/ta/ohlcv-schema.ts with OHLCVBar Zod schema and type
  - four stub modules: fetch-ohlcv.ts, compute-indicators.ts, upsert-ohlcv.ts, upsert-ohlcv.ts
  - three Wave 0 red test suites: ohlcv-validation, indicators.fixture, ohlcv-uniqueness
  - 250-bar deterministic synthetic OHLCV fixture + pre-computed indicator ground-truth

affects: [13-02, 13-03, 13-04, 13-05, 13-06, 13-07]

tech-stack:
  added:
    - lightweight-charts@5.2.0 (Apache-2.0, ESM-only, for candlestick chart in Plan 05)
    - technicalindicators@3.1.0 (pure JS, CJS, for RSI/MACD/BB/EMA computation in Plan 03)
  patterns:
    - internal-auth.ts shared module pattern — single source for timing-safe auth helpers
    - stub-with-guard pattern — stubs implement ticker validation guard but throw for unimplemented logic
    - Wave 0 TDD red stubs with deterministic fixtures for regression prevention

key-files:
  created:
    - supabase/migrations/20260606130000_ta_t1_schema.sql
    - src/lib/internal-auth.ts
    - src/lib/ta/ohlcv-schema.ts
    - src/lib/ta/fetch-ohlcv.ts (stub)
    - src/lib/ta/compute-indicators.ts (stub)
    - src/lib/ta/upsert-ohlcv.ts (stub)
    - tests/ta/ohlcv-validation.test.ts
    - tests/ta/indicators.fixture.test.ts
    - tests/ta/ohlcv-uniqueness.test.ts
    - tests/ta/fixtures/ohlcv-250.json
    - tests/ta/fixtures/indicators-ground-truth.json
  modified:
    - package.json (added lightweight-charts, technicalindicators)
    - pnpm-lock.yaml
    - src/app/api/internal/parse-batch/route.ts (import from internal-auth)
    - src/app/api/internal/embed-batch/route.ts (import from internal-auth)
    - src/app/api/internal/analyze-batch/route.ts (import from internal-auth)

key-decisions:
  - "Extracted triplicated auth helpers from 3 internal routes into src/lib/internal-auth.ts — single source of truth for timingSafeEqual-based auth"
  - "MACD(12,26,9) actual warmup via technicalindicators is 25 bars (not 33) — library pads internally; ground truth computed from library output not formula"
  - "lightweight-charts is ESM-only; require() fails but TypeScript/Next.js import works — confirmed with --input-type=module test"
  - "stub fetch-ohlcv.ts implements only ticker-regex guard to allow 2/7 validation tests to pass immediately; remaining tests stay RED for Plan 03"

patterns-established:
  - "Wave 0 TDD: stub implements only boundary guards (ticker regex), throws for all real logic — tests document the contract before implementation"
  - "Fixture-based indicator testing: 250-bar deterministic series + pre-computed ground truth using same library to catch alignment regressions"

requirements-completed: [TA-INGEST-01, TA-INFRA-02]
duration: 25min
completed: 2026-06-06
---

# Phase 13 Plan 01: Wave 0 Foundation Summary

**TA Wave 0 foundation: installed chart + indicator libraries, created ohlcv_cache schema with UNIQUE(ticker,date), extracted internal-auth.ts from 3 triplicated routes, and created 3 red TDD test stubs with 250-bar deterministic fixtures.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-06T21:00:00Z
- **Completed:** 2026-06-06T21:25:00Z
- **Tasks:** 3/4 complete (Task 4 is a human-action checkpoint — migration push required)
- **Files modified:** 14 files created, 5 modified

## Accomplishments

### Task 1: Install deps + TA schema migration
- Installed `lightweight-charts@5.2.0` (ESM-only, Apache-2.0) and `technicalindicators@3.1.0` (CJS, pure JS)
- Created `supabase/migrations/20260606130000_ta_t1_schema.sql` with:
  - `ohlcv_cache` table: `UNIQUE(ticker, date)` constraint (`ohlcv_cache_ticker_date_unique`) — prevents concurrent cron duplicates
  - `ticker_metadata` table with `first_trade_date` column (supports ≥2yr seed filter)
  - `pg_trgm` GIN index on `name_en` for autocomplete
  - RLS enabled on both tables (service_role only)

### Task 2: Extract internal-auth.ts
- Created `src/lib/internal-auth.ts` with `timingSafeStringEq`, `extractBearer`, `resolveCandidate`
- Updated all 3 existing internal routes to import from `@/lib/internal-auth`
- Removed 78 lines of triplicated local auth function definitions
- Zero auth logic changes — verbatim extraction preserves security properties
- Dual-path auth (Bearer header + `?secret=` query param) preserved exactly

### Task 3: OHLCV schema + Wave 0 red test stubs (TDD RED phase)
- `src/lib/ta/ohlcv-schema.ts` — Zod `ohlcvBarSchema` + `OHLCVBar` type
- `src/lib/ta/fetch-ohlcv.ts` — stub with ticker-regex guard (returns null on invalid ticker); throws for rest
- `src/lib/ta/compute-indicators.ts` — stub `computeIndicators()` throwing not-implemented
- `src/lib/ta/upsert-ohlcv.ts` — stub `upsertOHLCV()` throwing not-implemented
- `tests/ta/fixtures/ohlcv-250.json` — 250-bar deterministic OHLCV (LCG seed=42, sine+trend walk)
- `tests/ta/fixtures/indicators-ground-truth.json` — pre-computed RSI/MACD/BB/EMA last values

## Wave 0 RED Test Output (expected state)

```
❯ tests/ta/indicators.fixture.test.ts (8 tests | 8 failed)
  × RSI(14) last value matches ground truth within 0.001 tolerance → not implemented — Plan 03
  × MACD(12,26,9) warmup alignment: first non-null at groundTruth.macdWarmupFirstIndex → not implemented
  × all aligned arrays have length === bar count (250) → not implemented
  × BollingerBands(20,2) last upper matches ground truth → not implemented
  × [4 more EMA/BB tests] → not implemented

❯ tests/ta/ohlcv-uniqueness.test.ts (3 tests | 3 failed)
  × calls supabase upsert with onConflict:'ticker,date' → not implemented — Plan 03
  × does nothing when bars array is empty → not implemented
  × maps adjClose to adj_close column → not implemented

❯ tests/ta/ohlcv-validation.test.ts (7 tests | 2 passed, 5 failed)
  ✓ returns null when ticker is malformed (invalid-ticker) — PASSES (guard implemented)
  ✓ returns null when ticker contains lowercase letters — PASSES (guard implemented)
  × appends .JK suffix → not implemented — Plan 03
  × filters bars where high < low → not implemented
  × [2 more validation tests] → not implemented
```

## Deviations from Plan

### Auto-discovered Issues

**1. [Rule 1 - Bug] pnpm modules directory hoist pattern mismatch**
- **Found during:** Task 1 (pnpm add)
- **Issue:** `ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF` prevented `pnpm add` from running directly
- **Fix:** Ran `CI=true pnpm install` first to recreate modules directory, then `pnpm add` succeeded
- **Files modified:** None (pnpm-lock.yaml updated as part of dep install)
- **Commit:** c8c585e

**2. [Rule 3 - Blocking issue] MACD warmup period differs from plan's formula**
- **Found during:** Task 3 fixture generation
- **Issue:** Plan states "MACD first non-null index equals warmup (34)" based on `slow + signal - 2 = 33`. Actual `technicalindicators` output starts at index 25 (warmup = 25), not 33
- **Fix:** Ground truth JSON includes `macdWarmupFirstIndex: 25`; test assertions use the measured value from the library rather than the formula. Test description updated to use `groundTruth.macdWarmupFirstIndex`
- **Files modified:** tests/ta/fixtures/indicators-ground-truth.json, tests/ta/indicators.fixture.test.ts
- **Commit:** 22b6b52

**3. Pre-existing typecheck error in `src/lib/chat/session-restore.test.ts`**
- **Status:** Out of scope — existed before Phase 13 (confirmed via git stash test)
- **Logged to:** deferred-items.md (pre-existing, unrelated to TA module)

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `fetchOHLCV` body | src/lib/ta/fetch-ohlcv.ts | 27 | Plan 03 implements yahoo-finance2 historical() + validation pipeline |
| `computeIndicators` body | src/lib/ta/compute-indicators.ts | 28 | Plan 03 implements technicalindicators RSI/MACD/BB/EMA/ATR/Stochastic/OBV |
| `upsertOHLCV` body | src/lib/ta/upsert-ohlcv.ts | 17 | Plan 03 implements supabase upsert with onConflict:"ticker,date" |

These stubs are intentional — Wave 0 TDD pattern. Plan 03 will fill all three.

## Blocking Checkpoint

**Task 4 (human-action):** The migration `supabase/migrations/20260606130000_ta_t1_schema.sql` must be applied to Supabase before Plans 02/03 can run against a live DB. The migration file is committed and ready; the schema push is a human action (Supabase CLI or dashboard).

## Self-Check: PASSED

```
FOUND: supabase/migrations/20260606130000_ta_t1_schema.sql
FOUND: src/lib/internal-auth.ts
FOUND: src/lib/ta/ohlcv-schema.ts
FOUND: tests/ta/fixtures/ohlcv-250.json (250 bars)
FOUND: c8c585e (Task 1 commit)
FOUND: e64c395 (Task 2 commit)
FOUND: 22b6b52 (Task 3 commit)
```
