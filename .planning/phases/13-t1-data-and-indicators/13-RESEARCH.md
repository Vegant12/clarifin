# Phase 13: T1 Data & Indicators — Research

**Researched:** 2026-06-06
**Domain:** OHLCV data pipeline, technical indicators, lightweight-charts candlestick chart, dispatcher cron consolidation, ONNX hello-world smoke — all within an existing Next.js 15 / Vercel Hobby / Supabase stack.
**Confidence:** HIGH on integration patterns (codebase verified); HIGH on library versions (npm registry confirmed); MEDIUM on Vercel runtime behavior (partially assumed — flagged).

---

## Summary

Phase 13 (T1) is a **foundation-laying phase** for the v2.0 TA Module. No user-facing AI calls happen in T1 — the entire phase is data pipeline + chart rendering + infrastructure wiring. T2 (patterns) and T3 (ML training) both depend on T1's `ohlcv_cache` and `ticker_metadata` tables being fully populated, so this phase must be done cleanly.

The codebase already supplies every primitive T1 needs. The yahoo-finance2 OHLCV fetch pattern is a direct extension of `src/lib/stock/fetch-stock-data.ts` — same `withBackoff` wrapper, same `server-only` boundary, same Supabase upsert shape. The `timingSafeStringEq` + `extractBearer` auth helpers are **duplicated verbatim** across all three existing internal routes (parse-batch, embed-batch, analyze-batch) and must be extracted to `src/lib/internal-auth.ts` in Wave 0 before writing any new cron-adjacent code. The chart library decision was locked in CONTEXT.md: `lightweight-charts` 5.2.0 (TradingView OSS, Apache-2.0), not Recharts. This is a canvas-based library, not SVG, requiring a `"use client"` component with synchronised sub-panels wired via `subscribeVisibleTimeRangeChange`.

The two most technically novel elements in T1 are: (1) **lightweight-charts subpanel sync** — the library has no built-in multi-panel system; each subpanel (volume, RSI, MACD) is a separate chart instance that must subscribe to the main chart's visible time range and mirror it; and (2) **the dispatcher cron migration** — replacing the existing two crons (`parse-batch`, `embed-batch`) with a single dispatcher at Wave 3 is a destructive, one-shot change that must be verified in a preview deploy before touching production.

**Primary recommendation:** Execute waves strictly in order. Wave 0 extractions and migrations are the foundation every other wave depends on. Do not start Wave 1 file work until migrations are applied and `internal-auth.ts` exists. Do not start Wave 3 dispatcher wiring until Wave 2 routes are working end-to-end against real data.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** lightweight-charts (TradingView OSS, Apache-2.0) for the chart library. Indicator subpanels (volume / RSI / MACD) are separate chart instances with synced time axes via `subscribeVisibleTimeRangeChange`. Recharts rejected for OHLC work (requires custom Shape; T2 markers would need a custom overlay).
- **D-02:** `ticker_metadata` seed source = market-cap top-100 from yahoo-finance2. One-shot script output committed to repo as JSON (deterministic deploys).
- **D-03:** Minimum-history filter ≥2yr at seed time. Expected final autocomplete list = 85–100 tickers. Script `scripts/ta/seed-and-backfill.ts` combines seed + 5yr backfill.
- **D-04:** `/ta` discoverability gated on `NEXT_PUBLIC_TA_ENABLED` env flag. Flag stays `false` in production until Wave 3 E2E smoke passes and `13-VERIFICATION.md` is committed. Route works in preview deploys throughout T1.
- **D-05:** Mobile <640px shows clean "Best on desktop" info card — no chart UI. Phase 16 (T4) owns full 375px polish.
- **D-06:** 5yr backfill ships in T1 Wave 0/1 via `scripts/ta/seed-and-backfill.ts`. Preserves T2 ‖ T3 parallelization on the critical path.

### Claude's Discretion

The following are NOT user decisions — planner owns them:
- Exact lightweight-charts subpanel sync wiring (visible-range subscription pattern).
- Indicator-snapshot strip copy wording (direction-only form locked; severity adjectives "strong/weak" optional).
- Dispatcher cron migration sequencing (TA-INFRA-02) — same-deploy hard cutover vs old-routes-as-fallback. Planner picks based on risk appetite.
- ONNX hello-world smoke protocol (TA-INFRA-04) — number of cold curls, time-of-day, exact threshold. Planner specifies in PLAN.md.
- Wave 1 parallelization details.
- Schema column types + constraints for `ohlcv_cache` and `ticker_metadata`.
- `src/lib/internal-auth.ts` extraction details.

### Deferred Ideas (OUT OF SCOPE)

