# Phase 9: Stock Data & Trend Chart — Research

**Researched:** 2026-05-19
**Domain:** yahoo-finance2 API, Recharts v3 ComposedChart, IDR number formatting, regex-based ticker detection, Supabase column-level caching
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Chart data comes from yahoo-finance2 historical/fundamentals — NOT a new Gemini AI call.
- **D-02:** If yahoo-finance2 returns no historical data, chart section is hidden entirely. No empty state card.
- **D-03:** ComposedChart: Revenue + Net Income as grouped bars (left Y-axis), Net Margin as overlaid line (right Y-axis). 3–5 years.
- **D-04:** Ticker detection runs in `parse-document-batch` after text extraction. Writes to `documents.ticker`.
- **D-05:** Detection method is regex against extracted page text. Target IDX filing patterns: `BEI: BBCA`, `Kode Efek: BBCA`, `IDX: BBCA`, or 4-letter uppercase near "Tbk". Focus on first 2–5 pages. No LLM call.
- **D-06:** Stock data cached 24 hours. Fetched server-side via `GET /api/stock/[ticker]`. Returns current quote + historical income data. Exponential backoff on rate-limit errors. Never exposes raw yahoo-finance2 error to client.
- **D-07:** Cache mechanism: new columns `stock_data JSONB NULL` + `stock_fetched_at TIMESTAMPTZ NULL` on `documents` table (preferred by context: avoids extra migration vs. separate table). Planner decides final placement.
- **D-08:** Render order in ExplanationPanel: 1. ScoreCard, 2. StockWidget, 3. TrendChartCard, 4. Explanation sections.
- **D-09:** StockWidget: compact shadcn Card, header row (ticker badge + "IDX" + timestamp), 2×2 grid (Price, P/E, P/B, Div. Yield).
- **D-10:** Fallback: null ticker → neither widget nor chart rendered. Fetch fail → "Market data temporarily unavailable". No historical data → chart hidden entirely.
- **D-11:** `formatIDR(amount: number): string` in `src/lib/utils.ts` (or `src/lib/format/idr.ts`). Thresholds: ≥1T → triliun, ≥1B → miliar, ≥1M → juta, <1M → comma-separated.
- **D-12:** No manual ticker override UI in Phase 9. TICKER-02 deferred to Phase 12/v2.

### Claude's Discretion

- Exact DB placement for stock cache (new table vs. new columns on `documents` — new columns recommended)
- Recharts component choice: ComposedChart with Bar + Line (recommended by context)
- Chart card visual design (title, Y-axis labels, tooltip format, legend position)
- Exact regex patterns for ticker detection
- Whether to show year range in chart card header
- Skeleton placeholder design for stock widget and chart

### Deferred Ideas (OUT OF SCOPE)

- TICKER-02 manual override — explicitly deferred to Phase 12 or v2
- AI-based chart data extraction (Gemini call to pull historical financials from PDF)
- Sector comparison (SECTOR-01, SECTOR-02 are v2 requirements)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TICKER-01 | System auto-detects company name and IDX ticker from document text when present | Regex patterns against extracted text verified; `documents.ticker` column exists; detection hook point identified in `parse-document-batch.ts` |
| TICKER-02 | Manual ticker override (DEFERRED per D-12) | Out of scope — not implemented in Phase 9 |
| STOCK-01 | Fetch current delayed stock price for detected IDX ticker | yahoo-finance2 `quote()` provides `regularMarketPrice`; `.JK` suffix for IDX |
| STOCK-02 | Fetch and display P/E, P/B, dividend yield ratios | yahoo-finance2 `quoteSummary` with `summaryDetail` + `defaultKeyStatistics` modules |
| STOCK-03 | Graceful "Market data temporarily unavailable" fallback | try/catch + null return from `fetchStockData`; never expose raw error |
| STOCK-04 | IDR formatting: "Rp 85 triliun" not raw integer | `formatIDR()` utility; thresholds documented in D-11 and UI-SPEC |
| STOCK-05 | 24h cache + exponential backoff | Supabase JSONB column + timestamp; backoff loop on 429/rate-limit errors |
| CHART-01 | Multi-year revenue, net income, margin trend chart | Recharts ComposedChart with Bar + Line; verified dual-YAxis pattern |
| CHART-02 | Chart data sourced from document's historical figures | Per D-01: sourced from yahoo-finance2 `incomeStatementHistory` module |
</phase_requirements>

---

## Summary

Phase 9 adds three integrated capabilities to the explanation panel: IDX ticker auto-detection from document text, a delayed-market-data stock widget, and a multi-year financial trend chart. All three depend on yahoo-finance2 (already specified in CLAUDE.md) and Recharts v3 (also specified, but not yet installed). Neither library is currently installed in the project.

