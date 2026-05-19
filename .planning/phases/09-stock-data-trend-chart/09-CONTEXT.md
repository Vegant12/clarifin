# Phase 9: Stock Data & Trend Chart - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-detect the IDX ticker from the uploaded PDF via regex, fetch delayed market data
(price, P/E, P/B, dividend yield) from yahoo-finance2, display a compact stock widget,
and render a multi-year Recharts trend chart (Revenue + Net Income bars, Net Margin line)
using historical data from yahoo-finance2.

Phase 9 does NOT include: ticker manual override UI (deferred), AI extraction of chart
data (not needed — yahoo-finance2 provides both current quote and historical financials),
chat (Phase 10), or observability (Phase 11).

</domain>

<decisions>
## Implementation Decisions

### Chart Data Source

- **D-01:** Multi-year financial trend data comes from **yahoo-finance2 historical/fundamentals
  data** — NOT a new Gemini AI call and NOT parsing the explanation text. This avoids adding
  an extra LLM call to the pipeline. The same `yahoo-finance2` library used for the stock
  quote (STOCK-01, STOCK-02) also provides multi-year historical income statement data
  (revenue, net income, net margin) for the trend chart.

- **D-02:** If yahoo-finance2 returns no historical data for the ticker (common for IDX
  mid/small caps with thin coverage), the chart section is **hidden entirely** — no card,
  no empty state. The stock quote widget (price, P/E, P/B, dividend yield) may still render
  independently if the current quote is available.

- **D-03:** The trend chart displays **Revenue + Net Income as grouped bars** on the primary
  Y-axis, and **Net Margin as an overlaid line** on a secondary Y-axis. Standard combo
  chart (Recharts `ComposedChart`). Targets 3–5 years of data if available.

### Ticker Auto-Detection

- **D-04:** Ticker auto-detection runs **in `parse-document-batch`**, immediately after
  text extraction completes for a document. This is the earliest point where extracted
  page text is available and the pipeline already has the document context. Detection
  writes the ticker to `documents.ticker` (column already exists, nothing writes to it yet).

- **D-05:** Detection method: **regex against extracted page text**. Target patterns common
  in IDX filings:
  - Explicit ticker codes: `BEI: BBCA`, `Kode Efek: BBCA`, `IDX: BBCA`, or standalone
    4-letter uppercase codes near "Tbk" or company name keywords
  - Cover pages typically have this in the first 2–5 pages — focus regex on early pages
  - No LLM call. Fast, free, no quota usage.
  - If no match found, `documents.ticker` remains `null` — stock widget shows
    STOCK-03 fallback ("Market data temporarily unavailable").

### Stock Data Caching

- **D-06:** Stock data (quote + historical) is **cached for 24 hours** (STOCK-05) and
  fetched server-side via a new `GET /api/stock/[ticker]` route. Route returns:
  - Current quote: price, P/E, P/B, dividend yield (STOCK-01, STOCK-02)
  - Historical income data: revenue, net income, net margin by year (for chart)
  - Uses exponential backoff on rate-limit errors (STOCK-05)
  - Never exposes raw yahoo-finance2 error to the client (STOCK-03)

- **D-07:** Cache mechanism: **Supabase DB row** (new `stock_cache` table or new columns
  on `documents`) storing the fetched JSON + a `stock_fetched_at` timestamp. If
  `stock_fetched_at` is within 24 hours, return cached data without hitting yahoo-finance2.
  Planner decides exact table placement (new table vs new columns on `documents`).

### Stock & Chart UI Layout

- **D-08:** The stock widget and trend chart **both render in the explanation panel column**,
  below the score card and above the explanation sections. Placement order in the column:
  1. Score card (Phase 8)
  2. Stock widget (Phase 9 — compact card, 2×2 data grid)
  3. Trend chart (Phase 9 — Recharts ComposedChart card)
  4. Explanation sections (Revenue, Profitability, Balance Sheet, Cash Flow, Key Risks)

  No new layout restructuring to `DocumentReaderLayout` or the split-pane panels.
  `ExplanationPanel` is extended to accept `ticker`, `stockData`, and `chartData` props.