- Pattern detection + markers + Gemini streaming explanation + three-tier disclaimer framework + bilingual buy/sell sanitizer extraction → Phase 14 (T2).
- XGBoost training + ONNX inference + probability widget + model-accuracy card + `pattern_outcome_log` table → Phase 15 (T3). (T1 Wave 3 only deploys a hello-world dummy `.onnx` for cold-start measurement.)
- TA follow-up RAG chat + per-IP rate limiting on `/api/ta/*` + Langfuse instrumentation on TA Gemini calls + full 375px mobile polish + 30-prompt adversarial CHAT-06 red-team → Phase 16 (T4).
- v1.0 launch blockers R2 (analyze-batch cron), R3 (keep-alive cron), R4 (session-ownership TODO) remain in Backlog 999.6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TA-INGEST-01 | Fetch and cache IDX OHLCV via yahoo-finance2 for `.JK` tickers; validate bars (high<low, close<0, vol<0, >50% single-bar return); IDX trading calendar; surface gaps in UI | fetch-ohlcv.ts mirrors fetch-stock-data.ts withBackoff + server-only pattern; validation rules documented in PITFALLS D3; upsert-ohlcv.ts writes to ohlcv_cache with UNIQUE(ticker, date) |
| TA-DATA-01 | One-off backfill script populates 5yr+ historical OHLCV for top-100 IDX tickers | scripts/ta/seed-and-backfill.ts — combined seed + 5yr backfill per D-06; yahoo-finance2 `historical()` supports 5yr range; ~2min runtime for ~100 tickers |
| TA-TICKER-01 | Debounced autocomplete search by ticker code or company name (EN or ID) from ticker_metadata | /api/ta/search route; in-memory or simple ILIKE on ticker_metadata; <Command> shadcn component per UI-SPEC |
| TA-TICKER-02 | Ticker URLs uppercase without `.JK`; lowercase 301s to uppercase | Next.js `redirect()` in /ta/[ticker]/page.tsx; same regex as v1.0 stock route `/^[A-Z]{1,5}$/` |
| TA-CHART-01 | Interactive candlestick chart (OHLC bars, up/down coloring) | lightweight-charts 5.2.0 CandlestickSeries; color config in CHART_COLORS constant per UI-SPEC |
| TA-CHART-02 | Volume subpanel below price chart, bars colored by up/down day | Separate lightweight-charts instance; 80px height; sync via subscribeVisibleTimeRangeChange |
| TA-CHART-03 | Range selector 1M/3M/6M/1Y/2Y preset | Client-side range filter on pre-loaded 2Y OHLCV; no API re-call; 1Y default per UI-SPEC |
| TA-CHART-04 | Hover tooltip with date and OHLCV values | lightweight-charts built-in crosshair + custom tooltip overlay; UI-SPEC defines px-3 py-2 card style |
| TA-CHART-05 | Zoom and pan (wheel/drag desktop) | lightweight-charts built-in; enabled by default on desktop; mobile shows info card (D-05) |
| TA-CHART-06 | Crosshair tracking cursor | lightweight-charts built-in crosshairMode |
| TA-CHART-07 | Invalid/unrecognized tickers show friendly error; in-flight shows skeleton | TAErrorCard + TAPageSkeleton per UI-SPEC; Zod validate path param; 404 on not-in-ticker_metadata |
| TA-CHART-08 | <30 candles shows sparse-data state with no indicators | SparseDataCard per UI-SPEC; gate in RSC before rendering chart components |
| TA-IND-01 | RSI(14) subpanel with 30/70 reference lines | technicalindicators RSI.calculate(); separate lightweight-charts instance; 100px height; warmup = 14 bars |
| TA-IND-02 | MACD(12,26,9) subpanel with histogram | technicalindicators MACD.calculate(); separate instance; 120px height; warmup = slow(26)+signal(9)-1 = 34 bars |
| TA-IND-03 | Bollinger Bands(20, 2σ) togglable overlay | technicalindicators BollingerBands.calculate(); LineSeries on main chart; default OFF per UI-SPEC |
| TA-IND-04 | EMA-20/50/200 togglable overlays (defaults: EMA-50 and EMA-200 ON, EMA-20 OFF) | technicalindicators EMA.calculate(); LineSeries on main chart; toggle via series.applyOptions({visible}) |
| TA-IND-05 | Indicator snapshot strip with plain-English one-liners | IndicatorSnapshotStrip component; server-computed at cache-write time; format per UI-SPEC examples |
| TA-IND-06 | Plain-English interpretation hint per indicator on hover/click | IndicatorTooltip component; shadcn Tooltip; static text — no LLM in T1 |
| TA-IND-07 | Overlay toggle controls as chip selectors above chart | OverlayToggles component per UI-SPEC; BB / EMA-20 / EMA-50 / EMA-200 chips |
| TA-INFRA-02 | All Vercel crons consolidated under single dispatcher; direct function imports (no HTTP self-fetch); each job accepts {deadline} | /api/internal/dispatch route; replaces vercel.json crons with dispatcher daily (11:00 UTC) + weekly pair; exactly 2 crons |
| TA-INFRA-04 | ONNX hello-world preview-deploy smoke; measure cold INIT_DURATION; record in VERIFICATION.md | Dummy 5MB .onnx file; outputFileTracingIncludes in next.config; cold curl on Vercel preview; planner specifies measurement protocol |
| TA-UX-01 | Shared SiteHeader in RootLayout with Upload Document / TA Analysis surface switching | SiteHeader component per UI-SPEC; mounted in src/app/layout.tsx; reads NEXT_PUBLIC_TA_ENABLED |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `/ta/{ticker}` page render | Frontend Server (RSC) | Browser (client chart subtree) | Mirrors `/doc/[documentId]/page.tsx` — RSC fetches cached analysis, passes serialized props to CandlestickChart client component |
| Ticker autocomplete UI | Browser / Client | API / Backend (/api/ta/search) | Debounced input fires search route; results rendered client-side via shadcn Command |
| OHLCV fetch + cache | API / Backend (internal worker + seed script) | Database (ohlcv_cache) | yahoo-finance2 is server-only (CORS blocked from browser; Phase 9 lesson) |
| Indicator computation | API / Backend (analysis route) | — | Pure CPU; technicalindicators runs synchronously; result cached in ta_analysis_cache |
| Candlestick chart rendering | Browser / Client | — | lightweight-charts is canvas-based; requires "use client"; subpanels are separate chart instances |
| Overlay toggle state | Browser / Client | — | Pure UI state; calls series.applyOptions({visible}) on the lightweight-charts series object |
| Range selector state | Browser / Client | — | Filters already-loaded OHLCV client-side; no API re-call |
| Indicator snapshot strip copy | API / Backend (analysis route) | Database (ta_analysis_cache) | Computed server-side at cache-write time; stored as JSONB; matches "expensive compute lives in cache" v1.0 pattern |
| Cron dispatcher | API / Backend (/api/internal/dispatch) | — | Direct function imports; no HTTP self-fetch; 60s budget with deadline tracking |
| ONNX hello-world smoke | API / Backend (preview deploy only) | — | Verify onnxruntime-node cold-start before T3 commits to ONNX architecture |
| SiteHeader | Browser / Client (mounted in RootLayout) | — | Reads NEXT_PUBLIC_TA_ENABLED; conditionally renders TA Analysis nav link |

---

## Standard Stack

### Core (T1 additions — verified against npm registry 2026-06-06)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lightweight-charts` | 5.2.0 | Candlestick chart + subpanels (volume, RSI, MACD) | D-01 locked; TradingView OSS Apache-2.0; canvas-based (handles large OHLCV efficiently); built-in zoom/pan/crosshair/tooltip; native setMarkers() API unblocks T2 pattern markers |
| `technicalindicators` | 3.1.0 | RSI, MACD, Bollinger, EMA, SMA, ATR, Stochastic, OBV | Only widely-used pure-JS TA library with all required indicators; no native deps (unlike tulind/ta-lib which break Vercel builds); 5MB uncompressed |

[VERIFIED: npm registry — `npm view lightweight-charts version` → 5.2.0, published 2026-04-24; license Apache-2.0; unpackedSize 3MB]
[VERIFIED: npm registry — `npm view technicalindicators version` → 3.1.0, unpackedSize 5MB; pure JS (no native deps in engines field)]

### Existing (reused from v1.0 — confirmed in package.json 2026-06-06)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js | 15.5.15 | App Router, RSC, API routes | Already shipped |
| `yahoo-finance2` | 3.14.1 (installed), 3.15.2 (latest) | OHLCV historical data via `.JK` tickers | Already shipped (Phase 9); latest available |
| Supabase Postgres | current | `ohlcv_cache`, `ticker_metadata` | Already shipped |
| `@supabase/supabase-js` | 2.105.1 | DB client | Already shipped |
| shadcn/ui (Command, Button, Card, Skeleton, Tooltip) | current | UI primitives | Already shipped (new-york/zinc/emerald) |
| Tailwind v4 + lucide-react | current | Styling, icons | Already shipped |
| Vitest | 2.1.9 | Unit tests | Already shipped |
| t3-env | 0.11.1 | Type-safe env | Already shipped |
| `server-only` | 0.0.1 | Import boundary protection | Already shipped; critical for all TA server modules |
| Zod | 3.25.76 | Validation at every boundary | Already shipped |

[VERIFIED: package.json — all versions confirmed in codebase]

### Not Added (with rationale)

| Rejected | Reason |
|----------|--------|
| `technicalindicators` > 3.1.0 | 3.1.0 is already the latest; no newer version exists as of npm registry check |
| `onnxruntime-node` (for T1 inference) | NOT installed in T1; only needed for hello-world smoke in Wave 3 (no actual model inference in T1) |
| `tulind` | C++ native deps; breaks Vercel builds (same pattern as pdf-parse rejection in v1.0) |
| Recharts for candlestick | D-01 locked against; requires custom Shape for OHLC; no native setMarkers() |
| `fuse.js` | Not needed for autocomplete at this scale; simple ILIKE on ticker_metadata is sufficient |

