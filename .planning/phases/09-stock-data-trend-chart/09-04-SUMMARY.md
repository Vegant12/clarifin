---
phase: 09-stock-data-trend-chart
plan: 04
subsystem: ui, components, doc-reader
tags: [recharts, stock-widget, trend-chart, explanation-panel, prop-threading, rsc, tdd, STOCK-01, STOCK-02, STOCK-03, STOCK-04, CHART-01, CHART-02]

# Dependency graph
requires:
  - phase: 09-01
    provides: formatIDR + formatIDRShort utilities, recharts installed, Wave 0 stubs
  - phase: 09-02
    provides: documents.ticker written by detectTicker
  - phase: 09-03
    provides: fetchStockDataForDocument, StockData/ChartDataPoint types, stock-schema.ts

provides:
  - StockWidget client component: ticker badge, IDX label, timestamp, 2×2 metric grid
  - TrendChartCard client component: Recharts ComposedChart with dual Y-axis
  - StockLoadingSkeleton client component: two animate-pulse blocks
  - ExplanationPanel extended with ticker/stockData/chartData/stockError props + stock+chart slots
  - Prop chain DocumentProgressView → DocumentReaderLayout → DesktopSplitPane/MobileTabView → ExplanationPanel
  - RSC page.tsx reads documents.ticker + calls fetchStockDataForDocument for stock data

affects:
  - src/app/doc/[documentId]/page.tsx (RSC extended)
  - src/components/doc/explanation-panel.tsx (new slots)
  - src/components/doc/document-progress-view.tsx (new props)
  - src/components/doc/document-reader-layout.tsx (new props)
  - src/components/doc/mobile-tab-view.tsx (new props)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN: Wave 0 stubs → failing assertions → implementation → all green
    - Recharts ComposedChart dual Y-axis: yAxisId=left (bars) + yAxisId=margin (line)
    - Prop drilling pattern: mirrors Phase 8 score prop threading exactly
    - RSC server-function call: fetchStockDataForDocument called directly (no HTTP round-trip)
    - Null-guard render pattern: ticker null = nothing, stockError = fallback text, D-02 empty chart

key-files:
  created:
    - src/components/doc/stock-widget.tsx
    - src/components/doc/stock-loading-skeleton.tsx
    - src/components/doc/trend-chart-card.tsx
  modified:
    - src/components/doc/stock-widget.test.tsx (replaced 8 Wave 0 todos with 9 real assertions)
    - src/components/doc/trend-chart-card.test.tsx (replaced 5 Wave 0 todos with 5 real assertions)
    - src/components/doc/explanation-panel.test.tsx (replaced 6 Wave 0 todos with 7 real assertions)
    - src/components/doc/explanation-panel.tsx (extended props + stock/chart slots)
    - src/components/doc/document-reader-layout.tsx (prop threading)
    - src/components/doc/mobile-tab-view.tsx (prop threading)
    - src/components/doc/document-progress-view.tsx (prop threading)
    - src/app/doc/[documentId]/page.tsx (RSC stock fetch wiring)
    - tests/components/explanation-panel.test.tsx (added missing Phase 9 props to all render calls)

key-decisions:
  - "Explicit afterEach cleanup in test files: jsdom render accumulation caused getByText to find multiple elements across tests; explicit cleanup() resolves the issue"
  - "Heading role queries for regression test: 'revenue' in explanation text gets wrapped by JargonTooltip, causing getByText('Revenue') to find 2 elements; getByRole('heading') targets the h2 unambiguously"
  - "TrendTooltip uses local interface types instead of Recharts TooltipContentProps: avoids import of internal Recharts types that vary by version"
  - "tests/components/explanation-panel.test.tsx updated with Phase 9 props (Rule 2): existing test file called ExplanationPanel without the new required props; typecheck would fail without update"

requirements-completed: [STOCK-01, STOCK-02, STOCK-03, STOCK-04, CHART-01, CHART-02]

