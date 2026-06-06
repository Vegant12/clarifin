# Phase 9: Stock Data & Trend Chart - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 09-stock-data-trend-chart
**Areas discussed:** Chart data extraction, Ticker detection timing, Stock & chart UI layout, Ticker override UX

---

## Chart data extraction

| Option | Description | Selected |
|--------|-------------|----------|
| New Gemini AI call in the analysis pipeline | Add a generateChartData step in analyze-document-batch. Extracts revenue, net income, gross/net margins for 3–5 years as structured JSON. Most reliable for Bahasa Indonesia filings. Adds ~1 LLM call per document. | |
| Yahoo-finance2 historical data | Pull multi-year financials from yahoo-finance2 instead of parsing the document. Simpler — no LLM call, no new pipeline step. Risk: IDX coverage inconsistent for mid/small caps. | ✓ |
| Parse the explanation text already generated | Use regex/NLP against the Phase 6 explanation output. Avoids an extra LLM call but fragile — prose not structured numeric data. | |

**User's choice:** Yahoo-finance2 historical data

---

## Chart data — fallback behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the chart section entirely | If no historical data, don't render the chart at all. No empty-state noise. | ✓ |
| Show an empty state with explanation | Render the chart card but show a friendly message with the chart area empty. | |
| Show whatever data is available (partial chart) | Render what's there even if only 1–2 years of data. | |

**User's choice:** Hide the chart section entirely

---

## Chart data — metrics to display

| Option | Description | Selected |
|--------|-------------|----------|
| Revenue + Net Income as bars, Net Margin as a line | Standard combo chart: grouped bars for absolute figures, overlaid line for margin %. | ✓ |
| Revenue + Net Income only (no margins) | Simpler — two bar series, no dual Y-axis. | |
| All three: Revenue, Net Income, Gross Margin, Net Margin | Most comprehensive but cluttered. | |

**User's choice:** Revenue + Net Income as bars, Net Margin as a line (ComposedChart)

---

## Ticker detection timing

| Option | Description | Selected |
|--------|-------------|----------|
| During parse-document-batch, after text extraction | Regex against already-extracted page text — early in the pipeline. No LLM needed. Writes ticker to documents row immediately after parsing. | ✓ |
| During analyze-document-batch, before explanation | Run detection at the start of analysis. Allows LLM fallback for edge cases. | |
| On-demand when the doc page loads | Server action triggered lazily on first view. Simpler pipeline, user sees loading states. | |

**User's choice:** During parse-document-batch, after text extraction

---

## Ticker detection — method

| Option | Description | Selected |
|--------|-------------|----------|
| Regex against extracted text | Pattern-match IDX ticker format (4-letter uppercase, near IDX:/BEI:/Kode Emiten: keywords). Fast, free, no LLM. | ✓ |
| LLM-assisted via Gemini | Send cover-page text to Gemini. More accurate on edge cases. Adds ~1 Gemini call. | |
| Regex first, LLM fallback | Try regex first; if no match, send to Gemini. Best accuracy at lowest average cost. | |

**User's choice:** Regex against extracted text

---

## Stock & chart UI layout — panel placement

| Option | Description | Selected |
|--------|-------------|----------|
| Below the score card in the explanation panel column | No layout restructuring. Stock widget + chart render in the same scrollable column as score. | ✓ |
| New full-width section below the split pane | Third row spanning full viewport width. Chart gets more horizontal space. Requires restructuring DocumentReaderLayout. | |
| Stock panel in explanation column, chart below the split | Hybrid. Most layout work. | |

**User's choice:** Below the score card in the explanation panel column

---

## Stock widget — visual design

| Option | Description | Selected |
|--------|-------------|----------|
| Compact inline card with 4 data points in a 2×2 grid | Small card: ticker badge, then 2×2 grid (Price, P/E, P/B, Dividend Yield). | ✓ |
| Horizontal bar of metric chips | Inline row of metric chips directly under score card. More minimal. | |
| Full-width card with larger typography | Prominent card, each metric in its own row. Takes significant vertical space. | |

**User's choice:** Compact inline card with 4 data points in a 2×2 grid

---

## Ticker override UX

| Option | Description | Selected |
|--------|-------------|----------|
| Always-visible ticker badge with edit icon | Badge + pencil icon in widget header. Always visible, user can always correct. | |
| Show 'Enter ticker' prompt only when detection fails | Text input only when ticker is null. Simpler UI. | |
| Separate 'Document settings' section | Collapsible section with editable metadata. | |
| Do not add an edit feature | No ticker override UI in Phase 9. | ✓ (user freeform) |

**User's choice:** Do not add an edit feature — ticker override deferred
**Notes:** User explicitly requested no edit feature. TICKER-02 deferred to Phase 12 or v2.

---

## Claude's Discretion

- Exact DB choice for stock cache (new table vs new columns on `documents`)
- Recharts chart component specifics (axis configuration, tooltip format, legend)
- Exact regex patterns for ticker detection
- Chart card visual design details (title, year range display)
- Skeleton placeholder design

## Deferred Ideas

- TICKER-02 (manual ticker override) — deferred to Phase 12 or v2 at user's explicit request
- AI-based chart data extraction via Gemini — deferred; yahoo-finance2 first
- Sector comparison (SECTOR-01, SECTOR-02) — v2 requirement, not in scope