### Installation (Wave 0)

```bash
pnpm add lightweight-charts technicalindicators
```

Note: `onnxruntime-node` is installed separately in Wave 3 as a devDependency (or temporary production dep) solely for the TA-INFRA-04 hello-world smoke. The planner must decide whether to install it as a regular dep (keeps it in prod bundle, enabling T3 to reuse) or a Wave 3 one-shot. Given T3 will need it, recommend installing as a regular production dependency in Wave 3.

---

## Architecture Patterns

### System Architecture Diagram — T1 Data Flow

```
[scripts/ta/seed-and-backfill.ts] ──── one-shot ────► [yahoo-finance2]
                                                              │
                                                    5yr OHLCV per ticker
                                                              │
                                                              ▼
                                                   [ohlcv_cache table]
                                                   [ticker_metadata table]
                                                              │
            ┌─────────────────────────────────────────────────┘
            │ (nightly after Wave 3 ships)
            ▼
[/api/internal/dispatch?job=daily]
   ├── runParseBatch()         (existing v1.0 job)
   ├── runEmbedBatch()         (existing v1.0 job)
   ├── runAnalyzeBatch()       (existing v1.0 job)
   └── runTaRefreshOhlcv()     (NEW — appends latest trading day OHLCV)
            │
            ▼
   [ohlcv_cache] ── latest bar appended

            │
            ▼
[GET /api/ta/analysis/[ticker]]
   ├── read ohlcv_cache (N bars for range)
   ├── compute indicators (technicalindicators)
   ├── compute indicator snapshot copy (plain-English one-liners)
   └── return AnalysisPayload JSON
            │
            ▼
[/ta/[ticker]/page.tsx — RSC]
   ├── fetch cached analysis
   ├── gate: <30 candles → SparseDataCard
   ├── gate: not in ticker_metadata → TAErrorCard
   └── pass serialized props ──► [CandlestickChart — "use client"]
                                       │
                             ┌─────────┼─────────────┐
                             ▼         ▼             ▼
                         [Main chart] [Volume] [RSI + MACD]
                         [subpanel]   [subpanel]
                             │
                    subscribeVisibleTimeRangeChange
                    (syncs all 4 panels)

[GET /api/ta/search?q=] ──► [ticker_metadata ILIKE query] ──► [TickerSearch dropdown]

[Vercel Cron — daily 11:00 UTC]  ──► /api/internal/dispatch?job=daily
[Vercel Cron — weekly Sundays]   ──► /api/internal/dispatch?job=weekly
(total: exactly 2 crons, replacing existing 2)
```

### Recommended Project Structure (T1 additions)

```
src/
├── app/
│   ├── layout.tsx                    # EXTEND: mount <SiteHeader /> above {children}
│   └── ta/
│       ├── page.tsx                  # /ta landing (ticker search)
│       └── [ticker]/
│           └── page.tsx              # RSC: fetch cached analysis, gate states
├── api/
│   └── ta/
│       ├── analysis/[ticker]/route.ts  # GET: fetch OHLCV + compute indicators + cache
│       └── search/route.ts             # GET: ticker autocomplete from ticker_metadata
├── api/
│   └── internal/
│       └── dispatch/
│           └── route.ts              # NEW: single cron dispatcher
├── components/
│   ├── site-header.tsx               # NEW: shared nav (Upload Document | TA Analysis)
│   └── ta/
│       ├── candlestick-chart.tsx     # "use client"; lightweight-charts main + subpanels
│       ├── range-selector.tsx        # shadcn Button chips
│       ├── overlay-toggles.tsx       # BB / EMA toggle chips
│       ├── indicator-snapshot-strip.tsx  # plain-English one-liner cards
│       ├── indicator-tooltip.tsx     # shadcn Tooltip with definition
│       ├── ticker-search.tsx         # shadcn Command with debounced search
│       ├── ta-page-skeleton.tsx      # loading state
│       ├── ta-error-card.tsx         # invalid ticker state
│       ├── sparse-data-card.tsx      # <30 candles state
│       └── mobile-info-card.tsx      # <640px fallback
└── lib/
    ├── internal-auth.ts              # EXTRACT from parse/embed/analyze-batch
    └── ta/
        ├── ohlcv/
        │   ├── fetch-ohlcv.ts        # yahoo-finance2 historical() with backoff
        │   └── upsert-ohlcv.ts       # Supabase insert/upsert into ohlcv_cache
        ├── indicators/
        │   └── compute-indicators.ts # technicalindicators wrappers + align()
        ├── cache/
        │   └── get-analysis.ts       # read/write ta_analysis_cache (T2+ expands this)
        └── jobs/
            └── refresh-ohlcv.ts      # runTaRefreshOhlcv({ deadline }) job function

scripts/
└── ta/
    └── seed-and-backfill.ts          # one-shot: market-cap top-100 seed + 5yr OHLCV

supabase/migrations/
└── 20260606XXXXXX_ta_t1_schema.sql   # ohlcv_cache + ticker_metadata tables + indices
```

### Pattern 1: lightweight-charts Subpanel Sync

**What:** Four chart instances (main price, volume, RSI, MACD) must share a synchronized visible time range. lightweight-charts has no built-in multi-panel layout — each instance is independent.

**When to use:** Any time the user pans/zooms the main chart; all subpanels must follow.

**Example:**

```typescript
// Source: lightweight-charts docs — IChartApi.timeScale().subscribeVisibleTimeRangeChange
// Pattern confirmed from CONTEXT.md D-01 and ARCHITECTURE.md §6.5

const mainChart = createChart(mainRef.current, { /* ... */ });
const volumeChart = createChart(volumeRef.current, { /* ... */ });
const rsiChart = createChart(rsiRef.current, { /* ... */ });
const macdChart = createChart(macdRef.current, { /* ... */ });

let isSyncing = false; // prevent re-entrant sync loops

function syncFrom(source: IChartApi) {
  if (isSyncing) return;
  isSyncing = true;
  const range = source.timeScale().getVisibleRange();
  if (range) {
    [volumeChart, rsiChart, macdChart].forEach((c) => {
      if (c !== source) c.timeScale().setVisibleRange(range);
    });
    // If source is a subpanel, also update main
    if (source !== mainChart) mainChart.timeScale().setVisibleRange(range);
  }
  isSyncing = false;
}

mainChart.timeScale().subscribeVisibleTimeRangeChange(() => syncFrom(mainChart));
volumeChart.timeScale().subscribeVisibleTimeRangeChange(() => syncFrom(volumeChart));
// repeat for rsiChart, macdChart
```

**Warning:** Guard with `isSyncing` flag. Without it, syncing A→B triggers B's subscription which syncs B→A, creating an infinite loop that crashes the browser tab. [ASSUMED: based on standard lightweight-charts community pattern; verify with actual lwc docs if subscription fires synchronously]

### Pattern 2: technicalindicators Warmup Alignment

**What:** Every indicator returns an array shorter than the input by its warmup period. RSI(14) returns 14 fewer values; MACD(12,26,9) returns `slowPeriod + signalPeriod - 2 = 34` fewer values. These must be left-padded with `null` to align with the corresponding OHLCV bars.

**When to use:** Every indicator before serializing to the API response.

**Example:**