- **D-09:** **Stock widget visual design:** Compact shadcn `Card` with:
  - Header row: detected ticker badge (e.g., "BBCA") + "IDX" label + timestamp ("as of…")
  - Body: 2×2 grid with 4 metrics: Price | P/E | P/B | Dividend Yield
  - IDR amounts formatted as "Rp X.XX triliun" or "Rp X miliar" (STOCK-04)
  - Non-IDR ratios (P/E, P/B, Yield) formatted normally (e.g., "12.4×", "1.8×", "3.2%")

- **D-10:** **Loading/fallback states:**
  - If `ticker` is null: stock widget not rendered at all (no "Enter ticker" prompt — TICKER-02 deferred)
  - If quote fetch fails: compact "Market data temporarily unavailable" muted text in the widget slot (STOCK-03)
  - If historical data unavailable: chart section hidden entirely (D-02)
  - Loading skeleton: reuse `PdfLoadingSkeleton` pattern for both widget and chart while fetching

### IDR Formatting

- **D-11:** Indonesian Rupiah formatting (STOCK-04): create a shared `formatIDR(amount: number): string`
  utility in `src/lib/utils.ts` (or a new `src/lib/format/idr.ts`):
  - ≥ 1,000,000,000,000 → "Rp X.XX triliun"
  - ≥ 1,000,000,000 → "Rp X.XX miliar"
  - ≥ 1,000,000 → "Rp X.XX juta"
  - < 1,000,000 → "Rp X,XXX" (comma-separated)
  - Applied to: revenue and net income chart axis labels and chart tooltips.
  - Stock price in IDR also formatted this way.

### Ticker Override

- **D-12:** **No manual ticker override UI in Phase 9.** TICKER-02 (manual entry/override)
  is deferred to Phase 12 or v2. In v1, if auto-detection fails, stock and chart sections
  are simply unavailable for that document. No "Enter ticker" prompt, no edit button.

### Claude's Discretion

- Exact DB choice for stock cache: new `stock_cache` table vs new columns on `documents`
  (recommended: new columns `stock_data JSONB NULL`, `stock_fetched_at TIMESTAMPTZ NULL` on
  `documents` to avoid another migration)
- Recharts chart component choice: `ComposedChart` with `Bar` + `Line` (recommended)
- Chart card visual design (title, Y-axis labels, tooltip format, legend position)
- Exact regex patterns for ticker detection (4-letter uppercase in proximity to IDX keywords)
- Whether to show the chart year range in the card header (e.g., "2020–2024")
- Skeleton placeholder design for stock widget and chart while data loads

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §TICKER-01, TICKER-02, STOCK-01–05, CHART-01, CHART-02

### Roadmap
- `.planning/ROADMAP.md` §Phase 9 — 5 success criteria, requirements list

### Stack (yahoo-finance2 and Recharts usage patterns)
- `CLAUDE.md` §9 Stock Data — yahoo-finance2 `.JK` ticker usage, error handling patterns, server-side-only constraint
- `CLAUDE.md` §10 Charts — Recharts v3 ComposedChart patterns for revenue/income/margin combo charts

### Existing generation and pipeline code (follow these patterns)
- `src/lib/ingest/parse-document-batch.ts` — extend to add ticker detection after text extraction
- `src/lib/ingest/analyze-document-batch.ts` — existing pipeline orchestration (for reference)
- `src/lib/utils.ts` — add `formatIDR()` utility here

### Existing UI (reuse and extend)
- `src/components/doc/explanation-panel.tsx` — extend to accept `ticker`, `stockData`, `chartData` props; stock widget + chart render between ScoreCard and SECTION_ORDER map
- `src/components/doc/score-card.tsx` — visual reference for card component pattern in explanation panel
- `src/components/doc/pdf-loading-skeleton.tsx` — pattern for skeleton placeholders
- `src/app/doc/[documentId]/page.tsx` — RSC that fetches document data; extend to fetch stock data