# Metrics
duration: 7min
completed: 2026-05-20
---

# Phase 09 Plan 04: UI Components + Prop Threading Summary

**StockWidget, TrendChartCard, StockLoadingSkeleton built with TDD; ExplanationPanel extended with stock+chart slots; props threaded through entire layout tree; RSC page.tsx wires fetchStockDataForDocument — production build succeeds at 184kB for /doc/[documentId]**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-20T03:40:27Z
- **Completed:** 2026-05-20T03:48:02Z
- **Tasks:** 5 completed (Tasks 1–5); Task 6 is blocking human-verify checkpoint
- **Files modified:** 12

## Accomplishments

- Built `StockWidget` (new): ticker badge, IDX label, timestamp header, 2×2 metric grid with `formatMetric` (IDR/ratio/percent/em-dash for null). All 9 unit tests pass.
- Built `StockLoadingSkeleton` (new): `h-[108px]` + `h-[268px]` animate-pulse blocks, `role="status"`, `aria-busy="true"`.
- Built `TrendChartCard` (new): Recharts `ComposedChart` with `yAxisId="left"` Revenue+NetIncome bars and `yAxisId="margin"` NetMargin dashed line. Custom `TrendTooltip` with `formatIDR`. All 5 unit tests pass.
- Extended `ExplanationPanel`: added `ticker/stockData/chartData/stockError` props. Render order: ScoreCard → stock slot → chart slot → SECTION_ORDER (D-08). Null/error guards per D-02/D-10. All 7 unit tests pass.
- Threaded 4 new props through entire layout chain: `DocumentProgressView` → `DocumentReaderLayout` → `DesktopSplitPane` + `MobileTabView` → `ExplanationPanel`. 27/27 component tests pass.
- Wired RSC `page.tsx`: extended `documents` select to include `ticker`, added `fetchStockDataForDocument` call with stockError + chartData population. `pnpm typecheck` clean; `pnpm build` succeeds.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | StockWidget failing tests | `4c2eb2b` | stock-widget.test.tsx |
| 1 GREEN | StockWidget + StockLoadingSkeleton | `018f98f` | stock-widget.tsx, stock-loading-skeleton.tsx, stock-widget.test.tsx |
| 2 RED | TrendChartCard failing tests | `a89e797` | trend-chart-card.test.tsx |
| 2 GREEN | TrendChartCard | `b05229b` | trend-chart-card.tsx, trend-chart-card.test.tsx |
| 3 RED | ExplanationPanel failing tests | `c6a2a32` | explanation-panel.test.tsx |
| 3 GREEN | ExplanationPanel extended | `b0b39e5` | explanation-panel.tsx, explanation-panel.test.tsx, tests/components/explanation-panel.test.tsx |
| 4 | Prop threading | `28a5b2d` | document-reader-layout.tsx, mobile-tab-view.tsx, document-progress-view.tsx |
| 5 | RSC page.tsx wire-up | `bb3050b` | src/app/doc/[documentId]/page.tsx |

## Files Created/Modified

**Created:**
- `src/components/doc/stock-widget.tsx` — `"use client"`, aria-label="Market Data", 2×2 grid (84 lines)
- `src/components/doc/stock-loading-skeleton.tsx` — `"use client"`, h-[108px]+h-[268px] pulse blocks (18 lines)
- `src/components/doc/trend-chart-card.tsx` — `"use client"`, ComposedChart dual Y-axis, TrendTooltip (128 lines)