The ticker detection logic attaches to the existing `parse-document-batch.ts` pipeline after text extraction — this is the natural injection point since page text is already available there. The `documents.ticker` column already exists in the DB schema (confirmed in `database.types.ts`), so no migration is needed for the ticker field. A migration is needed to add `stock_data JSONB` and `stock_fetched_at TIMESTAMPTZ` columns to `documents` for the 24-hour cache.

The UI layer is fully specified in `09-UI-SPEC.md`. Prop threading runs from `page.tsx` (RSC) → `DocumentProgressView` → `DocumentReaderLayout` → `ExplanationPanel`, touching both the desktop split pane and `MobileTabView`. The `ExplanationPanel` component needs new props (`ticker`, `stockData`, `chartData`, `stockError`), and `DocumentReaderLayout` + `MobileTabView` + `DocumentProgressView` need to thread those props through.

**Primary recommendation:** Install `yahoo-finance2` and `recharts`, add the DB migration for stock cache columns, wire ticker detection into the parse batch after extraction, build the API route with 24h caching and error boundary, then build the two UI components per the UI-SPEC.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ticker regex detection | API / Backend (parse-batch worker) | — | Runs in the server-side pipeline during parsing, where extracted text is available |
| Stock data fetch | API / Backend (`/api/stock/[ticker]`) | — | yahoo-finance2 is server-only (CORS); never call from client |
| 24h cache read/write | Database / Storage (Supabase) | API / Backend | Cache lives in `documents` table; read/write from the API route |
| IDR formatting | Frontend (shared util) | — | Pure function, used in both chart tick labels and tooltip; lives in `src/lib/utils.ts` |
| Stock widget rendering | Browser / Client (ExplanationPanel) | — | Client component; receives stockData props from RSC |
| Trend chart rendering | Browser / Client (TrendChartCard) | — | Recharts is client-only (SVG + DOM); ComposedChart in "use client" component |
| Prop threading (ticker, stockData, chartData) | Frontend Server (RSC page.tsx) | Browser / Client | RSC fetches data, passes to client component tree |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yahoo-finance2 | 3.14.1 | Fetch IDX stock quotes + historical income data | Specified in CLAUDE.md §9; server-only, no API key, supports `.JK` suffix [VERIFIED: npm registry] |
| recharts | 3.8.1 | ComposedChart: Revenue/NetIncome bars + Margin line | Specified in CLAUDE.md §10; TypeScript-first v3 rewrite, most popular React charting library [VERIFIED: npm registry] |

> Note: Both libraries are specified in CLAUDE.md but are **not yet installed** in `package.json`. They must be installed in Wave 0.
> [VERIFIED: grep of package.json confirmed absence; npm view confirmed 3.14.1 and 3.8.1 as current versions]

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.25.76 | Validate `StockData` and `ChartDataPoint` shapes at runtime | Use for all external data from yahoo-finance2 |
| @supabase/supabase-js | ^2.105.1 | Supabase upsert for stock cache columns | Already in use; same pattern as analyze-document-batch cache |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| yahoo-finance2 (locked) | Alpha Vantage | 25 req/day free limit — CLAUDE.md explicitly rejects |
| recharts (locked) | Tremor | Built on Recharts anyway, adds 200KB — CLAUDE.md explicitly rejects |

**Installation (Wave 0):**
```bash
pnpm add yahoo-finance2 recharts
```

**Version verification:**
```bash
npm view yahoo-finance2 version   # → 3.14.1
npm view recharts version         # → 3.8.1
```

---

## Architecture Patterns

### System Architecture Diagram

```
PDF text pages (parsed)
         │
         ▼
 detectTicker(chunks: PageChunk[])    ← pure function, regex only, pages 1-5
         │
         ├── match found → UPDATE documents SET ticker = 'BBCA'
         └── no match   → ticker stays NULL (widget + chart do not render)

page.tsx RSC (server)
         │
         ├── SELECT documents (storage_path, ticker, stock_data, stock_fetched_at)
         │
         ├── IF ticker IS NULL → stockData = null, chartData = null
         │
         ├── IF stock_fetched_at within 24h → return cached stock_data (no API call)
         │
         └── IF stale/missing → call fetchStockData(ticker)
                    │
                    ▼
             yahoo-finance2 (server-only)
             ├── quote('BBCA.JK')          → price, P/E, P/B, dividend yield
             └── quoteSummary('BBCA.JK', { modules: ['incomeStatementHistory'] })
                          → revenue, netIncome per year
                    │
                    ├── success → upsert documents SET stock_data, stock_fetched_at
                    └── failure → return null (STOCK-03 fallback)

Client: DocumentReaderLayout → ExplanationPanel
         │
         ├── ticker=null          → render nothing
         ├── stockError=true      → "Market data temporarily unavailable"
         ├── stockData available  → <StockWidget> (price, P/E, P/B, yield)
         └── chartData available  → <TrendChartCard> (ComposedChart)
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── stock/
│   │   └── fetch-stock-data.ts        # server-only, wraps yahoo-finance2
│   └── utils.ts                       # add formatIDR() + formatIDRShort() here
├── components/doc/
│   ├── stock-widget.tsx               # new: 2×2 metric card
│   ├── trend-chart-card.tsx           # new: Recharts ComposedChart card
│   └── stock-loading-skeleton.tsx     # new: pulse skeletons
└── app/
    ├── api/stock/[ticker]/
    │   └── route.ts                   # new: GET endpoint with 24h cache
    └── doc/[documentId]/
        └── page.tsx                   # extend: read ticker + stock_data from documents
```

