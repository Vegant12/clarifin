---
phase: 13-t1-data-and-indicators
plan: 04
subsystem: api, ta
tags: [api-route, snapshot-copy, analysis-payload, ticker-search, ticker-routing, tdd, zod, supabase]

requires:
  - phase: 13-t1-data-and-indicators (plan 01)
    provides: ohlcv_cache + ticker_metadata schema, OHLCVBar type
  - phase: 13-t1-data-and-indicators (plan 03)
    provides: computeIndicators, IndicatorSet, indicator-schema.ts

provides:
  - GET /api/ta/analysis/[ticker]: typed AnalysisPayload from cache + indicators + snapshot copy
  - GET /api/ta/search: injection-safe ticker autocomplete (fail-open)
  - buildSnapshotCopy: plain-English direction-only one-liner generator (TA-IND-05)
  - AnalysisPayload Zod schema + type (shared contract for Plan 05 chart and Plan 07 page)
  - normalizeTickerParam: lowercase-redirect + format validation helper (Plan 07 page import)

affects: [13-05, 13-06, 13-07]

tech-stack:
  added: []
  patterns:
    - analysis route reads only from ohlcv_cache — never calls yahoo-finance2 directly (budget + latency)
    - sparse gate pattern: candle_count<30 returns empty indicators+snapshot with sparse:true — page gates chart rendering without NaN
    - TDD RED/GREEN pattern for snapshot copy: tests asserted before implementation
    - SnapshotCopy typed interface resolves Record<string,string> destructuring undefined issue
    - sanitizeQuery strips non-alphanumeric+space before PostgREST .or() filter string interpolation (T-13-14)

key-files:
  created:
    - src/lib/ta/snapshot-copy.ts
    - src/lib/ta/analysis-schema.ts
    - src/app/api/ta/analysis/[ticker]/route.ts
    - src/app/api/ta/search/route.ts
    - src/lib/ta/ticker-route.ts
    - tests/ta/indicator-snapshot.test.ts
    - tests/ta/ticker-routing.test.ts

key-decisions:
  - "SnapshotCopy typed interface added to snapshot-copy.ts — avoids Record<string,string> destructuring producing string|undefined in TypeScript strict mode"
  - "buildSnapshotCopy spread into Record<string,string> at route assignment boundary — SnapshotCopy is structurally compatible but TypeScript strict mode rejects direct assignment to z.record() inferred type"
  - "sanitizeQuery: strip /[^a-zA-Z0-9 ]/g before PostgREST .or() filter interpolation — prevents filter injection (T-13-14); same approach as fail-open rate-limit.ts"
  - "analysis route validates outgoing AnalysisPayload with safeParse + console.error on mismatch — never fails the request for schema drift (developer visibility only)"
  - "normalizeTickerParam extracted as pure helper so Plan 07 page and test share identical redirect logic — no drift possible"

patterns-established:
  - "Sparse gate: route returns sparse:true with empty indicators/snapshot when candle_count<30; page checks this flag before rendering chart (TA-CHART-08)"
  - "Fail-open search: parse error OR DB error both return {results:[]} status 200 — autocomplete is non-critical path"

requirements-completed: [TA-TICKER-01, TA-TICKER-02, TA-IND-05, TA-CHART-08]

duration: ~9min
completed: 2026-06-06
---

# Phase 13 Plan 04: TA API Routes — Analysis + Search Summary

**Two TA API routes and a server-side snapshot copy generator: /api/ta/analysis/[ticker] returns typed AnalysisPayload from ohlcv_cache with computed indicators and plain-English snapshot copy; /api/ta/search returns injection-safe ticker autocomplete; AnalysisPayload + normalizeTickerParam contracts defined for Plan 05/07.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-06T15:35:52Z
- **Completed:** 2026-06-06T15:44:33Z
- **Tasks:** 3/3 complete
- **Files created:** 7 new files

