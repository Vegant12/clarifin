---
phase: 13-t1-data-and-indicators
plan: 05
subsystem: ui, charts
tags: [lightweight-charts, candlestick, technical-analysis, react, chart-components, ema, macd, rsi, bollinger-bands]

requires:
  - phase: 13-t1-data-and-indicators (plan 01)
    provides: lightweight-charts@5.2.0 installed + IndicatorSet type
  - phase: 13-t1-data-and-indicators (plan 03)
    provides: IndicatorSet shape + indicator-schema.ts

provides:
  - src/components/ta/chart-types.ts — ChartOHLCV, RangeKey, OverlayKey, CHART_COLORS, RANGE_TO_DAYS
  - src/components/ta/candlestick-chart.tsx — main panel + EMA/BB overlays + isSyncing sync guard + hover tooltip
  - src/components/ta/indicator-subpanel.tsx — volume/RSI/MACD subpanels with useEffect/cleanup
  - src/components/ta/range-selector.tsx — 5-button range picker (1M/3M/6M/1Y/2Y) with aria-pressed
  - src/components/ta/overlay-toggles.tsx — 4 overlay chip toggles with borderLeftColor active state
  - src/components/ta/indicator-tooltip.tsx — INDICATOR_DEFINITIONS + accessible shadcn Tooltip
  - src/components/ta/indicator-snapshot-strip.tsx — flex-wrap card strip per TA-IND-05/06

affects: [13-07]

tech-stack:
  added: []
  patterns:
    - lightweight-charts v5 series creation: chart.addSeries(CandlestickSeries, opts) — NOT v4 addCandlestickSeries()
    - LineWidth type is integer-only (1 | 2 | 3 | 4) in v5 — 1.5 is not assignable
    - isSyncing re-entrancy guard pattern for multi-chart time-axis sync (prevents infinite loop)
    - SSR guard: createChart only inside useEffect with if (!ref.current) return
    - Null indicator values mapped to omitted whitespace points (not NaN) via filter(Boolean)

key-files:
  created:
    - src/components/ta/chart-types.ts
    - src/components/ta/candlestick-chart.tsx
    - src/components/ta/indicator-subpanel.tsx
    - src/components/ta/range-selector.tsx
    - src/components/ta/overlay-toggles.tsx
    - src/components/ta/indicator-tooltip.tsx
    - src/components/ta/indicator-snapshot-strip.tsx
  modified: []

key-decisions:
  - "lightweight-charts v5 uses chart.addSeries(CandlestickSeries, opts) — confirmed via node --input-type=module introspection; v4 addCandlestickSeries() does not exist in v5"
  - "LineWidth in v5 is a branded integer type (1|2|3|4); 1.5 causes TS2322 — all line widths rounded to nearest integer"
  - "CandlestickChart receives overlays as props and applies series.applyOptions({visible}) in a separate useEffect — decouples chart lifecycle from toggle re-renders"
  - "isSyncing guard is a closure variable inside the main useEffect — not component state — to avoid triggering re-renders on each sync event"
  - "Task 3 (browser smoke) deferred to Plan 07 — requires full page wiring + seeded data; cannot be verified in isolation"

requirements-completed: [TA-CHART-01, TA-CHART-02, TA-CHART-03, TA-CHART-04, TA-CHART-05, TA-CHART-06, TA-IND-01, TA-IND-02, TA-IND-03, TA-IND-04, TA-IND-05, TA-IND-06, TA-IND-07]

duration: 25min
completed: 2026-06-06
---

# Phase 13 Plan 05: Chart Component Subtree Summary

**Seven "use client" chart components: candlestick main panel with volume/RSI/MACD subpanels synced via isSyncing guard, EMA/BB overlay toggles, range selector, and plain-English snapshot strip with definition tooltips.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-06T15:16:00Z
- **Completed:** 2026-06-06T15:41:07Z
- **Tasks:** 2/3 complete (Task 3 deferred per plan — browser smoke requires Plan 07)
- **Files created:** 7
- **Files modified:** 0

