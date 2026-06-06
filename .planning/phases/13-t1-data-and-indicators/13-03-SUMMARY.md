---
phase: 13-t1-data-and-indicators
plan: 03
subsystem: data, testing
tags: [ohlcv, yahoo-finance2, technicalindicators, tdd, rsi, macd, bollinger-bands, ema, sma, atr, stochastic, obv, supabase]

requires:
  - phase: 13-t1-data-and-indicators (plan 01)
    provides: Wave 0 red test stubs + 250-bar deterministic OHLCV fixture + indicators-ground-truth.json + stub modules (fetch-ohlcv, compute-indicators, upsert-ohlcv)

provides:
  - fetchOHLCV: yahoo-finance2 historical() with withBackoff + four-rule isValidBar filter + .JK suffix + server-only boundary
  - isValidBar: exported bar validation predicate (reusable by seed script — prevents drift)
  - upsertOHLCV: duplicate-safe batch upsert with onConflict:ticker,date + adj_close column mapping + log-and-swallow
  - computeIndicators: all 10 indicators (RSI/MACD/BB/EMA20/50/200/SMA50/ATR/Stochastic/OBV) left-padded to bars.length via alignIndicator()
  - indicator-schema.ts: Zod schema + IndicatorSet type consumed by T2 and T3
  - Three Wave 0 red test suites now GREEN (18 tests total)

affects: [13-04, 13-05, 13-06, 13-07, 14-T2-pattern-gates, 15-T3-feature-encoder]

tech-stack:
  added: []
  patterns:
    - alignIndicator self-correcting padding — pads by (totalBars - values.length) not theoretical warmup constant; logs mismatch so library version drift is visible in CI
    - isValidBar exported from fetch-ohlcv.ts — same rule reused by seed script (T-13-09 tampering mitigation)
    - RawBar cast via unknown — yahoo-finance2 historical() union type collapses through withBackoff<T> generic; cast to explicit RawBar shape for iteration safety

key-files:
  created:
    - src/lib/ta/indicator-schema.ts
  modified:
    - src/lib/ta/fetch-ohlcv.ts (stub → full implementation)
    - src/lib/ta/compute-indicators.ts (stub → full implementation)
    - src/lib/ta/upsert-ohlcv.ts (stub → full implementation)

key-decisions:
  - "alignIndicator pads by (totalBars - values.length) not theoretical warmup: self-corrects if library output deviates from formula (e.g. MACD measured 25 not 33)"
  - "isValidBar exported from fetch-ohlcv.ts so Plan 02 seed script can import identical validation logic — no drift possible"
  - "import yahooFinance from 'yahoo-finance2' (not new YahooFinance()) — test mock provides a plain object, not a constructor"
  - "RawBar local type cast for withBackoff<T> return: yahoo-finance2 historical() complex union type collapses to {} through generic; explicit cast preserves field access safety"
  - "Stochastic: expose k (%K fast line) as primary scalar; d (%D) has additional signalPeriod-1 warmup making it unsuitable as the single stochastic value"
  - "OBV warmup is 1 (not 0 as plan states): library outputs n-1 values (needs prevClose); alignIndicator self-corrects"

patterns-established:
  - "alignIndicator<T>(values, totalBars, label): left-pads by actual output deficit; logs label for CI visibility on warmup drift"
  - "isValidBar(bar, prevClose): four-rule filter exported for reuse; prevClose=null skips >50% return check on first bar"

requirements-completed: [TA-INGEST-01, TA-IND-01, TA-IND-02, TA-IND-03, TA-IND-04]

duration: 15min
completed: 2026-06-06
---

# Phase 13 Plan 03: Wave 1 OHLCV + Indicators Implementation Summary

**Turned three Wave 0 red test suites GREEN by implementing fetchOHLCV (yahoo-finance2 + four-rule validation), upsertOHLCV (duplicate-safe Supabase upsert), and computeIndicators (10 technicalindicators outputs warmup-aligned to bars.length via self-correcting alignIndicator).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-06T22:07:00Z
- **Completed:** 2026-06-06T22:12:00Z
- **Tasks:** 2/2 (GREEN + REFACTOR merged — isValidBar exported during GREEN)
- **Files modified:** 4 files (3 modified, 1 created)

## Accomplishments

- Implemented `fetchOHLCV`: yahooFinance.historical() wrapped in withBackoff, `.JK` suffix, four-rule `isValidBar` filter (high<low, close<=0, volume<0, >50% single-bar return), date normalised to ISO "YYYY-MM-DD" string
- Implemented `upsertOHLCV`: supabase upsert with `{ onConflict: "ticker,date" }`, `adjClose → adj_close` column mapping, log-and-swallow errors, `import "server-only"`
- Created `indicator-schema.ts`: Zod `indicatorSetSchema` + `IndicatorSet` type mirroring stock-schema.ts pattern
- Implemented `computeIndicators`: RSI(14), MACD(12,26,9), BollingerBands(20,2), EMA(20/50/200), SMA(50), ATR(14), Stochastic(14,3), OBV — all aligned via `alignIndicator()` to `bars.length`; uses `adjClose` throughout

## Wave 0 → GREEN Test Output

```
✓ tests/ta/ohlcv-validation.test.ts (7 tests)
✓ tests/ta/indicators.fixture.test.ts (8 tests)
✓ tests/ta/ohlcv-uniqueness.test.ts (3 tests)
Total: 18 tests, all passing
```

## Verified technicalindicators@3.1.0 API Shapes (for T2/T3)