## Accomplishments

### Task 1: Indicator snapshot copy generator + AnalysisPayload schema (TDD)

**RED commit (6ff5abf):** 18 failing tests for `buildSnapshotCopy` asserting:
- All values match `"Label: words"` shape (letter, colon, prose)
- No value is a bare numeric triplet
- RSI oversold/overbought/neutral rules
- MACD crossover detection (bullish/bearish/no-crossover)
- EMA above/below with trend labels
- Sparse fallback: all-null arrays → `"Not enough data yet"`

**GREEN commit (1caef53):**
- `src/lib/ta/snapshot-copy.ts`: `buildSnapshotCopy(indicators, bars)` returning typed `SnapshotCopy`
  - RSI: `< 30` → "Near oversold territory (N)"; `> 70` → "In overbought territory (N)"; else "Neutral momentum (N)"
  - MACD: scans last two bars for crossover; detects prev-below-now-above (bullish) and prev-above-now-below (bearish)
  - Bollinger: band position percentage (≥0.8 → upper band extended; ≤0.2 → lower band support)
  - EMA-20/50/200, SMA-50: price vs last EMA value with uptrend/downtrend suffix
  - ATR: atrPct < 1% → Low, < 2.5% → Moderate, else High; formatted as "Rp NNN / share"
  - Stochastic: k < 20 → oversold; k > 80 → overbought; else neutral
  - OBV: compares last two non-null OBV values + last two price closes for confirmation copy
- `src/lib/ta/analysis-schema.ts`: `analysisPayloadSchema` Zod schema + `AnalysisPayload` type

**18/18 tests green.**

### Task 2: Analysis API route

Created `src/app/api/ta/analysis/[ticker]/route.ts`:
- `export const runtime = "nodejs"` and `export const maxDuration = 60`
- `tickerSchema = z.string().regex(/^[A-Z]{1,5}$/)` — 400 on failure (T-13-13)
- `ticker_metadata.maybeSingle()` — 404 when ticker not in DB
- `ohlcv_cache` select (520 rows, ascending, `adj_close → adjClose` mapping)
- **Sparse gate:** `candle_count < 30` → returns `{ sparse: true, indicators: {empty}, snapshot: {} }` — avoids NaN (TA-CHART-08)
- `computeIndicators` + `buildSnapshotCopy` on full data
- `analysisPayloadSchema.safeParse` validation with `console.error` on mismatch (developer-only; never fails request)
- `Cache-Control: public, s-maxage=3600, stale-while-revalidate=300`

### Task 3: Search route + ticker-routing test

Created `src/app/api/ta/search/route.ts`:
- `export const runtime = "nodejs"`
- `searchSchema = z.object({ q: z.string().min(1).max(20) })` — fail-open on parse failure
- `sanitizeQuery`: strips `/[^a-zA-Z0-9 ]/g` before `.or()` filter interpolation (T-13-14)
- Queries `ticker_metadata` with `ticker.ilike.Q%,name_en.ilike.%q%,name_id.ilike.%q%`
- `limit` default 8, max 20; DB error → `{ results: [] }` status 200 (fail-open, T-13-16)

Created `src/lib/ta/ticker-route.ts`:
- `normalizeTickerParam(raw)` → `{ redirectTo, valid }`
- "bbca" → `{ redirectTo: "/ta/BBCA", valid: true }`
- "BBCA" → `{ redirectTo: null, valid: true }`
- "bb-ca" → `{ redirectTo: null, valid: false }`

**10/10 ticker-routing tests green.**

## AnalysisPayload Shape (for Plan 05/07)

```typescript
interface AnalysisPayload {
  ticker: string;                   // "BBCA"
  name_en: string;                  // "Bank Central Asia"
  last_updated: string;             // "2024-12-31"
  ohlcv: OHLCVBar[];                // up to 520 bars, ascending
  indicators: IndicatorSet;         // all 10, null-padded to ohlcv.length; empty [] when sparse
  snapshot: Record<string, string>; // 10 keys: rsi, macd, bollingerBands, ema20...; {} when sparse
  candle_count: number;             // bars available
  sparse: boolean;                  // true if candle_count < 30
}
```