### Pattern 1: yahoo-finance2 Quote Fetch (server-only)

**What:** Fetch current delayed quote for an IDX ticker using `.JK` suffix.
**When to use:** STOCK-01, STOCK-02 — current price, P/E, P/B, dividend yield.

```typescript
// Source: https://github.com/gadicc/yahoo-finance2/blob/dev/README.md [VERIFIED: Context7]
import "server-only";
import yahooFinance from "yahoo-finance2";

export async function fetchStockQuote(ticker: string) {
  // IDX tickers require .JK suffix
  const symbol = `${ticker}.JK`;
  try {
    const quote = await yahooFinance.quote(symbol);
    return {
      price: quote.regularMarketPrice ?? null,
      pe: quote.trailingPE ?? null,
      pb: quote.priceToBook ?? null,
      dividendYield: quote.dividendYield ?? null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    // STOCK-03: never expose raw error to client
    console.error("[fetchStockQuote] failed", ticker, err);
    return null;
  }
}
```

### Pattern 2: yahoo-finance2 Historical Income Statement

**What:** Fetch multi-year revenue, net income for trend chart.
**When to use:** CHART-01, CHART-02 (D-01 locked: chart data from yahoo-finance2).

```typescript
// Source: https://github.com/gadicc/yahoo-finance2/blob/dev/README.md [VERIFIED: Context7]
import "server-only";
import yahooFinance from "yahoo-finance2";

export async function fetchIncomeHistory(ticker: string) {
  const symbol = `${ticker}.JK`;
  try {
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: ["incomeStatementHistory"],
    });
    const statements = result.incomeStatementHistory?.incomeStatementHistory ?? [];
    return statements.map((s) => ({
      year: new Date(s.endDate).getFullYear().toString(),
      revenue: s.totalRevenue ?? null,
      netIncome: s.netIncome ?? null,
      netMarginPct:
        s.totalRevenue && s.netIncome
          ? Math.round((s.netIncome / s.totalRevenue) * 1000) / 10
          : null,
    })).sort((a, b) => a.year.localeCompare(b.year));
  } catch (err) {
    console.error("[fetchIncomeHistory] failed", ticker, err);
    return null;
  }
}
```

> [ASSUMED] The exact field names `incomeStatementHistory.incomeStatementHistory`, `totalRevenue`, `netIncome`, `endDate` are based on training knowledge. The module structure is consistent with yahoo-finance2 v2 patterns but should be verified with a live call in Wave 0 before finalizing the transformer.

### Pattern 3: Exponential Backoff (STOCK-05)

**What:** Retry on 429 / rate-limit errors before returning null.
**When to use:** Wrap the yahoo-finance2 call in `fetchStockData`.

```typescript
// [ASSUMED] — standard exponential backoff pattern
async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit =
        err instanceof Error && /429|rate.?limit|RESOURCE_EXHAUSTED/i.test(err.message);
      if (!isRateLimit || attempt === maxRetries) {
        console.error("[withBackoff] permanent fail or non-retryable", err);
        return null;
      }
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500)); // 500ms, 1s, 2s
    }
  }
  return null;
}
```

### Pattern 4: 24h Supabase Column Cache (D-07)

**What:** Read from `documents.stock_data` / `documents.stock_fetched_at` before calling yahoo-finance2. Write back after successful fetch.
**When to use:** STOCK-05 — prevents repeated API calls on page refresh.

```typescript
// Source: supabase-js patterns; mirrors analyze-document-batch.ts cache check [VERIFIED: codebase]
import { supabaseAdmin } from "@/db/client";

async function getCachedStockData(docId: string) {
  const res = await supabaseAdmin
    .from("documents")
    .select("ticker, stock_data, stock_fetched_at")
    .eq("id", docId)
    .maybeSingle();
  if (!res.data) return null;

  const { ticker, stock_data, stock_fetched_at } = res.data;
  if (!ticker) return { ticker: null, stockData: null, fromCache: true };

  const stale =
    !stock_fetched_at ||
    Date.now() - new Date(stock_fetched_at).getTime() > 24 * 60 * 60 * 1000;

  if (!stale && stock_data) {
    return { ticker, stockData: stock_data, fromCache: true };
  }
  return { ticker, stockData: null, fromCache: false };
}
```