## Accomplishments

### Task 1: chart-types + candlestick-chart + indicator-subpanel

**lightweight-charts v5 API confirmed (for Plan 07 and T2):**

| API | v4 pattern | v5 actual (installed 5.2.0) |
|-----|-----------|------------------------------|
| Series creation | `chart.addCandlestickSeries(opts)` | `chart.addSeries(CandlestickSeries, opts)` |
| Line series | `chart.addLineSeries(opts)` | `chart.addSeries(LineSeries, opts)` |
| Histogram | `chart.addHistogramSeries(opts)` | `chart.addSeries(HistogramSeries, opts)` |
| LineWidth type | `number` | `1 \| 2 \| 3 \| 4` (integer only) |
| Crosshair subscribe | `chart.subscribeCrosshairMove(cb)` | `chart.subscribeCrosshairMove(cb)` (unchanged) |
| Time sync | `chart.timeScale().subscribeVisibleTimeRangeChange(cb)` | same (unchanged) |

- `chart-types.ts` (pure types + consts, NOT "use client"): `ChartOHLCV`, `RangeKey`, `OverlayKey`, `CHART_COLORS` (all UI-SPEC values), `RANGE_TO_DAYS` (1M=21, 3M=63, 6M=126, 1Y=252, 2Y=504)
- `indicator-subpanel.tsx`: volume/RSI/MACD panels, each creates own chart in `useEffect` with SSR guard, `chart.remove()` cleanup, ResizeObserver for container size
  - RSI: two `createPriceLine` calls at 30/70 (dashed, zinc-400)
  - MACD: histogram (emerald+/red-) + fast line (indigo) + signal line (orange)
  - Volume: histogram bars colored emerald/red by up/down day at 60% opacity
  - `onChartReady(chart)` callback for parent to wire `subscribeVisibleTimeRangeChange`
- `candlestick-chart.tsx`: orchestrator
  - Single `useEffect([ohlcv, indicators])` — SSR guard, creates main chart, candlestick series with CHART_COLORS
  - EMA-20/50/200 + Bollinger upper/middle/lower as `LineSeries` overlays; defaults: EMA-50/200 visible, EMA-20/BB hidden
  - Series refs (`ema20Ref`, `ema50Ref`, etc.) for parent-driven `applyOptions({visible})`
  - Subpanel sync: `let isSyncing = false` closure variable + `syncFrom(source, charts)` guard function; main→subpanels subscribed immediately; subpanel→main subscribed via `setTimeout(0)` microtask after subpanels mount
  - `subscribeCrosshairMove` renders floating tooltip div with date + OHLCV + volume (IDR number formatting, "Vol: 1.2M")
  - `role="img" aria-label="{ticker} interactive price chart, {range} view"` on main container
  - ResizeObserver + `chart.remove()` cleanup on unmount

### Task 2: range-selector + overlay-toggles + indicator-tooltip + indicator-snapshot-strip

- `range-selector.tsx`: 5 `<Button size="sm">` with `aria-pressed`, variant="default" on active, "outline" on inactive
- `overlay-toggles.tsx`: 4 chips (Bollinger Bands / EMA 20 / EMA 50 / EMA 200); on-state: `variant="outline" + bg-muted + borderLeftColor` via inline style in series color; off-state: `variant="ghost"`
- `indicator-tooltip.tsx`: `INDICATOR_DEFINITIONS: Record<string,string>` for 11 indicator keys; shadcn `<TooltipProvider><Tooltip>` wrapping `<TooltipTrigger asChild aria-label="What is {indicatorName}?">` + `<TooltipContent>`
- `indicator-snapshot-strip.tsx`: `flex-wrap gap-2 overflow-x-auto` container; per-key `<Card>` chip with `<p class="text-xs font-semibold text-muted-foreground">{label}` + `<p class="text-sm text-foreground">{snapshot[key]}`; each chip wrapped in `<IndicatorTooltip>`

