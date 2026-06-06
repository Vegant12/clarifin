---
phase: 09-stock-data-trend-chart
plan: 03
subsystem: stock-data, api
tags: [yahoo-finance2, zod, server-only, exponential-backoff, supabase-cache, tdd, STOCK-01, STOCK-02, STOCK-03, STOCK-05, CHART-02]

# Dependency graph
requires:
  - phase: 09-01
    provides: Wave 0 fetch-stock-data.test.ts stub (replaced by real tests in this plan)
  - phase: 09-01
    provides: stock_data + stock_fetched_at columns on documents table
  - phase: 09-02
    provides: documents.ticker written by detectTicker (consumed by fetchStockDataForDocument)

provides:
  - StockData, ChartDataPoint, StockQuote Zod schemas + TS types (stock-schema.ts)
  - fetchStockData: server-only stock fetcher with 24h cache + exp backoff + error boundary
  - fetchStockDataForDocument: cache-read-then-fetch with Supabase upsert
  - GET /api/stock/[ticker]: public route with strict ticker validation + soft error envelope
  - 9 real assertions in fetch-stock-data.test.ts (replaces 7 Wave 0 todos)

affects:
  - 09-04-PLAN (RSC page.tsx calls fetchStockDataForDocument(docId) directly — no HTTP)
  - Any client that needs ad-hoc stock data can call GET /api/stock/[ticker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN: stub todos → failing assertions → implementation → all green
    - withBackoff generic helper: 3-retry exponential delays 500ms/1s/2s for 429/rate-limit
    - YahooQuoteRaw/YahooSummaryRaw explicit type shapes: avoid TypeScript inference issues with yahoo-finance2 union overloads
    - Zod schema at three boundaries: fetch transform, JSONB cache parse, route output validation
    - Never-throw error boundary: all exceptions return null; route returns fixed string on failure

key-files:
  created:
    - src/lib/stock/stock-schema.ts
    - src/lib/stock/fetch-stock-data.ts
    - src/app/api/stock/[ticker]/route.ts
  modified:
    - src/lib/stock/fetch-stock-data.test.ts (replaced 7 Wave 0 todos with 9 real assertions)

key-decisions:
  - "Explicit YahooQuoteRaw/YahooSummaryRaw type aliases required: yahoo-finance2 quote() has overloads returning Promise<any>, causing TypeScript to infer {} for withBackoff return; explicit cast via unknown → typed alias resolves compiler errors while preserving runtime safety"
  - "withBackoff is a file-local generic helper, not exported: callers don't need backoff control; only fetchStockData uses it"
  - "fetchStockData does NOT write cache: it is a pure fetch+transform; fetchStockDataForDocument owns the Supabase cache write — separation of concerns"
  - "Public API route uses fetchStockData, not fetchStockDataForDocument: route is docId-unaware; the 24h cache is per-document not per-ticker; 1h CDN cache (s-maxage=3600) is the public rate limiter"

patterns-established:
  - "Pattern: Never-throw boundary — all yahoo-finance2 errors caught in withBackoff, return null propagated to caller"
  - "Pattern: Unit conversion at fetch boundary — dividendYield 0.032 → 3.2%; netMarginPct pre-computed — consumers never see raw fractions"

requirements-completed: [STOCK-01, STOCK-02, STOCK-03, STOCK-05, CHART-02]

# Metrics
duration: 6min
completed: 2026-05-20
---

# Phase 09 Plan 03: Stock Fetcher + API Route Summary

**Server-only yahoo-finance2 fetcher with 24h Supabase cache, exponential backoff for rate limits, never-throws error boundary, and a public GET /api/stock/[ticker] route with strict input validation — all backed by Zod schemas at every trust boundary**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-20T03:30:39Z
- **Completed:** 2026-05-20T03:35:53Z
- **Tasks:** 3 completed (Tasks 1, 2, 3)
- **Files modified:** 4

## Accomplishments

- Defined `stockDataSchema`, `chartDataPointSchema`, `stockQuoteSchema` in `stock-schema.ts` with all required types exported (`StockData`, `ChartDataPoint`, `StockQuote`)
- Implemented `fetchStockData` in `fetch-stock-data.ts` with: `.JK` suffix appending, exponential backoff (500ms/1s/2s) for 429/rate-limit errors, dividendYield fraction → percent conversion at boundary, netMarginPct pre-computation with zero-revenue guard, ascending year sort, never-throws error boundary
- Implemented `fetchStockDataForDocument` with 24h TTL cache read from `documents.stock_data`, schema validation of cached data (falls through to refetch on schema drift), and Supabase upsert on cache miss
- Created `GET /api/stock/[ticker]/route.ts` with `/^[A-Z]{1,5}$/` regex validation, soft error envelope (`"Market data temporarily unavailable"`), `s-maxage=3600` CDN cache, and no raw yahoo-finance2 errors exposed to client
- Replaced 7 Wave 0 `it.todo` stubs with 9 real assertions; all 25 stock tests pass (16 detect-ticker + 9 fetch-stock-data)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Define StockData + ChartDataPoint Zod schemas | `58cd768` | src/lib/stock/stock-schema.ts |
| 2 (RED) | Add failing tests for fetchStockData | `f1cb92f` | src/lib/stock/fetch-stock-data.test.ts |
| 2 (GREEN) | Implement fetchStockData + fetchStockDataForDocument | `19c81a0` | src/lib/stock/fetch-stock-data.ts |
| 3 | Create GET /api/stock/[ticker] route | `89275a7` | src/app/api/stock/[ticker]/route.ts |

## Files Created/Modified

- `src/lib/stock/stock-schema.ts` — Zod schemas + TS types for StockData, ChartDataPoint, StockQuote (36 lines)
- `src/lib/stock/fetch-stock-data.ts` — Server-only fetcher with backoff + cache + error boundary (178 lines)
- `src/lib/stock/fetch-stock-data.test.ts` — 9 real assertions replacing 7 Wave 0 todos
- `src/app/api/stock/[ticker]/route.ts` — Public GET route with ticker validation + soft error envelope (51 lines)

## Decisions Made

- **Explicit YahooQuoteRaw/YahooSummaryRaw type aliases:** yahoo-finance2's `quote()` function has overloads returning `Promise<any>` which caused TypeScript to infer `{}` for the `withBackoff` generic return. Explicit local type aliases with `[key: string]: unknown` index signatures were added so TypeScript can verify field access without requiring users to import from `yahoo-finance2` types directly. This is a Rule 1 fix (type error = bug).
- **fetchStockData does not write cache:** Pure fetch+transform; `fetchStockDataForDocument` owns the Supabase write. Keeps `fetchStockData` testable without DB.
- **Route uses fetchStockData not fetchStockDataForDocument:** The public route is docId-unaware; CDN cache (`s-maxage=3600`) is its rate limiter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type errors on yahoo-finance2 withBackoff returns**
- **Found during:** Task 2 GREEN (typecheck after writing implementation)
- **Issue:** `pnpm typecheck` reported `Property 'regularMarketPrice' does not exist on type '{}'` — TypeScript inferred `{}` for the generic `T` in `withBackoff<T>` because `yahoo-finance2.quote()` has a `Promise<any>` overload that wins.
- **Fix:** Added `YahooQuoteRaw` and `YahooSummaryRaw` type aliases with the specific fields we access, and cast the `withBackoff` results through these aliases. Fields accessed via optional chaining so runtime safety is preserved.
- **Files modified:** `src/lib/stock/fetch-stock-data.ts`
- **Commit:** `19c81a0` (included in GREEN commit; no separate commit needed as it was during initial implementation)

---

**Total deviations:** 1 auto-fixed (1 type error bug)
**Impact on plan:** Zero behavior change. Type aliases document the expected yahoo-finance2 response shape explicitly, which improves maintainability.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm test --run src/lib/stock/` exits 0 | PASS (25/25 across detect-ticker + fetch-stock-data) |
| `pnpm typecheck` exits 0 | PASS |
| `import "server-only"` in fetch-stock-data.ts | PASS |
| `export async function GET` in route.ts | PASS |
| `/^[A-Z]{1,5}$/` in route.ts | PASS |
| `"Market data temporarily unavailable"` in route.ts | PASS |
| `fetchStockData` imported (not fetchStockDataForDocument) in route.ts | PASS |
| No `it.todo` in fetch-stock-data.test.ts | PASS |
| CACHE_TTL_MS = 24 * 60 * 60 * 1000 in fetch-stock-data.ts | PASS |
| `.JK` suffix in fetch-stock-data.ts | PASS |
| `/(429|rate.?limit|quota|RESOURCE_EXHAUSTED)/i` regex in fetch-stock-data.ts | PASS |

## Known Stubs

None — all STOCK-01/02/03/05 and CHART-02 behavior is fully implemented. The `fetchStockDataForDocument` function is ready for Plan 04's RSC `page.tsx` to call directly.

## Threat Flags

Threats T-09-03-01 through T-09-03-04 are mitigated as documented in the plan's threat register:
- T-09-03-01 (ticker injection): Zod `/^[A-Z]{1,5}$/` rejects before any DB/yahoo call ✓
- T-09-03-02 (SSRF): yahoo-finance2 uses hardcoded endpoints; ticker is post-validation ✓
- T-09-03-03 (DoS): 24h DB cache + 1h CDN cache + yahoo-finance2 own rate limiting ✓
- T-09-03-04 (info disclosure): Fixed string "Market data temporarily unavailable" — no raw errors to client ✓

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/stock/stock-schema.ts exists | PASS |
| src/lib/stock/fetch-stock-data.ts exists | PASS |
| src/lib/stock/fetch-stock-data.test.ts exists (9 assertions) | PASS |
| src/app/api/stock/[ticker]/route.ts exists | PASS |
| Commits 58cd768, f1cb92f, 19c81a0, 89275a7 in git log | PASS |
| pnpm typecheck exits 0 | PASS |
| All 25 stock tests pass | PASS |

---
*Phase: 09-stock-data-trend-chart*
*Completed: 2026-05-20*