### Pattern 5: Ticker Regex Detection

**What:** Extract 4-letter uppercase IDX ticker from early document pages.
**When to use:** TICKER-01 — called in `parse-document-batch` after text extraction.

Key patterns found in IDX filings [ASSUMED — based on knowledge of IDX filing conventions]:
- `BEI: BBCA` (Bursa Efek Indonesia code marker)
- `Kode Efek: BBCA` (Indonesian for "Securities Code")
- `IDX: BBCA`
- `Kode saham: BBCA`
- Standalone 4-letter uppercase word on same line as "Tbk" (PT BANK CENTRAL ASIA Tbk)

```typescript
// [ASSUMED] — regex patterns based on IDX filing conventions
const IDX_TICKER_PATTERNS = [
  /\b(?:BEI|IDX|Kode Efek|Kode saham|Kode Emiten)\s*[:：]\s*([A-Z]{4})\b/i,
  /\b([A-Z]{4})\s+Tbk\b/,         // "BBCA Tbk"
  /\bPT\s+\w[\w\s]+\s+([A-Z]{4})\s*Tbk/,  // "PT Bank Central Asia BBCA Tbk" (rare variant)
];

export function detectTicker(pageTexts: string[]): string | null {
  // Only scan first 5 pages (cover + TOC region)
  const earlyPages = pageTexts.slice(0, 5);
  for (const text of earlyPages) {
    for (const pattern of IDX_TICKER_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1].toUpperCase();
    }
  }
  return null;
}
```

> [ASSUMED] Actual IDX annual report formatting varies by company and year. The regex patterns above are informed approximations. They should be validated against real BBCA, TLKM, GOTO PDFs before shipping.

### Pattern 6: IDR Formatting Utility (STOCK-04, D-11)

**What:** Convert raw IDR integer to human-readable Indonesian format.
**Where:** `src/lib/utils.ts` (or `src/lib/format/idr.ts`).

```typescript
// Source: D-11 from CONTEXT.md + UI-SPEC IDR Formatting Contract [VERIFIED: context]
export function formatIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000_000).toFixed(2)} triliun`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2)} miliar`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(2)} juta`;
  }
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

// Short form for Y-axis tick labels (keeps axis readable)
export function formatIDRShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000_000).toFixed(0)}T`;
  if (abs >= 1_000_000_000)     return `${sign}Rp ${(abs / 1_000_000_000).toFixed(0)}M`;
  if (abs >= 1_000_000)         return `${sign}Rp ${(abs / 1_000_000).toFixed(0)}Jt`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}
```

### Pattern 7: Recharts ComposedChart with Dual Y-Axis

**What:** Revenue + Net Income bars (left axis) + Net Margin line (right axis).
**When to use:** CHART-01 — the `TrendChartCard` component.

```tsx
// Source: Context7 recharts docs [VERIFIED: Context7 /recharts/recharts]
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// data shape: { year: string, revenue: number, netIncome: number, netMarginPct: number }[]

<ResponsiveContainer width="100%" height={220}>
  <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
    <XAxis
      dataKey="year"
      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
    />
    {/* Left Y-axis: IDR amounts */}
    <YAxis
      yAxisId="left"
      orientation="left"
      tickFormatter={(v) => formatIDRShort(v)}
      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
    />
    {/* Right Y-axis: percentage */}
    <YAxis
      yAxisId="margin"
      orientation="right"
      tickFormatter={(v) => `${v}%`}
      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
      domain={[0, 100]}
    />
    <Tooltip content={<TrendChartTooltip />} />
    <Legend verticalAlign="bottom" height={28} />
    <Bar
      yAxisId="left"
      dataKey="revenue"
      name="Revenue"
      fill="var(--color-primary)"
      radius={[4, 4, 0, 0]}
    />
    <Bar
      yAxisId="left"
      dataKey="netIncome"
      name="Net Income"
      fill="var(--color-secondary)"
      stroke="var(--color-border)"
      strokeWidth={1}
      radius={[4, 4, 0, 0]}
    />
    <Line
      yAxisId="margin"
      dataKey="netMarginPct"
      name="Net Margin"
      stroke="var(--color-muted-foreground)"
      strokeDasharray="4 2"
      dot={false}
    />
  </ComposedChart>
</ResponsiveContainer>
```

### Anti-Patterns to Avoid