**Snapshot keys and example values:**

| Key | Example |
|-----|---------|
| `rsi` | "RSI: Near oversold territory (29)" |
| `macd` | "MACD: Bullish crossover yesterday" |
| `bollingerBands` | "Bollinger Bands: Price near upper band — extended" |
| `ema20` | "EMA-20: Price trading above — short-term uptrend" |
| `ema50` | "EMA-50: Price below — short-term downtrend" |
| `ema200` | "EMA-200: Price below — long-term downtrend" |
| `sma50` | "SMA-50: Price trading above — short-term strength" |
| `atr` | "ATR: Moderate volatility (Rp 320 / share)" |
| `stochastic` | "Stochastic: In overbought zone (83)" |
| `obv` | "OBV: Rising with price — volume confirms trend" |

## Task Commits

1. `6ff5abf` — test(13-04): TDD RED — 18 failing indicator-snapshot tests
2. `1caef53` — feat(13-04): snapshot-copy + AnalysisPayload schema (TDD GREEN)
3. `dc4aadb` — feat(13-04): analysis API route (OHLCV cache + indicators + sparse gate)
4. `b52dc7a` — feat(13-04): search route + ticker-route helper + ticker-routing tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SnapshotCopy typed interface vs Record<string,string> assignment**
- **Found during:** Task 1 GREEN typecheck
- **Issue:** `buildSnapshotCopy` return type `Record<string,string>` caused destructuring in tests to produce `string | undefined` (TypeScript strict array/index access). Direct assignment of `SnapshotCopy` interface to Zod-inferred `Record<string,string>` also failed.
- **Fix:** Added `SnapshotCopy` typed interface as return type; spread `{ ...buildSnapshotCopy(...) }` at the route assignment boundary to get a plain `Record<string,string>`
- **Files modified:** src/lib/ta/snapshot-copy.ts, src/app/api/ta/analysis/[ticker]/route.ts
- **Commit:** 1caef53, dc4aadb

## Known Stubs

None — all files are fully implemented.

## Threat Surface Scan

New trust boundary surfaces introduced:
- `GET /api/ta/analysis/[ticker]` — unauthenticated; ticker validated by Zod regex (T-13-13 mitigated)
- `GET /api/ta/search?q=` — unauthenticated; q sanitized to alphanumeric+space (T-13-14 mitigated)

Both surfaces return generic error strings, never raw DB error objects (T-13-16 mitigated).
Rate limiting deferred to Phase 16 (T4); gated by `NEXT_PUBLIC_TA_ENABLED=false` in prod during T1.

All T-13-13, T-13-14, T-13-16 threat dispositions from the plan's threat register are mitigated.

## Self-Check: PASSED

```
FOUND: src/lib/ta/snapshot-copy.ts (buildSnapshotCopy export)
FOUND: src/lib/ta/analysis-schema.ts (AnalysisPayload export)
FOUND: src/app/api/ta/analysis/[ticker]/route.ts (GET export, runtime=nodejs, sparse)
FOUND: src/app/api/ta/search/route.ts (GET export, ticker_metadata query)
FOUND: src/lib/ta/ticker-route.ts (normalizeTickerParam export)
FOUND: tests/ta/indicator-snapshot.test.ts (18 tests green)
FOUND: tests/ta/ticker-routing.test.ts (10 tests green)
FOUND: 6ff5abf (RED commit)
FOUND: 1caef53 (GREEN commit)
FOUND: dc4aadb (analysis route commit)
FOUND: b52dc7a (search + ticker-route commit)
TYPECHECK: clean (only pre-existing session-restore.test.ts errors)
```