```typescript
// Source: PITFALLS.md C2 + ARCHITECTURE.md §5 warmup analysis
// VERIFIED: technicalindicators@3.1.0 keyword list confirms RSI, MACD, BB, EMA present

const WARMUP = {
  RSI: (period: number) => period,
  MACD: (fast: number, slow: number, signal: number) => slow + signal - 2,
  BollingerBands: (period: number) => period - 1,
  EMA: (period: number) => period - 1,
  Stochastic: (period: number) => period - 1,  // %K warmup; %D adds smoothing period
  ATR: (period: number) => period,
  OBV: () => 0, // OBV has no warmup; but slice if computing from partial data
} as const;

function alignIndicator<T>(values: T[], totalBars: number, warmup: number): (T | null)[] {
  // Pad from the left with nulls so index[i] corresponds to ohlcv[i]
  return [...Array(warmup).fill(null), ...values];
  // NOTE: assert values.length + warmup === totalBars or log a mismatch warning
}
```

**Fixture requirement (TA-owned in T1 VERIFICATION.md):** `tests/indicators.fixture.test.ts` must exist, contain a 250-bar synthetic OHLCV series, and assert RSI/MACD/BB last values match a committed ground-truth JSON within 0.001 tolerance. This is the T1 acceptance criterion per PITFALLS.md C2.

### Pattern 3: Dispatcher — Direct Function Import

**What:** The `vercel.json` cron hits `/api/internal/dispatch?job=daily`. The dispatcher route invokes job handlers as TypeScript function imports, not via HTTP fetch. This is mandatory to avoid the 508 INFINITE_LOOP_DETECTED error documented at parse-batch/route.ts lines 13-22.

**When to use:** Every job the cron needs to run.

**Example:**

```typescript
// Source: ARCHITECTURE.md §3.4; parse-batch/route.ts:13-22 comment block (VERIFIED in codebase)

import { runParseBatch } from "@/lib/ingest/parse-document-batch";
import { runEmbedBatch } from "@/lib/ingest/embed-document-batch";
import { runAnalyzeBatch } from "@/lib/ingest/analyze-document-batch";
import { runTaRefreshOhlcv } from "@/lib/ta/jobs/refresh-ohlcv";

export const maxDuration = 60;
export const runtime = "nodejs";

async function handleDaily(deadline: number): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  const jobs = [runParseBatch, runEmbedBatch, runAnalyzeBatch, runTaRefreshOhlcv];
  for (const job of jobs) {
    if (Date.now() > deadline) {
      results[job.name] = { skipped: "deadline" };
      break;
    }
    results[job.name] = await job({ deadline: new Date(deadline) }).catch((e) => ({
      error: String(e),
    }));
  }
  return results;
}
```

**Auth:** Reuses `INTERNAL_PARSE_SECRET` via `extractBearer` + `?secret=` dual-path, extracted to `src/lib/internal-auth.ts`. The `?secret=` path is required because Vercel cron GET requests cannot send custom headers.

### Pattern 4: OHLCV Fetch — Extension of fetch-stock-data.ts

**What:** `fetch-ohlcv.ts` mirrors the shape of `src/lib/stock/fetch-stock-data.ts` — same `withBackoff`, same `server-only`, same return-null-on-failure convention. The key difference: uses `yahooFinance.chart()` or `yahooFinance.historical()` for time-series data rather than `quote()` + `quoteSummary()`.

**Example:**

```typescript
// Source: fetch-stock-data.ts pattern (VERIFIED in codebase); yahoo-finance2 API [ASSUMED]
import "server-only";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export type OHLCVBar = {
  date: string;       // ISO date "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
};

export async function fetchOHLCV(
  ticker: string,
  period1: Date,
  period2: Date,
): Promise<OHLCVBar[] | null> {
  if (!/^[A-Z]{1,5}$/.test(ticker)) return null;
  const symbol = `${ticker}.JK`;
  // yahoo-finance2 historical() returns array of daily bars
  const bars = await withBackoff(() =>
    yahooFinance.historical(symbol, { period1, period2, interval: "1d" })
  );
  if (!bars || bars.length === 0) return null;
  // Validate each bar (TA-INGEST-01)
  return bars
    .filter((b) => b.high >= b.low && b.close > 0 && b.volume >= 0)
    .map((b) => ({
      date: b.date.toISOString().slice(0, 10),
      open: b.open, high: b.high, low: b.low,
      close: b.close, adjClose: b.adjClose ?? b.close,
      volume: b.volume,
    }));
}
```

**Data quality rules (TA-INGEST-01):** Reject bars where `high < low`, `close < 0`, `volume < 0`, or single-bar return > 50% (likely uncorrected split). Log rejections via `console.warn`. Do NOT silently interpolate gaps > 2 sessions — surface as a data gap flag in the API response.

### Pattern 5: internal-auth.ts Extraction

**What:** `timingSafeStringEq` and `extractBearer` are currently duplicated verbatim in all three existing internal routes. Extract to a shared module.

**Example:**

```typescript
// Source: src/app/api/internal/parse-batch/route.ts lines 24-43 (VERIFIED in codebase)
// Same code in embed-batch/route.ts and analyze-batch/route.ts — confirmed duplication

import { timingSafeEqual } from "node:crypto";

export function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  const len = Math.max(ba.length, bb.length);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  ba.copy(padA); bb.copy(padB);
  return timingSafeEqual(padA, padB) && ba.length === bb.length;
}

export function extractBearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

export function resolveCandidate(request: Request): string {
  const url = new URL(request.url);
  return extractBearer(request) ?? url.searchParams.get("secret") ?? "";
}
```

After extraction: update parse-batch, embed-batch, analyze-batch to `import { timingSafeStringEq, extractBearer, resolveCandidate } from "@/lib/internal-auth"`. All three existing routes must be updated in Wave 0 before any new internal route is created.

### Anti-Patterns to Avoid

- **HTTP self-fetch in dispatcher:** Causes 508 INFINITE_LOOP_DETECTED on Vercel. Parse-batch comment block (lines 13-22) documents this explicitly. Always use direct function imports.
- **Edge runtime on any TA route:** lightweight-charts imports are browser-only (but used in client components, not routes); more critically, any route that imports onnxruntime-node (Wave 3 smoke) must declare `export const runtime = "nodejs"`. Forgetting this is the most common Vercel mistake with native deps.
- **Importing technicalindicators in client components:** technicalindicators is fine in client components (pure JS, no native deps), but the analysis computation must happen server-side so results can be cached. Only chart rendering happens client-side.
- **No warmup alignment:** Off-by-one misalignment shifts indicators by their warmup period relative to price bars. Must pad with nulls from the left.
- **Rendering NaN indicator values:** If fewer bars than warmup period exist, technicalindicators returns empty array or NaN. Gate on <30 candles (SparseDataCard) before computing any indicator.
- **Not adding UNIQUE(ticker, date) constraint on ohlcv_cache:** Concurrent cron runs can produce duplicate rows without this. PITFALLS.md P2 lists this as a predicted v2.0 launch blocker.
- **Importing onnxruntime-node before adding it to package.json:** Will fail the build. Wave 3 smoke requires installing it first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Indicator math | Custom RSI/MACD/BB/EMA/Stochastic | `technicalindicators@3.1.0` | Multiple valid formulations exist; users will compare to TradingView/Stockbit; off-by-ones are subtle |
| Candlestick rendering | Custom OHLC SVG shapes | `lightweight-charts@5.2.0` | Crosshair, zoom, pan, axis labels, hover tooltip all built in; canvas-based for performance |
| Chart subpanel sync | Custom event system | `subscribeVisibleTimeRangeChange` + guard flag | lightweight-charts API designed for exactly this; hand-rolled would miss edge cases |
| OHLCV ingestion | Direct HTTP scraping of Yahoo | `yahoo-finance2@3.14.1` (already in stack) | Already solved; `.JK` suffix already handled |
| Ticker validation | Loose regex | `/^[A-Z]{1,5}$/` (same as v1.0 fetch-stock-data.ts) | Enforced consistently; already in codebase |
| Internal auth helpers | Per-route implementation | `src/lib/internal-auth.ts` (extracted in Wave 0) | Currently triplicated; 4th duplication in dispatcher would be unmaintainable |
| Autocomplete fuzzy match | Custom search | Simple ILIKE query on ticker_metadata (or in-memory filter over the ~100 ticker JSON) | Ticker list is small; no vector search needed |