- **Calling yahoo-finance2 from client code:** Will cause CORS errors. CLAUDE.md §9 explicitly says server-side only. Route through `/api/stock/[ticker]` or RSC.
- **Hardcoding ticker without `.JK` suffix:** `BBCA` will fail; must be `BBCA.JK`. Apply suffix in `fetchStockData`, not at the detection layer.
- **Exposing raw yahoo-finance2 errors to client (STOCK-03):** Wrap all calls in try/catch, return null on failure, render "Market data temporarily unavailable."
- **Rendering chart with empty data array:** Recharts renders an empty SVG with axes but no bars. Use a null guard: `chartData && chartData.length > 0` before rendering `TrendChartCard`.
- **Missing `"use client"` on Recharts components:** Recharts uses DOM APIs. Any component importing from recharts must be a client component.
- **Not resetting `stock_data` to null when re-detecting:** If ticker changes (unlikely in v1, but possible if document is reprocessed), stale stock_data from a previous ticker will be shown until TTL expires. Safe for v1 since documents are immutable post-parse.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive chart container | Custom resize observer + SVG sizing | Recharts `ResponsiveContainer` | Handles ResizeObserver edge cases, SSR hydration, and container measurement automatically |
| IDX stock data API client | Custom fetch to Yahoo Finance HTML | yahoo-finance2 | Handles auth/cookies, validation, retry semantics, type definitions |
| Chart tooltip DOM positioning | Custom mouse-tracking tooltip | Recharts built-in `Tooltip` + `content` prop | Handles viewport edge cases and pointer events correctly |
| Zod schema for external data | Ad-hoc type assertions | Define `StockDataSchema` with zod | yahoo-finance2 fields are frequently `undefined` for IDX mid/small caps; Zod safeParse is the right boundary |

**Key insight:** yahoo-finance2's IDX coverage is good for large-caps (BBCA, TLKM, BBRI) but sparse for mid/small caps. The `quoteSummary` income history module often returns empty arrays for lesser-known tickers. The hide-chart-entirely strategy (D-02) is the correct defensive choice.

---

## Common Pitfalls

### Pitfall 1: yahoo-finance2 Validation Errors on IDX Tickers

**What goes wrong:** yahoo-finance2 runs Zod validation on the API response. IDX data from Yahoo Finance sometimes has unexpected fields or missing values. The library may throw `FailedYahooValidationError` even when the fundamental data is usable.
**Why it happens:** Yahoo Finance's data model varies by market; IDX responses can have null fields that the library's schema doesn't expect.
**How to avoid:** Wrap `quoteSummary` calls in try/catch. Consider passing `{ validateResult: false }` as a module option if validation errors block usable data. Log the raw error in dev for diagnostics.
**Warning signs:** Error message contains "FailedYahooValidationError" or "Unexpected field."

### Pitfall 2: Recharts in Next.js App Router — SSR Crash

**What goes wrong:** Importing Recharts components directly in a server component or a component without `"use client"` causes a build error or runtime crash because Recharts references browser globals (`window`, `document`, SVG DOM).
**Why it happens:** Recharts is a browser-only library. Next.js App Router SSRs by default.
**How to avoid:** Add `"use client"` at the top of every component that imports from `recharts`. `TrendChartCard` and `StockWidget` must both be client components.
**Warning signs:** Build error: "ReferenceError: window is not defined" or "Module not found: Can't resolve 'canvas'."

### Pitfall 3: Dual Y-Axis `yAxisId` Mismatch

**What goes wrong:** `Bar` or `Line` components render on the wrong axis or throw a warning if the `yAxisId` prop doesn't match any `YAxis` component's `yAxisId`.
**Why it happens:** Recharts silently ignores mismatched yAxisId in some versions; in others it warns and falls back to the first axis, distorting margins.
**How to avoid:** Set `yAxisId="left"` on both `YAxis orientation="left"` and all `Bar` components; set `yAxisId="margin"` on both `YAxis orientation="right"` and the `Line` component. Verified pattern: `<YAxis yAxisId="left" .../>`, `<YAxis yAxisId="margin" .../>`, `<Bar yAxisId="left" .../>`, `<Line yAxisId="margin" .../>`.
**Warning signs:** Net Margin line appears flat at bottom of chart or Revenue/NetIncome bars extend above chart area.

### Pitfall 4: `incomeStatementHistory` Field Nullability for IDX Mid-Caps

**What goes wrong:** `quoteSummary` returns a result but `incomeStatementHistory.incomeStatementHistory` is an empty array `[]` for lesser-known IDX tickers. Chart renders nothing.
**Why it happens:** Yahoo Finance's IDX coverage for mid/small caps is incomplete. Historical financials are not always indexed.
**How to avoid:** Always check `statements.length > 0` before passing chart data. Per D-02, if empty, set `chartData = null` → chart section not rendered.
**Warning signs:** Chart data array is `[]` not `null` — the null-guard `chartData && chartData.length > 0` handles both.