### Task 3: Browser smoke (deferred to Plan 07)

Per plan specification: "run this verification during/after Plan 07 on a Vercel preview deploy (NEXT_PUBLIC_TA_ENABLED=true in preview)." Plan 07 mounts this subtree inside the RSC `/ta/[ticker]` page. Verification steps and acceptance criteria are in the Plan 05 task spec and will be executed during Plan 07 browser smoke.

## Task Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1 | 78bd16b | chart-types.ts, indicator-subpanel.tsx, candlestick-chart.tsx |
| Task 2 | 41f9841 | range-selector.tsx, overlay-toggles.tsx, indicator-tooltip.tsx, indicator-snapshot-strip.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lightweight-charts v5 LineWidth type is integer-only**
- **Found during:** Task 1 (typecheck after writing components)
- **Issue:** Plan used `lineWidth: 1.5` for RSI, MACD, and EMA lines. In v5, `LineWidth` is a branded type that only accepts `1 | 2 | 3 | 4` — `1.5` causes `TS2322: Type '1.5' is not assignable to type 'DeepPartial<LineWidth>'`
- **Fix:** Changed all `lineWidth: 1.5` to `lineWidth: 2` (nearest integer that maintains visual weight)
- **Files modified:** indicator-subpanel.tsx, candlestick-chart.tsx
- **Commit:** 78bd16b (fix applied before Task 1 commit)

**2. [Rule 2 - Missing functionality] ResizeObserver for canvas size tracking**
- **Found during:** Task 1 implementation
- **Issue:** Plan did not specify a resize handler. Without one, the lightweight-charts canvas is created at the initial container size and never updates when the browser window resizes.
- **Fix:** Added `ResizeObserver` in each chart's `useEffect` calling `chart.applyOptions({ width, height })` on container size change; `ro.disconnect()` in cleanup
- **Files modified:** candlestick-chart.tsx, indicator-subpanel.tsx
- **Commit:** 78bd16b

**3. [Rule 2 - Missing functionality] Subpanel→main sync wired via setTimeout(0)**
- **Found during:** Task 1 (analyzing sync wiring gap)
- **Issue:** PATTERNS.md shows subscribing subpanel charts to `syncFrom`, but the subpanel `IChartApi` refs are populated by `onChartReady` callbacks — which fire during the subpanel render pass, after the main `useEffect` has already run. Direct subscription in the main `useEffect` would miss the subpanel charts.
- **Fix:** Wrapped subpanel subscription loop in `setTimeout(() => { ... }, 0)` — defers to after the current render pass; `clearTimeout(syncTimer)` in cleanup
- **Files modified:** candlestick-chart.tsx
- **Commit:** 78bd16b

## Known Stubs

None — all seven components are fully implemented and presentational. Data wiring (ohlcv/indicators/snapshot props) is handled by Plan 07.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. All seven components are pure client-side presentational components (no `server-only`, no env imports, no Supabase calls). Trust boundaries confirmed:
- T-13-17 (isSyncing guard): implemented in candlestick-chart.tsx
- T-13-18 (SSR null-ref guard): `if (!ref.current) return` in every chart useEffect
- T-13-19 (null→whitespace): `.filter(Boolean)` on all indicator point arrays
- T-13-20 (no server secrets): only lightweight-charts + shadcn + chart-types imports

## Self-Check: PASSED

```
FOUND: src/components/ta/chart-types.ts
FOUND: src/components/ta/candlestick-chart.tsx
FOUND: src/components/ta/indicator-subpanel.tsx
FOUND: src/components/ta/range-selector.tsx
FOUND: src/components/ta/overlay-toggles.tsx
FOUND: src/components/ta/indicator-tooltip.tsx
FOUND: src/components/ta/indicator-snapshot-strip.tsx
FOUND: 78bd16b (Task 1 commit)
FOUND: 41f9841 (Task 2 commit)
TYPECHECK: 0 errors in src/components/ta/* (pre-existing snapshot-copy + session-restore errors unchanged)
```