**Key insight:** T1's value is the data pipeline and chart integration, not novel algorithm implementations. Every computation in T1 has a well-maintained library solution.

---

## Runtime State Inventory

T1 is a greenfield TA surface — no existing TA runtime state to migrate. The phase adds new tables and new cron jobs but does not rename or replace any v1.0 data.

**Cron migration exception:** The vercel.json replacement in Wave 3 removes the existing two cron entries and replaces them with two new dispatcher entries. This is a configuration change, not a data migration. The v1.0 job logic (`runParseBatch`, `runEmbedBatch`) continues to work — they are imported and invoked by the new dispatcher.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | ohlcv_cache and ticker_metadata do not exist yet — greenfield | Migration in Wave 0 |
| Live service config | vercel.json: 2 existing crons (parse-batch at 0 0 \* \* \*, embed-batch at 0 0 \* \* \*) will be REPLACED | Hard cutover in Wave 3 after preview verification |
| OS-registered state | None — no OS-level registrations | None |
| Secrets / env vars | INTERNAL_PARSE_SECRET reused as-is; no new secrets for T1; NEXT_PUBLIC_TA_ENABLED is a new env var (false in prod, true in preview) | Add NEXT_PUBLIC_TA_ENABLED to Vercel env config |
| Build artifacts | None relevant | None |

**Cron migration detail:** When vercel.json is updated in Wave 3, the old `parse-batch` and `embed-batch` paths no longer receive cron triggers. They continue to exist as valid routes (can still be called manually) but are no longer scheduled. The dispatcher calls `runParseBatch` and `runEmbedBatch` as functions, so v1.0 pipeline processing continues. The planner must decide whether to keep old routes active as fallback for one deploy cycle.

---

## Common Pitfalls

### Pitfall 1: lightweight-charts Subpanel Sync Infinite Loop

**What goes wrong:** Chart A's visible range change triggers sync to B; B's subscription fires and syncs back to A; infinite recursion freezes browser tab.

**Why it happens:** `subscribeVisibleTimeRangeChange` callbacks fire on every programmatic `setVisibleRange` call, not just user interaction.

**How to avoid:** Guard with a boolean `isSyncing` flag or use `requestAnimationFrame` debouncing. Set flag to `true` before calling `setVisibleRange` on any chart; reset to `false` after all panels updated.

**Warning signs:** Browser tab freezes immediately on any pan/zoom; DevTools shows call stack depth exceeded.

### Pitfall 2: technicalindicators Warmup Alignment Off-By-One

**What goes wrong:** RSI(14) renders shifted one day left of price bars; MACD histogram fires on wrong candle; pattern markers (T2) will fire on wrong bars because they consume the indicator output.

**Why it happens:** The library returns fewer values than input. Naively zipping `ohlcv[i]` with `rsi[i]` misaligns by the warmup period.

**How to avoid:** Use the `alignIndicator` helper pattern (see Code Examples). Document warmup constants explicitly. Unit-test with the fixture (cross-check last RSI value against a known source).

**Warning signs:** RSI(14) line appears to precede price by 14 bars; indicator chart shows "too few" values; MACD histogram has different length than MACD line.

### Pitfall 3: OHLCV Data Quality on .JK Tickers

**What goes wrong (D3 from PITFALLS.md — T1-OWNED):** yahoo-finance2 returns bars with gaps (IDX holidays, corporate action miscorrections), possible `adjClose` jumps on dividend/split events, and thin coverage for recent IPOs.

**Why it happens:** yahoo-finance2 is an unofficial scraper; corporate actions for non-US exchanges are inconsistently populated.

**How to avoid:**
- Validate on insert: reject bars where `high < low`, `close < 0`, `volume < 0`, or single-bar return > 50%.
- Gap handling: forward-fill gaps ≤ 2 sessions only; log and surface gaps > 2 sessions as a banner ("Data gap detected").
- For indicator computation: use `adjClose` (not raw `close`) consistently. Document this choice and never mix them.
- Cross-check 5 OHLCV bars/ticker against TradingView as T1 verification step.

**Warning signs:** RSI on chart doesn't match recomputed values from displayed OHLCV; 1-year chart shows fewer than ~220 bars for an LQ45 stock; single-bar return > 30% with no news catalyst.

### Pitfall 4: Dispatcher Cron Migration Breaks v1.0 Pipeline

**What goes wrong:** After replacing `vercel.json`, the daily cron no longer triggers `parse-batch` or `embed-batch` directly. If the dispatcher imports are wired incorrectly, v1.0 document processing silently stops.

**Why it happens:** The dispatcher must import `runParseBatch` from `@/lib/ingest/parse-document-batch` (not from the route file). If the wrong path is imported, tree-shaking or module resolution can fail silently.

**How to avoid:** Test the dispatcher end-to-end in a preview deploy before merging to main. Verify `/api/internal/dispatch?job=daily&secret=...` returns `{ ok: true, results: { runParseBatch: {...}, runEmbedBatch: {...} } }` with non-error results.

**Warning signs:** Vercel cron logs show 200 but no documents are being processed; `documents` table has rows stuck in `parsing` status.

### Pitfall 5: ohlcv_cache Missing UNIQUE Constraint

**What goes wrong:** Concurrent dispatcher runs or a re-run of seed-and-backfill.ts insert duplicate rows for the same (ticker, date). Indicator computation sees duplicate bars; RSI calculation produces wrong values; downstream T3 training data is corrupted.

**Why it happens:** Without a UNIQUE constraint, Supabase/Postgres accepts duplicate inserts. The upsert pattern must include an ON CONFLICT clause.

**How to avoid:** Migration must include `CONSTRAINT ohlcv_cache_ticker_date_unique UNIQUE (ticker, date)`. The upsert must use `.upsert(..., { onConflict: 'ticker,date' })`. Smoke-test: insert same row twice and verify only one row exists.

**Warning signs:** `SELECT COUNT(*) FROM ohlcv_cache WHERE ticker='BBCA' AND date='2024-01-15'` returns > 1.

### Pitfall 6: lightweight-charts canvas ref null on SSR

**What goes wrong:** `createChart(ref.current, ...)` throws "Cannot read property 'clientWidth' of null" during server-side rendering.

**Why it happens:** `ref.current` is null during SSR. Even though `"use client"` is declared, the component may attempt to render in a non-browser context during initial hydration.