### Pitfall 5: Ticker Detection False Positives

**What goes wrong:** Regex matches a 4-letter uppercase sequence that is NOT a ticker (e.g., "IFRS", "PSAK", "GAAP", "NOTE", "BANK").
**Why it happens:** IDX filings contain many all-caps abbreviations. A pure 4-letter regex without context anchors will produce false positives.
**How to avoid:** Anchor the regex to IDX-specific context keywords (`BEI`, `IDX`, `Kode Efek`, `Kode saham`, or proximity to "Tbk"). The standalone 4-letter + "Tbk" pattern is safer than a free-standing 4-letter match. Consider a short blocklist: `['PSAK', 'IFRS', 'GAAP', 'NOTE', 'IAPI', 'BUMN', 'APBN']`.
**Warning signs:** `documents.ticker` populated with values like "PSAK" or "IFRS."

### Pitfall 6: Stock Cache Columns Not in `database.types.ts`

**What goes wrong:** After adding `stock_data JSONB` and `stock_fetched_at TIMESTAMPTZ` columns to `documents`, the TypeScript types are stale. Supabase client calls referencing these columns produce TypeScript errors.
**Why it happens:** `database.types.ts` is generated from the local Supabase schema and must be regenerated after each migration.
**How to avoid:** Run `pnpm db:types` after applying the stock cache migration. This is a Wave 0 task before any code that reads/writes the new columns.
**Warning signs:** TypeScript error: "Property 'stock_data' does not exist on type 'DocumentsRow'."

### Pitfall 7: `regularMarketPrice` Undefined for Tickers in IDX Pre-Open

**What goes wrong:** During IDX pre-market hours, `regularMarketPrice` may be undefined (returns last close instead or is missing). `trailingPE`, `priceToBook`, `dividendYield` are commonly null for tickers with sparse data.
**Why it happens:** Yahoo Finance data for IDX is less reliable than US markets; fields are frequently undefined.
**How to avoid:** All quote fields must be null-coalesced: `quote.regularMarketPrice ?? null`. Never assert these fields are non-null. Render "—" in the widget grid cell when value is null.

---

## Code Examples

### formatIDR Threshold Tests

```typescript
// Unit test targets for STOCK-04 (src/lib/utils.test.ts or src/lib/format/idr.test.ts)
expect(formatIDR(85_000_000_000_000)).toBe("Rp 85.00 triliun");
expect(formatIDR(1_250_000_000)).toBe("Rp 1.25 miliar");
expect(formatIDR(500_000_000)).toBe("Rp 500.00 juta");
expect(formatIDR(9275)).toBe("Rp 9.275");   // locale-formatted
```

### StockLoadingSkeleton (mirrors PdfLoadingSkeleton pattern)

```tsx
// Source: src/components/doc/pdf-loading-skeleton.tsx pattern [VERIFIED: codebase]
"use client";

export function StockLoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading market data…" aria-busy="true"
         className="flex flex-col gap-6">
      <div className="h-[108px] w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-[268px] w-full animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
```

### ExplanationPanel Props Extension

```tsx
// Source: src/components/doc/explanation-panel.tsx [VERIFIED: codebase read]
// Add to existing ExplanationPanel function signature:
export function ExplanationPanel(props: {
  documentId: string;
  explanation: ExplanationResult;
  score: ScoreResult | null;
  onGoToPage: (page: number) => void;
  className?: string;
  // Phase 9 additions:
  ticker: string | null;
  stockData: StockData | null;
  chartData: ChartDataPoint[] | null;
  stockError: boolean;
}) { ... }
```

### Database Migration SQL (stock cache columns)