**Modified:**
- `src/components/doc/stock-widget.test.tsx` — 9 real assertions replacing 8 Wave 0 todos
- `src/components/doc/trend-chart-card.test.tsx` — 5 real assertions replacing 5 Wave 0 todos
- `src/components/doc/explanation-panel.test.tsx` — 7 real assertions replacing 6 Wave 0 todos
- `src/components/doc/explanation-panel.tsx` — +4 props, StockWidget + TrendChartCard slots inserted
- `src/components/doc/document-reader-layout.tsx` — DesktopSplitPane + DocumentReaderLayout extended; 3 ExplanationPanel/component forward sites
- `src/components/doc/mobile-tab-view.tsx` — MobileTabView extended; ExplanationPanel forward updated
- `src/components/doc/document-progress-view.tsx` — DocumentProgressView extended; both DocumentReaderLayout call sites updated
- `src/app/doc/[documentId]/page.tsx` — RSC extended: ticker read, fetchStockDataForDocument called, 4 props passed to DocumentProgressView
- `tests/components/explanation-panel.test.tsx` — 7 render calls updated with required Phase 9 props

## Decisions Made

- **Explicit afterEach cleanup:** jsdom render accumulation in vitest causes `getByText` to match across multiple test renders. Added explicit `afterEach(() => cleanup())` to all three new test files. This is idiomatic and does not change test semantics.
- **Heading role queries in regression guard:** `getByText("Revenue")` found two elements — the `<h2>` heading AND a `JargonTooltip` span wrapping "Revenue" in the explanation text. Switched to `getByRole("heading", { name: "Revenue" })` which targets only the `<h2>` unambiguously. Test intent is preserved.
- **Local tooltip interface types:** `TrendTooltip` uses `interface TooltipPayloadEntry` and `interface TrendTooltipProps` instead of importing Recharts' `TooltipContentProps`. This avoids fragile imports of internal Recharts types that may not be stable across minor versions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom render accumulation causing getByText to find multiple elements**
- **Found during:** Task 1 GREEN (stock-widget tests)
- **Issue:** All 9 tests rendered `StockWidget` into the same jsdom document. Without explicit cleanup, renders accumulated, causing later tests to find multiple `<span>Price</span>` elements.
- **Fix:** Added `afterEach(() => cleanup())` from `@testing-library/react` to all new test files.
- **Files modified:** `stock-widget.test.tsx`, `trend-chart-card.test.tsx`, `explanation-panel.test.tsx`
- **Commits:** `018f98f`, `a89e797`, `c6a2a32`

**2. [Rule 1 - Bug] getByText("Revenue") ambiguity in regression guard**
- **Found during:** Task 3 GREEN (explanation-panel tests)
- **Issue:** The JargonTooltip in ExplanationPanel wraps "revenue" from the explanation text fixture, creating a second element with text "Revenue" alongside the `<h2>` section heading. `getByText("Revenue")` threw "Found multiple elements".
- **Fix:** Changed regression guard to use `getByRole("heading", { name: "Revenue" })` which unambiguously selects the `<h2>` element only.
- **Files modified:** `src/components/doc/explanation-panel.test.tsx`
- **Commit:** `b0b39e5`

**3. [Rule 2 - Missing critical functionality] Updated tests/components/explanation-panel.test.tsx with Phase 9 props**
- **Found during:** Task 3 typecheck after extending ExplanationPanel
- **Issue:** `tests/components/explanation-panel.test.tsx` (Phase 7/8 regression test file) rendered ExplanationPanel without the 4 new required props. TypeScript reported TS2739 errors on 4 render calls.
- **Fix:** Added `ticker={null} stockData={null} chartData={null} stockError={false}` to all 7 render calls in the file. No behavior change — null props produce no visible output.
- **Files modified:** `tests/components/explanation-panel.test.tsx`
- **Commit:** `b0b39e5`

---