**How to avoid:** Create chart inside `useEffect(() => { if (!ref.current) return; const chart = createChart(...); return () => chart.remove(); }, [])`. Never call lightweight-charts APIs outside a `useEffect`. Dispose chart in the cleanup function.

**Warning signs:** Build fails with "window is not defined"; hydration mismatch errors in dev console.

### Pitfall 7: Indicator Snapshot Strip Computed Client-Side

**What goes wrong:** Client-side indicator computation causes flash of empty indicator strip; adds latency for the initial render; makes the strip inconsistent with the server-cached OHLCV.

**Why it happens:** Temptation to compute one-liners ("RSI: Near oversold territory") in the chart component where the indicator data is already loaded.

**How to avoid:** Compute the snapshot strip plain-English copy server-side in the analysis route alongside indicator computation. Cache the copy as a `indicator_snapshot_text: Record<string, string>` field in the API response. The strip renders immediately from props, no client-side computation.

---

## Code Examples

### lightweight-charts: Create Chart Instance

```typescript
// Source: lightweight-charts docs v5 (ASSUMED — verified version 5.2.0 exists but API details ASSUMED)
// "use client" component only
import { createChart, type IChartApi, type ISeriesApi, type CandlestickSeriesOptions } from "lightweight-charts";
import { useEffect, useRef } from "react";

const CHART_COLORS = {
  upColor: "var(--color-primary)",       // emerald-600
  downColor: "var(--color-destructive)", // red-600
  upBorder: "#047857",                   // emerald-700
  downBorder: "#b91c1c",                 // red-700
  rsiLine: "#3b82f6",                    // blue-500
  macdFast: "#6366f1",                   // indigo-500
  macdSignal: "#f97316",                 // orange-500
} as const;

export function CandlestickChart({ ohlcv, indicators, range }: ChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainRef.current) return;
    const chart: IChartApi = createChart(mainRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#71717a" },
      grid: { vertLines: { color: "#e4e4e7" }, horzLines: { color: "#e4e4e7" } },
      width: mainRef.current.clientWidth,
      height: 300,
    });
    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderUpColor: CHART_COLORS.upBorder,
      borderDownColor: CHART_COLORS.downBorder,
      wickUpColor: CHART_COLORS.upColor,
      wickDownColor: CHART_COLORS.downColor,
    });
    candleSeries.setData(ohlcv.map(bar => ({
      time: bar.date,
      open: bar.open, high: bar.high, low: bar.low, close: bar.close,
    })));
    return () => chart.remove();
  }, [ohlcv]);

  return <div ref={mainRef} role="img" aria-label={`${ticker} interactive price chart`} />;
}
```

### yahoo-finance2: Historical OHLCV Fetch

```typescript
// Source: fetch-stock-data.ts pattern (VERIFIED in codebase); yahoo-finance2 API [ASSUMED]
const fiveYearsAgo = new Date();
fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

const bars = await withBackoff(() =>
  yahooFinance.historical(`${ticker}.JK`, {
    period1: fiveYearsAgo,
    period2: new Date(),
    interval: "1d",
  })
);
```

### technicalindicators: RSI Calculation

```typescript
// Source: technicalindicators@3.1.0 npm package (VERIFIED version; API [ASSUMED])
import { RSI } from "technicalindicators";

const closes = ohlcv.map((b) => b.adjClose);
const rsiValues = RSI.calculate({ period: 14, values: closes });
// rsiValues.length === closes.length - 14
// Pad left with nulls to align with bars
const aligned = [...Array(14).fill(null), ...rsiValues];
```

### Supabase OHLCV Upsert

```typescript
// Source: supabase-js v2 upsert pattern (VERIFIED library version; API [ASSUMED])
await supabaseAdmin
  .from("ohlcv_cache")
  .upsert(
    bars.map((b) => ({
      ticker,
      date: b.date,
      open: b.open, high: b.high, low: b.low,
      close: b.close, adj_close: b.adjClose, volume: b.volume,
      fetched_at: new Date().toISOString(),
    })),
    { onConflict: "ticker,date" }
  );
```

### vercel.json — Dispatcher Replacement

```json
{
  "crons": [
    { "path": "/api/internal/dispatch?job=daily",  "schedule": "0 11 * * *" },
    { "path": "/api/internal/dispatch?job=weekly", "schedule": "0 12 * * 0" }
  ]
}
```

The `?secret=` auth param is added by the dispatcher reading `env.INTERNAL_PARSE_SECRET` — it is NOT in the `path` here (secrets must not be in vercel.json which is committed to git). The dispatcher must accept `?secret=` from Vercel's GET request, which is why the dual-path auth pattern (Bearer header OR query param) is used.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts ComposedChart for OHLC (in v1.0 Phase 9 trend chart) | lightweight-charts 5.2.0 for candlestick | T1 (D-01 locked) | Canvas-based; native zoom/pan/crosshair; no custom Shape work needed; native setMarkers() for T2 patterns |
| v1 stock trend chart (line chart, annual data) | OHLCV candlestick with daily bars | T1 | Different data shape: series of {date, open, high, low, close, volume} vs {year, revenue, netIncome} |
| Direct cron-to-handler routing (parse-batch, embed-batch in vercel.json) | Single dispatcher cron with job routing | T1 Wave 3 | Stays within 2-cron Hobby limit; all v1.0 + v2.0 jobs in one entry point |
| Per-route auth helper duplication | Shared `src/lib/internal-auth.ts` | T1 Wave 0 | Single source of truth; dispatcher + future TA routes all import the same module |
| lightweight-charts v4 (previous major) | lightweight-charts v5.2.0 (current) | 2026-04 | API changes in v5 — verify against v5 docs; do NOT follow v4 tutorials |

**Deprecated:**
- lightweight-charts v4 API: The library reached v5.0 in 2025-era and v5.2.0 was published 2026-04-24. Breaking changes exist between v4 and v5. The planner must ensure all code examples reference v5 documentation, not legacy v4 tutorials which dominate search results.
- `next` dist-tag on lightweight-charts points to `5.0.0-rc3` — use `latest` (5.2.0) not `next` tag.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | lightweight-charts subscribeVisibleTimeRangeChange API exists in v5.2.0 and fires on both user interaction and programmatic setVisibleRange | Architecture Patterns — Subpanel Sync | If API changed in v5, subpanel sync requires different mechanism; verify against v5 docs before implementation |
| A2 | yahoo-finance2 `historical()` method returns OHLCV array with date/open/high/low/close/adjClose/volume fields for .JK tickers | Code Examples | If API shape differs, upsert mapping breaks; verify with a live call against BBCA.JK in Wave 0 |
| A3 | technicalindicators RSI.calculate(), MACD.calculate(), BollingerBands.calculate(), EMA.calculate() exist with the parameter shapes shown | Code Examples | If API differs, indicator wrappers need adjustment; verify by importing and calling in a local test |
| A4 | Vercel Hobby plan allows exactly 2 cron job definitions (not more, not fewer) | Architecture — Dispatcher | If actually 3+, dispatcher consolidation is unnecessary overhead; if 1, more aggressive consolidation needed. ASSUMED from CLAUDE.md and planning docs; not independently verified against vercel.com/docs this session |
| A5 | Vercel cron GET requests cannot include custom headers; ?secret= query param is the required auth method | Architecture — Dispatcher | If Vercel adds header support, bearer-only auth could be used. LOW risk — the existing parse-batch pattern confirms this is the established approach |
| A6 | onnxruntime-node installs and runs on Vercel Hobby Node.js runtime (Linux x64) without native compilation failures | Wave 3 ONNX smoke | If it fails to install, T3 architecture must be reconsidered. This is the primary purpose of the TA-INFRA-04 smoke test |
| A7 | lightweight-charts v5.2.0 createChart and addCandlestickSeries APIs are backwards-compatible with v4 conceptual patterns (separate chart instances, subpanel sync) | Architecture Patterns | v5 may have renamed APIs. Verify against v5 official docs before implementation |
| A8 | IDX closes at 16:00 WIB (09:00 UTC); yahoo-finance2 EOD data reflects final candle by 18:00 WIB (11:00 UTC); cron at 11:00 UTC provides ≥2hr buffer | OHLCV timing | If yahoo-finance2 lags longer, nightly cron may fetch previous day's "final" bar as the latest; empirical observation needed post-T1 |
| A9 | technicalindicators@3.1.0 candlestick pattern functions (DOJI, Hammer, etc.) are present based on keyword list; they will be needed by T2, not T1 | Don't Hand-Roll | T1 does not call pattern functions; T2 will need to verify exact function signatures |