```sql
-- supabase/migrations/YYYYMMDD_stock_cache_columns.sql
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS stock_data JSONB NULL,
  ADD COLUMN IF NOT EXISTS stock_fetched_at TIMESTAMPTZ NULL;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `yahooFinance.quote()` v1 API | `yahooFinance.quote(symbol)` / `yahooFinance.quoteSummary(symbol, { modules })` v2 API | v2.0 migration | Different function signature; `quote()` still works in v3 as convenience wrapper |
| Recharts v2 class-based config | Recharts v3 TypeScript-first rewrite | Dec 2024 | Better TS types; `ComposedChart` API unchanged |

**Deprecated/outdated:**
- LangChain: CLAUDE.md explicitly bans it. Not relevant to this phase.
- `pdf-parse`: Not relevant to this phase; already avoided in Phase 3.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `incomeStatementHistory.incomeStatementHistory[].totalRevenue` and `.netIncome` are the correct field names for multi-year income data | Pattern 2 | Chart data transformer produces null for all rows; chart never renders. Verify with live call in Wave 0. |
| A2 | `incomeStatementHistory.incomeStatementHistory[].endDate` is a Date object representing fiscal year end | Pattern 2 | Year extraction `new Date(s.endDate).getFullYear()` returns NaN; chart X-axis is blank |
| A3 | IDX ticker regex patterns (`Kode Efek:`, `BEI:`, `IDX:`, `XXXX Tbk`) match cover pages of major IDX annual reports | Pattern 5 | Ticker detection fails for real documents; stock/chart sections never render |
| A4 | `yahooFinance.quote(symbol)` returns `trailingPE`, `priceToBook`, `dividendYield` in the default response without specifying modules | Pattern 1 | P/E, P/B, yield always null; widget shows "—" for all three ratios |

---

## Open Questions (RESOLVED)

1. **yahoo-finance2 `incomeStatementHistory` availability for major IDX tickers** — RESOLVED: Plan 03 uses `totalRevenue` / `netIncome` from the `IncomeStatement` type interface, confirmed via Context7 documentation. Wave 0 live call against `BBCA.JK` is included as a validation task.

2. **Cache placement: new columns vs. new `stock_cache` table** — RESOLVED: New columns `stock_data JSONB` and `stock_fetched_at TIMESTAMPTZ` added to the existing `documents` table (Plan 01 migration). Avoids a join, simpler RSC fetch, fewer migrations.

3. **Stock data fetch location: RSC vs. dedicated API route** — RESOLVED: RSC (`page.tsx`) calls `fetchStockDataForDocument()` directly (server-to-server, no HTTP round-trip). The `GET /api/stock/[ticker]` route coexists for external callers / future client-side refresh (Plan 03 + Plan 04).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | yahoo-finance2 server runtime | ✓ | 20.x (inferred from @types/node ^20) | — |
| yahoo-finance2 | STOCK-01, STOCK-02, CHART-02 | ✗ (not installed) | 3.14.1 available | None — must install |
| recharts | CHART-01 | ✗ (not installed) | 3.8.1 available | None — must install |
| Supabase local | DB migration testing | ✓ (supabase CLI in devDependencies) | ^2.98.1 | — |
| Internet access (yahoo-finance2) | Stock data fetch | ✓ (dev/prod) | — | STOCK-03 fallback renders unavailable state |

**Missing dependencies with no fallback:**
- `yahoo-finance2` and `recharts` must be installed before any implementation can proceed. `pnpm add yahoo-finance2 recharts` in Wave 0.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test:coverage` |
| jsdom env (component tests) | Matched via `environmentMatchGlobs: ["src/components/**/*.test.tsx", "jsdom"]` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOCK-04 | `formatIDR(85_000_000_000_000)` → "Rp 85.00 triliun" | unit | `pnpm test src/lib/utils.test.ts` | ❌ Wave 0 |
| STOCK-04 | `formatIDR(9275)` → "Rp 9.275" | unit | `pnpm test src/lib/utils.test.ts` | ❌ Wave 0 |
| STOCK-04 | `formatIDRShort(85_000_000_000_000)` → "Rp 85T" | unit | `pnpm test src/lib/utils.test.ts` | ❌ Wave 0 |
| TICKER-01 | `detectTicker(["... Kode Efek: BBCA ..."])` → "BBCA" | unit | `pnpm test src/lib/stock/detect-ticker.test.ts` | ❌ Wave 0 |
| TICKER-01 | `detectTicker(["... IFRS ..."])` → null (no false positive) | unit | `pnpm test src/lib/stock/detect-ticker.test.ts` | ❌ Wave 0 |
| STOCK-03 | `fetchStockData` returns null when yahoo-finance2 throws | unit (mocked) | `pnpm test src/lib/stock/fetch-stock-data.test.ts` | ❌ Wave 0 |
| STOCK-01, STOCK-02 | `StockWidget` renders price/P/E/P/B/yield from props | unit (jsdom) | `pnpm test src/components/doc/stock-widget.test.tsx` | ❌ Wave 0 |
| STOCK-03 | `ExplanationPanel` with `stockError=true` renders "Market data temporarily unavailable" | unit (jsdom) | `pnpm test src/components/doc/explanation-panel.test.tsx` | ❌ Wave 0 |
| CHART-01 | `TrendChartCard` renders without crashing with valid chartData | unit (jsdom) | `pnpm test src/components/doc/trend-chart-card.test.tsx` | ❌ Wave 0 |
| CHART-01 | ExplanationPanel hides TrendChartCard when chartData is null | unit (jsdom) | `pnpm test src/components/doc/explanation-panel.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test --run src/lib/stock/ src/lib/utils.test.ts src/components/doc/`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/utils.test.ts` (or `src/lib/format/idr.test.ts`) — covers STOCK-04 `formatIDR` + `formatIDRShort`
- [ ] `src/lib/stock/detect-ticker.test.ts` — covers TICKER-01 regex patterns
- [ ] `src/lib/stock/fetch-stock-data.test.ts` — covers STOCK-03 error boundary (mocked yahoo-finance2)
- [ ] `src/components/doc/stock-widget.test.tsx` — covers STOCK-01, STOCK-02 rendering
- [ ] `src/components/doc/trend-chart-card.test.tsx` — covers CHART-01 rendering
- [ ] `src/components/doc/explanation-panel.test.tsx` — covers STOCK-03 fallback text, null-guard behavior

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in v1 |
| V3 Session Management | no | Session token from Phase 2 unchanged |
| V4 Access Control | no | No per-user stock data (public ticker data) |
| V5 Input Validation | yes | Validate `ticker` param in `GET /api/stock/[ticker]`: alphanumeric, 1–5 chars, uppercase only — reject malformed values before passing to yahoo-finance2 |
| V6 Cryptography | no | No secrets specific to this phase |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ticker param injection (e.g., `../../etc/passwd` or `<script>`) | Tampering | Validate ticker with `/^[A-Z]{1,5}$/` before `.JK` append; return 400 on invalid input |
| SSRF via ticker param to yahoo-finance2 | Elevation of Privilege | yahoo-finance2 only calls Yahoo Finance endpoints — not configurable; low risk but ticker validation still recommended |
| Rate limit abuse via `/api/stock/[ticker]` | Denial of Service | 24h Supabase cache (D-07) acts as rate limiter; most requests hit cache; yahoo-finance2 has its own concurrency limit |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: Context7 `/gadicc/yahoo-finance2`] — `quote()`, `quoteSummary()`, error handling patterns, `.JK` suffix usage
- [VERIFIED: Context7 `/recharts/recharts`] — `ComposedChart`, dual `YAxis` with `yAxisId`, `ResponsiveContainer`, custom `Tooltip`, `Bar`, `Line` patterns
- [VERIFIED: npm registry] — yahoo-finance2@3.14.1, recharts@3.8.1 (current versions)
- [VERIFIED: codebase read] — `src/db/database.types.ts`: `documents.ticker` column exists; `stock_data`/`stock_fetched_at` do NOT exist → migration required
- [VERIFIED: codebase read] — `package.json`: neither yahoo-finance2 nor recharts installed
- [VERIFIED: codebase read] — `src/components/doc/explanation-panel.tsx`: current props shape; stock widget + chart slot insertion point
- [VERIFIED: codebase read] — `src/lib/utils.ts`: no existing IDR formatter; only `cn()` present
- [VERIFIED: codebase read] — `src/lib/ingest/parse-document-batch.ts`: ticker detection injection point after text extraction
- [VERIFIED: codebase read] — `src/app/doc/[documentId]/page.tsx`: RSC data fetch pattern
- [VERIFIED: codebase read] — `src/components/doc/document-reader-layout.tsx` + `mobile-tab-view.tsx`: full prop threading path

### Secondary (MEDIUM confidence)

- [CITED: github.com/gadicc/yahoo-finance2/blob/dev/README.md] — `quoteSummary` module list, `incomeStatementHistory` module existence
- [CITED: context7.com/recharts/recharts/llms.txt] — dual Y-axis, custom tooltip, `ResponsiveContainer` patterns
- CLAUDE.md §9 — yahoo-finance2 server-side-only constraint, `.JK` suffix, error handling guidance
- CLAUDE.md §10 — Recharts v3 ComposedChart recommendation, charts needed in Clarifin
- 09-UI-SPEC.md — visual design contract for StockWidget, TrendChartCard, skeleton heights, IDR formatting contract, copywriting

### Tertiary (LOW confidence — flag for validation)

- [ASSUMED] `incomeStatementHistory` module field names (`totalRevenue`, `netIncome`, `endDate`) — must be verified with live call in Wave 0
- [ASSUMED] IDX ticker regex patterns — must be validated against real BBCA/TLKM/GOTO PDFs
- [ASSUMED] `dividendYield`, `trailingPE`, `priceToBook` available from `quote()` default response without specifying modules

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both libraries verified on npm registry and in CLAUDE.md; absence from package.json confirmed
- Architecture: HIGH — codebase thoroughly read; prop threading path, injection points, and migration needs all confirmed against actual source files
- Pitfalls: MEDIUM-HIGH — Recharts SSR and dual-axis pitfalls verified via Context7; yahoo-finance2 IDX field-name specifics are ASSUMED
- IDR formatting: HIGH — thresholds locked in D-11/UI-SPEC; pure logic, no external dependency
- Ticker detection: MEDIUM — regex patterns are ASSUMED; real IDX PDF format not verified against actual documents this session

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (30 days; yahoo-finance2 field names are stable; recharts API is stable in v3)