**Total deviations:** 3 auto-fixed (2 bug fixes, 1 required props update)

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm test --run src/components/doc/stock-widget.test.tsx` exits 0 (9 tests) | PASS |
| `pnpm test --run src/components/doc/trend-chart-card.test.tsx` exits 0 (5 tests) | PASS |
| `pnpm test --run src/components/doc/explanation-panel.test.tsx` exits 0 (7 tests) | PASS |
| `pnpm test --run tests/components/explanation-panel.test.tsx` exits 0 (7 tests) | PASS |
| `pnpm test --run src/components/doc/` exits 0 (27 tests) | PASS |
| `pnpm typecheck` exits 0 | PASS |
| `pnpm build` succeeds | PASS |
| `stock-widget.tsx` first line is `"use client"` | PASS |
| `stock-loading-skeleton.tsx` first line is `"use client"` | PASS |
| `trend-chart-card.tsx` first line is `"use client"` | PASS |
| `stock-widget.tsx` contains `aria-label="Market Data"` | PASS |
| `stock-loading-skeleton.tsx` contains `h-[108px]` and `h-[268px]` | PASS |
| `trend-chart-card.tsx` contains `yAxisId="left"` (×3) | PASS |
| `trend-chart-card.tsx` contains `yAxisId="margin"` (×2) | PASS |
| `trend-chart-card.tsx` contains `strokeDasharray="4 2"` | PASS |
| `explanation-panel.tsx` contains `"Market data temporarily unavailable."` | PASS |
| `explanation-panel.tsx` still contains `{SECTION_ORDER.map(` | PASS |
| `explanation-panel.tsx` still contains `<ScoreCard` | PASS |
| `grep -c 'stockData={stockData}' document-reader-layout.tsx` ≥ 2 | PASS (3) |
| `grep -c 'stockData={stockData}' document-progress-view.tsx` ≥ 2 | PASS (2) |
| `grep -q 'stockData={stockData}' mobile-tab-view.tsx` | PASS |
| `page.tsx` contains `fetchStockDataForDocument` import | PASS |
| `page.tsx` contains `.select("storage_path, ticker")` | PASS |
| `page.tsx` contains `stockError = true` inside ticker null-guard | PASS |
| No `it.todo` in any new test file | PASS |

## Known Stubs

None — all STOCK-01/02/03/04 and CHART-01/02 behavior is fully implemented and connected. The stock widget and trend chart render live data from yahoo-finance2 via the RSC fetch path. The only remaining step is human verification (Task 6 checkpoint) against a real BBCA document.

## Threat Flags

No new threat surface beyond what was declared in the plan's threat register. All T-09-04-01 through T-09-04-04 mitigations are in place:
- T-09-04-01 (XSS via stockData props): All metric values rendered via `{value}` JSX expressions — React auto-escapes. No `dangerouslySetInnerHTML` used anywhere.
- T-09-04-03 (DoS via malformed chartData): Zod schema at RSC boundary + `chartData !== null && chartData.length > 0` null-guard in ExplanationPanel.

## Awaiting Human Verification (Task 6)

Task 6 is a `checkpoint:human-verify` that requires a live BBCA document upload to verify the 5 Phase 9 success criteria. The automated build is complete and all 27 component tests pass. Human verification will confirm:

1. `documents.ticker = 'BBCA'` written after parse
2. StockWidget renders in explanation panel with live BBCA data
3. "Market data temporarily unavailable." shows for unmapped tickers (STOCK-03 fallback)
4. TrendChartCard tooltip shows `formatIDR`-formatted values (not raw integers)
5. TrendChartCard renders Revenue+NetIncome bars + NetMargin dashed line on correct axes

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/components/doc/stock-widget.tsx exists | PASS |
| src/components/doc/stock-loading-skeleton.tsx exists | PASS |
| src/components/doc/trend-chart-card.tsx exists | PASS |
| Commits 4c2eb2b, 018f98f, a89e797, b05229b, c6a2a32, b0b39e5, 28a5b2d, bb3050b in git log | PASS |
| pnpm typecheck exits 0 | PASS |
| pnpm build succeeds | PASS |
| 27 component tests pass | PASS |

---
*Phase: 09-stock-data-trend-chart*
*Completed: 2026-05-20*