---

## Open Questions (RESOLVED)

1. **lightweight-charts v5 API changes from v4**
   - What we know: v5.2.0 published 2026-04-24; v4 tutorials are the dominant online resource.
   - What's unclear: Specific API changes between v4 and v5 (method renames, option shape changes).
   - Recommendation: Before writing `candlestick-chart.tsx`, fetch the v5 changelog from the lightweight-charts GitHub and verify subpanel sync API. Use Context7 or the GitHub releases page.
   - RESOLVED: Plan 05 Task 1 Step 1 instructs executor to verify installed v5 API before writing.

2. **seed-and-backfill.ts: market cap ranking via yahoo-finance2**
   - What we know: yahoo-finance2 supports `.JK` tickers and returns `marketCap` via `quote()`.
   - What's unclear: Whether yahoo-finance2 supports a bulk "top-N by market cap" query or requires individual ticker lookups. A pre-known list (e.g., LQ45 + IDX30 + IDX80) may be a more reliable seed source.
   - Recommendation: Use a known IDX index list as the starting candidate set (these are public and stable), then run yahoo-finance2 `quote()` on each to get marketCap + firstTradeDate for filtering. This avoids dependency on a bulk market-cap API that may not exist in yahoo-finance2.
   - RESOLVED: Plan 02 uses static LQ45+IDX30+IDX80 candidate set filtered by market cap.

3. **Cron migration: hard cutover vs. one-deploy fallback**
   - What we know: vercel.json can only have 2 crons; the dispatcher must replace the existing 2.
   - What's unclear: Whether to keep old routes active as direct HTTP fallback for one deploy, or do a clean cutover.
   - Recommendation (for planner to document): Hard cutover in the same deploy where the dispatcher is verified via preview deploy smoke. The old routes remain as valid API endpoints (can be manually triggered) but are no longer cron-scheduled. This minimizes the transition window.
   - RESOLVED: Plan 07 Task 3 — hard cutover with Vercel preview verification.

4. **ONNX hello-world smoke measurement protocol**
   - What we know: TA-INFRA-04 requires measuring cold INIT_DURATION on a Vercel preview deploy.
   - What's unclear: Exact curl count, time-of-day window, how to force a cold start (may require waiting for instance to freeze or deploying to a new region).
   - Recommendation (for planner to document): (a) Deploy preview; (b) Wait 15 minutes since last invocation to maximize cold-start probability; (c) curl the analysis route 5 times in sequence; (d) Read Vercel function logs for INIT_DURATION on first invocation. If INIT_DURATION > 5000ms on 3 of 5 curls, flag for T3 architecture revisit.
   - RESOLVED: Plan 07 Task 4 — 5 cold curls with >=15-min gap; flag if >5s on >=3/5.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All server code | ✓ | (project uses Next.js 15.5 / Node 20+) | — |
| `yahoo-finance2` | OHLCV fetch + seed script | ✓ | 3.14.1 (installed), 3.15.2 (latest) | Stooq (documented as future fallback in SUMMARY.md; not needed for T1) |
| `lightweight-charts` | Chart rendering | ✗ (not yet installed) | 5.2.0 (npm latest) | — (blocked until installed in Wave 0) |
| `technicalindicators` | Indicator computation | ✗ (not yet installed) | 3.1.0 (npm latest) | — (blocked until installed in Wave 0) |
| Supabase (prod) | ohlcv_cache, ticker_metadata | ✓ | Current (already live) | — |
| Supabase (local) | Migration development | ✓ | supabase CLI 2.100.1 | — |
| Vercel preview deploys | ONNX smoke (Wave 3) | ✓ (assumed, used throughout T1) | — | — |

**Missing dependencies with no fallback:**
- `lightweight-charts` and `technicalindicators` must be installed in Wave 0 before any Wave 1/2 work proceeds.

**Missing dependencies with fallback:**
- None critical — yahoo-finance2 is already installed and working.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | vitest.config.ts (or inferred from vite.config.ts) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test:coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TA-INGEST-01 | OHLCV bar validation rejects invalid bars | unit | `pnpm test -- tests/ta/ohlcv-validation.test.ts` | ❌ Wave 0 |
| TA-DATA-01 | seed-and-backfill.ts produces valid JSON + DB rows | manual smoke | Manual run + DB count check | ❌ Wave 0 |
| TA-TICKER-02 | Lowercase ticker redirects to uppercase | unit | `pnpm test -- tests/ta/ticker-routing.test.ts` | ❌ Wave 1 |
| TA-CHART-08 | <30 candles triggers sparse-data state | unit | `pnpm test -- tests/ta/sparse-data.test.ts` | ❌ Wave 2 |
| TA-IND-01..04 | Indicator warmup alignment: last RSI/MACD/BB/EMA matches ground truth within 0.001 | unit | `pnpm test -- tests/ta/indicators.fixture.test.ts` | ❌ Wave 1 (REQUIRED for VERIFICATION.md) |
| TA-IND-05 | Indicator snapshot strip produces plain-English copy (no raw numbers) | unit | `pnpm test -- tests/ta/indicator-snapshot.test.ts` | ❌ Wave 2 |
| TA-INFRA-02 | Dispatcher auth: 200 with correct secret, 401 without | unit | `pnpm test -- tests/ta/dispatcher-auth.test.ts` | ❌ Wave 3 |
| TA-INFRA-04 | ONNX cold INIT_DURATION measured and recorded | manual | curl + Vercel logs (manual only — no automated proxy) | ❌ Wave 3 |
| TA-INFRA-02 | ohlcv_cache duplicate row rejection | unit | `pnpm test -- tests/ta/ohlcv-uniqueness.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test -- tests/ta/` (TA-specific tests only, <30s)
- **Per wave merge:** `pnpm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/ta/ohlcv-validation.test.ts` — covers TA-INGEST-01 bar validation rules
- [ ] `tests/ta/indicators.fixture.test.ts` — covers TA-IND-01..04 alignment (REQUIRED for VERIFICATION.md)
- [ ] `tests/ta/ohlcv-uniqueness.test.ts` — covers UNIQUE constraint smoke (insert same row twice)
- [ ] `supabase/migrations/20260606XXXXXX_ta_t1_schema.sql` — ohlcv_cache + ticker_metadata tables + indices

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (no user auth in v1) | — |
| V3 Session Management | No (anonymous sessions unchanged) | — |
| V4 Access Control | Yes (internal routes must be authenticated) | `src/lib/internal-auth.ts` — timingSafeStringEq + extractBearer; dual-path Bearer/query-param |
| V5 Input Validation | Yes (ticker path param, search query param) | Zod schema at every boundary; `/^[A-Z]{1,5}$/` regex for ticker |
| V6 Cryptography | Partial (timing-safe comparison for secret) | `timingSafeEqual` from `node:crypto` — NEVER string equality for secret comparison |