### Database schema
- `src/db/database.types.ts` — `documents.ticker` column already exists (string | null); no new migration for ticker column. New stock cache columns needed (planner decides placement).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExplanationPanel` (`src/components/doc/explanation-panel.tsx`): accepts `score` prop already (Phase 8); extend with `ticker`, `stockData`, `chartData` props; stock widget + chart slot between ScoreCard and section map
- `ScoreCard` / `ScoreLoadingSkeleton`: visual reference for card component pattern and skeleton pattern in the explanation column
- `CitationInline`: not needed for Phase 9 (no citations in stock data)
- `PdfLoadingSkeleton`: use as visual reference pattern for stock widget and chart loading states
- `formatIDR`: create as new utility; no existing IDR formatter in codebase

### Established Patterns
- **Soft fail / unavailable state**: `document-reader-layout.tsx` + `document-progress-view.tsx` already handle null explanation gracefully; apply same null-guard pattern for stock data
- **Server-side data fetch in RSC**: `src/app/doc/[documentId]/page.tsx` fetches explanation + score_breakdown then passes to `DocumentProgressView` — extend this pattern to fetch stock data for the detected ticker
- **24h cache with DB**: similar to explanation/score caching pattern in `analyze-document-batch.ts`; use Supabase upsert on `documents` row for stock cache columns
- **Internal API route**: `src/app/api/internal/analyze-batch/route.ts` as structural reference; new `/api/stock/[ticker]` is a public-facing route (no internal secret needed)

### Integration Points
- **Pipeline extension**: `parse-document-batch.ts` → add `detectTicker(chunks: PageChunk[]): string | null` helper after text extraction → `UPDATE documents SET ticker = $1 WHERE id = $2`
- **Stock data fetch**: new `src/lib/stock/fetch-stock-data.ts` (server-only) wrapping `yahoo-finance2` — exports `fetchStockData(ticker: string): Promise<StockData | null>`; called from `page.tsx` RSC or a dedicated API route
- **Consumer**: `src/app/doc/[documentId]/page.tsx` — read `documents.ticker` and `documents.stock_data` in same query as `storage_path`; pass `stockData` to `DocumentProgressView` → `DocumentReaderLayout` → `ExplanationPanel`

</code_context>

<specifics>
## Specific Ideas

- The stock widget should feel like a "market context at a glance" — ticker badge prominent, then
  a clean 2×2 grid of ratios. Data should be clearly labeled and formatted. The "as of [timestamp]"
  label sets user expectation that this is delayed data (not real-time).
- The trend chart should use the same card container pattern as the score card — consistent visual
  hierarchy in the explanation column. The chart title could be "Financial Trend ({ticker})" with
  a year range subtitle.
- IDR formatting matters: "Rp 85 triliun" reads naturally to Indonesian investors; raw "85000000000000"
  would be jarring and break trust.

</specifics>

<deferred>
## Deferred Ideas

- **TICKER-02 (manual ticker override):** User explicitly requested no edit feature in v1. Deferred
  to Phase 12 (Polish) or v2. If auto-detection fails, stock/chart sections are simply unavailable.
- **AI-based chart data extraction:** Using a Gemini AI call to extract historical financials from
  the document itself (more reliable for mid/small caps not covered by yahoo-finance2). Deferred —
  yahoo-finance2 first; if coverage proves insufficient, revisit in v2.
- **Sector comparison:** Showing the company's ratios vs sector median (SECTOR-01, SECTOR-02 in
  REQUIREMENTS.md). Explicitly a v2 requirement.

</deferred>

---

*Phase: 09-stock-data-trend-chart*
*Context gathered: 2026-05-19*