| Indicator | Call signature | Output shape | Measured warmup |
|-----------|---------------|-------------|----------------|
| RSI | `RSI.calculate({ period, values })` | `number[]` | 14 (= period) |
| MACD | `MACD.calculate({ fastPeriod, slowPeriod, signalPeriod, values, SimpleMAOscillator: false, SimpleMASignal: false })` | `{ MACD, signal, histogram }[]` | **25** (not formula 33) |
| BollingerBands | `BollingerBands.calculate({ period, stdDev, values })` | `{ upper, middle, lower, pb }[]` | 19 (= period - 1) |
| EMA | `EMA.calculate({ period, values })` | `number[]` | period - 1 |
| SMA | `SMA.calculate({ period, values })` | `number[]` | period - 1 |
| ATR | `ATR.calculate({ period, high, low, close })` | `number[]` | 14 (= period) |
| Stochastic | `Stochastic.calculate({ period, signalPeriod, high, low, close })` | `{ k, d }[]` | 13 (k: period-1); d has additional signalPeriod-1=2 warmup |
| OBV | `OBV.calculate({ close, volume })` | `number[]` | **1** (not 0 — needs prevClose for direction) |

**Field notes:**
- MACD: `signal` and `histogram` are `undefined` (not null) for early results before full signal EMA warmup completes. Extract as `typeof r.signal === "number" ? r.signal : null`.
- Stochastic: `d` is `undefined` for first `signalPeriod-1` results after k warmup. Use `k` as primary stochastic scalar.
- OBV warmup=1 deviates from plan's stated warmup=0; `alignIndicator` self-corrects.

## Task Commits

1. **GREEN + REFACTOR: implement all three modules + indicator-schema** - `648b589` (feat)

## Files Created/Modified

- `src/lib/ta/indicator-schema.ts` — Zod schema + IndicatorSet type (new)
- `src/lib/ta/fetch-ohlcv.ts` — full implementation with withBackoff, isValidBar export, RawBar cast
- `src/lib/ta/compute-indicators.ts` — full 10-indicator computation with alignIndicator
- `src/lib/ta/upsert-ohlcv.ts` — supabase upsert with onConflict, adj_close mapping

## Deviations from Plan

### Auto-discovered Issues

**1. [Rule 1 - Bug] yahoo-finance2 import pattern incompatible with test mock**
- **Found during:** GREEN phase (test run)
- **Issue:** Plan pattern showed `const yahooFinance = new YahooFinance()` (constructor call). Test mock provides `{ default: { historical: vi.fn() } }` — a plain object, not a constructor. `new YahooFinance()` throws `TypeError: default is not a constructor` in Vitest environment.
- **Fix:** Changed to `import yahooFinance from "yahoo-finance2"` and call `yahooFinance.historical()` directly (matching the mock shape). This is also how the library recommends usage.
- **Files modified:** src/lib/ta/fetch-ohlcv.ts
- **Commit:** 648b589

**2. [Rule 1 - Bug] TypeScript error: `Type '{}' must have '[Symbol.iterator]()' method**
- **Found during:** typecheck after GREEN
- **Issue:** `withBackoff<T>` generic couldn't infer the array type from `yahooFinance.historical()` complex union return type — collapsed to `{}`. `for...of` loop on `{}` fails TypeScript.
- **Fix:** Added local `RawBar` type and cast `withBackoff(...)` result `as RawBar[] | null`. Pattern mirrors `fetch-stock-data.ts` cast-via-unknown approach for yahoo-finance2 shapes.
- **Files modified:** src/lib/ta/fetch-ohlcv.ts
- **Commit:** 648b589

**3. [Rule 1 - Bug] OBV warmup is 1, not 0**
- **Found during:** GREEN (technicalindicators API verification)
- **Issue:** Plan states `OBV warmup = 0` (output length === input). Actual library output is `n - 1` (warmup=1) — first OBV value requires a previous close to determine volume direction.
- **Fix:** `alignIndicator` self-corrects by padding `totalBars - values.length = 1` rather than using a hardcoded warmup constant. No test failure — the alignment test checks length === 250, which passes.
- **Files modified:** src/lib/ta/compute-indicators.ts (comment updated)
- **Commit:** 648b589

### REFACTOR merged into GREEN

The plan called for a separate REFACTOR commit to export `isValidBar`. Since the export was included in the initial GREEN implementation (it's a single logical change), no separate refactor commit was made.

## Known Stubs

None — all three Wave 0 stubs are now fully implemented.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All three modules operate within the existing trust boundaries established in Plan 01:
- T-13-09 (isValidBar filter): implemented and exported
- T-13-10 (ticker regex): implemented in fetchOHLCV
- T-13-11 (onConflict:ticker,date): implemented in upsertOHLCV
- T-13-12 (server-only): applied to fetch-ohlcv.ts and upsert-ohlcv.ts

## Self-Check: PASSED

```
FOUND: src/lib/ta/indicator-schema.ts
FOUND: src/lib/ta/fetch-ohlcv.ts (export function fetchOHLCV + export function isValidBar)
FOUND: src/lib/ta/compute-indicators.ts (export function computeIndicators)
FOUND: src/lib/ta/upsert-ohlcv.ts (export async function upsertOHLCV)
FOUND: 648b589 (GREEN commit)
TESTS: 18/18 passing (ohlcv-validation: 7, indicators.fixture: 8, ohlcv-uniqueness: 3)
TYPECHECK: only pre-existing session-restore.test.ts errors remain (out of scope)
```