### Known Threat Patterns for T1 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cron endpoint called by unauthorized client | Spoofing | timingSafeStringEq + dual-path auth; extracted to internal-auth.ts |
| Timing attack on secret comparison | Information Disclosure | `node:crypto.timingSafeEqual` — already in existing routes, must be preserved in extraction |
| Ticker path param injection (e.g., `../../../etc/passwd`) | Tampering | Zod `.regex(/^[A-Z]{1,5}$/)` validation at route entry; same as fetch-stock-data.ts:75 |
| Open Redirect via ticker search | Spoofing | `router.push('/ta/${TICKER}')` where TICKER is always the validated uppercase ticker from ticker_metadata, never raw user input |
| Secrets in vercel.json (committed to git) | Information Disclosure | `?secret=` is read from `INTERNAL_PARSE_SECRET` env var at runtime; the vercel.json path must NOT include the secret value |
| Server-only modules leaking to client bundle | Information Disclosure | `import "server-only"` at top of all TA lib modules; any accidental client import causes build error |

---

## Project Constraints (from CLAUDE.md)

These directives from `./CLAUDE.md` constrain all T1 implementation decisions:

- **Budget:** Free-tier only. No new paid services. T1 uses only: Vercel Hobby (free), Supabase (free tier), yahoo-finance2 (unofficial, free). `lightweight-charts` and `technicalindicators` are MIT/Apache-2.0 npm packages with no runtime cost.
- **Tech stack:** Must be solo-buildable with AI assistance. T1 uses well-trodden patterns (Next.js 15 App Router, Supabase, shadcn/ui, Vitest).
- **Scope discipline:** T1 is OHLCV + indicators + basic chart only. No pattern detection, no LLM calls, no ML. If an idea sounds like it belongs in T2/T3/T4, it does.
- **`server-only` boundary:** yahoo-finance2 and any future onnxruntime-node import MUST be behind `import 'server-only'`. This is enforced by the existing codebase convention.
- **Zod at every boundary:** All route params and response shapes must use Zod `safeParse`. No raw casting.
- **No LangChain:** Not applicable in T1 (no LLM calls), but the rule is stated here for completeness.
- **Citations:** Not applicable to T1 (no LLM output in T1). Relevant from T2 onwards.
- **Compliance disclaimers:** Not applicable to T1 UI (no AI output shown). T1's only compliance-adjacent concern is TA-UX-01 (SiteHeader must not expose the TA link until NEXT_PUBLIC_TA_ENABLED=true in production).
- **GSD workflow:** All code changes must happen through GSD workflow (execute-phase). Direct edits to repo are not permitted unless explicitly bypassing GSD.

---

## Sources

### Primary (HIGH confidence — verified in codebase or npm registry this session)

- `src/app/api/internal/parse-batch/route.ts` — auth pattern (timingSafeStringEq, extractBearer, dual-path), 508 INFINITE_LOOP_DETECTED warning at lines 13-22
- `src/app/api/internal/embed-batch/route.ts` — auth duplication confirmed
- `src/app/api/internal/analyze-batch/route.ts` — auth duplication confirmed
- `src/lib/stock/fetch-stock-data.ts` — withBackoff pattern, server-only boundary, return-null convention, ticker validation regex
- `src/lib/langfuse.ts` — singleton pattern (reused in T2+, not T1)
- `vercel.json` — confirmed 2 crons: parse-batch + embed-batch, both at 0 0 * * *
- `package.json` — all v1.0 installed deps confirmed
- `npm view technicalindicators version` → 3.1.0; `unpackedSize` → 5MB; pure JS (no native deps); keywords include RSI, MACD, Bollinger, EMA, SMA, ATR, Stochastic, OBV, Candlestick patterns
- `npm view lightweight-charts version` → 5.2.0; published 2026-04-24; Apache-2.0; `unpackedSize` → 3MB; description "Performant financial charts built with HTML5 canvas"
- `npm view yahoo-finance2 version` → 3.15.2 (latest), 3.14.1 installed; last modified 2026-05-30
- `.planning/phases/13-t1-data-and-indicators/13-CONTEXT.md` — locked decisions D-01 through D-06
- `.planning/phases/13-t1-data-and-indicators/13-UI-SPEC.md` — component inventory, colors, copywriting, interaction contracts
- `.planning/research/ARCHITECTURE.md` — §3 schema, §3.4 cron dispatcher, §7.2 wave order
- `.planning/research/PITFALLS.md` — D3 OHLCV data quality (T1-owned), C2 technicalindicators bugs (T1-owned)
- `.planning/research/STACK.md` — technicalindicators/onnxruntime-node integration map, cold-start analysis
- `.planning/research/SUMMARY.md` — §5 build order, §9 roadmapper pre-commits
- `.planning/REQUIREMENTS.md` — TA-INGEST-01, TA-DATA-01, TA-TICKER-01/02, TA-CHART-01..08, TA-IND-01..07, TA-INFRA-02, TA-INFRA-04, TA-UX-01
- `.planning/ROADMAP.md` — Phase 13 waves, success criteria
- `.planning/research/ARCHITECTURE.md §2.3` — schema indices (idx_ohlcv_ticker_date_desc, ticker_metadata prefix indexes)

### Secondary (MEDIUM confidence — derived from planning documents + training knowledge)

- lightweight-charts v5 subpanel sync pattern (ASSUMED based on v4 documentation; v5 may have changed API details)
- yahoo-finance2 `historical()` method signature and return shape (ASSUMED; verified conceptually via fetch-stock-data.ts patterns)
- Vercel Hobby 2-cron limit (ASSUMED from CLAUDE.md + planning docs; not independently verified against vercel.com/docs this session)
- technicalindicators warmup period formulas (ASSUMED based on standard TA math; confirm with actual library tests)

### Tertiary (LOW confidence — flagged in Assumptions Log)

- Vercel cron GET request header limitations (A5 — historically documented constraint)
- onnxruntime-node Vercel Hobby compatibility (A6 — primary purpose of TA-INFRA-04 smoke test)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both libraries verified against npm registry; v1.0 deps confirmed in package.json
- Architecture: HIGH — patterns verified against existing codebase files; integration points confirmed
- Pitfalls: HIGH — D3 and C2 are T1-owned and documented in PITFALLS.md with concrete mitigations
- Cron migration: MEDIUM — Vercel 2-cron limit is ASSUMED from planning docs, not independently verified this session
- lightweight-charts v5 API: MEDIUM — version confirmed but specific v5 API changes from v4 not verified

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (30 days — stable libraries; yahoo-finance2 is the most volatile due to unofficial API status)
