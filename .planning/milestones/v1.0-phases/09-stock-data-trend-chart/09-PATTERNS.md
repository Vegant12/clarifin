# Phase 9: Stock Data & Trend Chart — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 11 new/modified files
**Analogs found:** 10 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/stock/fetch-stock-data.ts` | service | request-response | `src/lib/explain/generate-score.ts` | role-match |
| `src/lib/stock/detect-ticker.ts` | utility | transform | `src/lib/pdf/classify-extraction-source.ts` | exact |
| `src/lib/utils.ts` (add `formatIDR`) | utility | transform | `src/lib/utils.ts` (self) | exact |
| `src/app/api/stock/[ticker]/route.ts` | route | request-response | `src/app/api/status/route.ts` | exact |
| `src/components/doc/stock-widget.tsx` | component | request-response | `src/components/doc/score-card.tsx` | exact |
| `src/components/doc/trend-chart-card.tsx` | component | request-response | `src/components/doc/score-card.tsx` | role-match |
| `src/components/doc/stock-loading-skeleton.tsx` | component | request-response | `src/components/doc/pdf-loading-skeleton.tsx` | exact |
| `src/components/doc/explanation-panel.tsx` (extend props) | component | request-response | `src/components/doc/explanation-panel.tsx` (self) | exact |
| `src/components/doc/document-reader-layout.tsx` (prop threading) | component | request-response | `src/components/doc/document-reader-layout.tsx` (self) | exact |
| `src/components/doc/mobile-tab-view.tsx` (prop threading) | component | request-response | `src/components/doc/mobile-tab-view.tsx` (self) | exact |
| `src/app/doc/[documentId]/page.tsx` (extend RSC fetch) | route | request-response | `src/app/doc/[documentId]/page.tsx` (self) | exact |
| `supabase/migrations/YYYYMMDD_stock_cache_columns.sql` | migration | CRUD | `supabase/migrations/20260517120000_explain_jsonb.sql` | role-match |
| `src/lib/ingest/parse-document-batch.ts` (inject `detectTicker`) | service | batch | `src/lib/ingest/parse-document-batch.ts` (self) | exact |

---

## Pattern Assignments

### `src/lib/stock/detect-ticker.ts` (utility, transform)

**Analog:** `src/lib/pdf/classify-extraction-source.ts`

This file is the closest structural match: a pure function that accepts an array of strings (page texts), scans a limited window (first N pages), and returns a classified result or sentinel value. No I/O, no side effects.

**Imports pattern** (`classify-extraction-source.ts` lines 1–0 — no imports, pure module):
```typescript
// No imports needed — pure function only
// Mirrors classify-extraction-source.ts which also has no imports

export type ExtractionSource = "unpdf" | "gemini_files";
```

**Core pattern** (`classify-extraction-source.ts` lines 11–23):
```typescript
// Pattern: iterate bounded window of page texts, apply test, return typed result or null
export function classifyExtractionSource(samplePageTexts: string[]): ExtractionSource {
  const n = Math.min(5, samplePageTexts.length);
  if (n === 0) {
    return "gemini_files";
  }
  let weak = 0;
  for (let i = 0; i < n; i++) {
    if (printableLen(samplePageTexts[i] ?? "") < 50) {
      weak++;
    }
  }
  return weak >= 3 ? "gemini_files" : "unpdf";
}
```

**Apply to `detectTicker`:** Replace `samplePageTexts: string[]` with the same type. Replace threshold test with regex match. Return `string | null` (ticker or null). Scan `Math.min(5, texts.length)` pages. Early-return on first match.

---

### `src/lib/utils.ts` — add `formatIDR` and `formatIDRShort` (utility, transform)

**Analog:** `src/lib/utils.ts` (self — extend the existing file)

**Current file content** (lines 1–6):
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Pattern:** New exports appended after `cn`. No new imports needed — pure arithmetic functions only. Follow the same convention: named exports, no default export, TypeScript parameter + return types explicit.

**New additions follow the same export style:**
```typescript
// Append after cn():
export function formatIDR(amount: number): string { ... }
export function formatIDRShort(amount: number): string { ... }
```

---

### `src/lib/stock/fetch-stock-data.ts` (service, request-response)

**Analog:** `src/lib/explain/generate-score.ts` (lines 1–31)

Both are server-only service modules that wrap an external API, handle errors softly (return null on failure), define explicit input/output interfaces, and use `import "server-only"`.

**Imports pattern** (`generate-score.ts` lines 1–17):
```typescript
import "server-only";

import { createPartFromUri, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
// ... domain imports
```

**Apply to `fetch-stock-data.ts`:**
```typescript
import "server-only";

import yahooFinance from "yahoo-finance2";

import { supabaseAdmin } from "@/db/client";
```

**Interface definition pattern** (`generate-score.ts` lines 18–31):
```typescript
export interface GenerateScoreParams {
  docId: string;
  pdfBytes: Uint8Array | null;
  filename: string;
  totalPages: number;
  extractionSource: string | null;
  fileResourceName: string | null;
  firstPageText: string;
}

export interface GenerateScoreResult {
  result: ScoreResult;
  fileResourceName: string;
}
```

**Apply to `fetch-stock-data.ts`:** Define `StockData` and `ChartDataPoint` interfaces/types in the same position. Export them so `page.tsx` and `stock-widget.tsx` can import the types.

**Error handling pattern** (`analyze-document-batch.ts` lines 22–39, `isTransientGeminiError`):
```typescript
function isTransientGeminiError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /(429|rate.?limit|quota|RESOURCE_EXHAUSTED)/i.test(err.message)
  );
}
```

**Apply:** Copy the regex test pattern for detecting rate-limit errors in `withBackoff`. The codebase already uses this exact regexp — stay consistent.

**Cache read/write pattern** (`analyze-document-batch.ts` lines 99–108 and 161–175):
```typescript
// Cache check before expensive operation
const cacheRes = await supabaseAdmin
  .from("document_analysis")
  .select("explanation")
  .eq("doc_id", docId)
  .maybeSingle();

if (!cacheRes.error && cacheRes.data?.explanation != null) {
  await supabaseAdmin.from("documents").update({ status: "ready" }).eq("id", docId);
  return { done: true };
}

// Cache write via upsert
const upsert = await supabaseAdmin
  .from("document_analysis")
  .upsert(
    { doc_id: docId, explanation: result, explanation_at: new Date().toISOString() },
    { onConflict: "doc_id" },
  );
```

**Apply for stock cache:** Replace `.from("document_analysis")` with `.from("documents")`, use `.update()` instead of `.upsert()` (since the documents row already exists), write `stock_data` and `stock_fetched_at` columns. Use `new Date().toISOString()` for the timestamp — consistent with entire codebase.

---

### `src/app/api/stock/[ticker]/route.ts` (route, request-response)

**Analog:** `src/app/api/status/route.ts`

Both are public-facing GET routes with query/path parameter validation via Zod, a Supabase lookup, and a structured JSON response. The stock route uses a path parameter (`[ticker]`) instead of query params, but the validation and response shape are identical.

**Imports pattern** (`status/route.ts` lines 1–6):
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { env } from "@/lib/env";
```

**Apply to `stock/[ticker]/route.ts`:** Same imports minus `env` (no secret needed for public route). Add import for `fetchStockData`.

**Validation pattern** (`status/route.ts` lines 7–51):
```typescript
const querySchema = z.object({
  doc_id: z.string().uuid(),
  session_token: z.string().uuid(),
});

export async function GET(request: Request): Promise<Response> {
  // ...
  const parsed = querySchema.safeParse({ doc_id: rawDocId, session_token: rawSession });
  if (!parsed.success) {
    // ... return 400 with structured error
    return NextResponse.json({ error: "..." }, { status: 400 });
  }
  // ...
}
```

**Apply:** Replace query schema with ticker path param validation: `z.string().regex(/^[A-Z]{1,5}$/)`. Extract from `params` (Next.js dynamic route) not `url.searchParams`. Return 400 on invalid ticker.

**Response pattern** (`status/route.ts` lines 115–119):
```typescript
return NextResponse.json({
  status: row.status,
  updated_at: row.updated_at,
  error_message: row.error_message,
});
```

**Apply:** Return `{ data: StockData | null, error: string | null }` shape. Never expose raw `yahoo-finance2` error text — set `error: "Market data temporarily unavailable"` on failure.

---

### `src/components/doc/stock-widget.tsx` (component, request-response)

**Analog:** `src/components/doc/score-card.tsx`

Both are client components that accept typed data props and render a shadcn `Card`-based section in the explanation panel. Same visual hierarchy: section with `aria-label`, outer `rounded-lg border border-border bg-background` container, inner content grid.

**"use client" + imports pattern** (`score-card.tsx` lines 1–13):
```typescript
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ScoreResult } from "@/lib/explain/score-schema";
import { cn } from "@/lib/utils";

import { CitationInline } from "./citation-inline";
```

**Apply to `stock-widget.tsx`:**
```typescript
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StockData } from "@/lib/stock/fetch-stock-data";
import { formatIDR } from "@/lib/utils";
import { cn } from "@/lib/utils";
```

**Props + section pattern** (`score-card.tsx` lines 14–28):
```typescript
export function ScoreCard(props: {
  documentId: string;
  score: ScoreResult;
  onGoToPage: (page: number) => void;
  className?: string;
}) {
  const { documentId, score, onGoToPage, className } = props;
  return (
    <section
      aria-label="AI Assessment"
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-background p-4",
        className,
      )}
    >
```

**Apply:** Use `<section aria-label="Market Data">` with the same `cn(... className)` pattern. Accept `stockData: StockData | null`, `ticker: string`, `className?: string` props.

**Fallback / unavailable state pattern** (`explanation-panel.tsx` lines 96–107):
```typescript
<section
  aria-label="AI Assessment unavailable"
  className="rounded-lg border border-border bg-muted/30 px-4 py-4"
>
  <p className="text-base font-semibold text-muted-foreground">
    AI Assessment unavailable
  </p>
  <p className="text-sm text-muted-foreground mt-1">
    The AI assessment could not be generated for this document. The explanation below is still available.
  </p>
</section>
```

**Apply for `stockError` state:** Same container class, same muted text style. Message: `"Market data temporarily unavailable"` (STOCK-03 spec).

---

### `src/components/doc/trend-chart-card.tsx` (component, request-response)

**Analog:** `src/components/doc/score-card.tsx` (card container pattern)

No existing Recharts component in codebase — this is the first chart component. The card shell follows `score-card.tsx`. The Recharts internals follow RESEARCH.md Pattern 7.

**CRITICAL: "use client" required.** Recharts references browser DOM globals. This must be the first line — same reason `PdfViewerPanel` uses `dynamic(..., { ssr: false })` in `document-reader-layout.tsx` (line 19).

**"use client" + dynamic import pattern** (`document-reader-layout.tsx` lines 3–20):
```typescript
"use client";

import dynamic from "next/dynamic";
// ...
const PdfViewerPanel = dynamic(() => import("./pdf-viewer-panel").then((m) => m.PdfViewerPanel), {
  ssr: false,
});
```

**Apply to `trend-chart-card.tsx`:** Add `"use client"` at top. Do NOT use `dynamic` on the chart itself — since this component IS already a client component, Recharts imports resolve at client bundle time without needing SSR bypass.

**Card shell pattern** (`score-card.tsx` lines 21–27):
```typescript
<section
  aria-label="AI Assessment"
  className={cn(
    "flex flex-col gap-4 rounded-lg border border-border bg-background p-4",
    className,
  )}
>
```

**Apply:** Use `<section aria-label="Financial Trend">` with the same container class pattern.

---

### `src/components/doc/stock-loading-skeleton.tsx` (component, request-response)

**Analog:** `src/components/doc/pdf-loading-skeleton.tsx` (exact match)

**Full pattern** (`pdf-loading-skeleton.tsx` lines 1–16):
```typescript
"use client";

export function PdfLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading PDF document…"
      aria-busy="true"
      className="flex flex-col gap-3 p-4"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-48 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
```

**Apply:** Copy structure exactly. Change `aria-label` to `"Loading market data…"`. Replace the three `h-48` blocks with two blocks: `h-[108px]` (widget) and `h-[268px]` (chart), matching UI-SPEC skeleton heights. No map needed — just two static `<div>` elements.

---

### `src/components/doc/explanation-panel.tsx` — extend props (component, request-response)

**Analog:** Self — extend existing component.

**Current props type** (lines 79–85):
```typescript
export function ExplanationPanel(props: {
  documentId: string;
  explanation: ExplanationResult;
  score: ScoreResult | null;
  onGoToPage: (page: number) => void;
  className?: string;
}) {
```

**Pattern:** Props are destructured inline on line 86. New props must be added to the type object AND to the destructuring line. Follow the existing `score: ScoreResult | null` nullable pattern for all new optional data.

**Render insertion point** (lines 88–107): New widgets insert between `{score ? <ScoreCard .../> : <section.../>}` block and the `{SECTION_ORDER.map(...)}` call. Follow the existing null-guard pattern:
```typescript
{score ? (
  <ScoreCard documentId={documentId} score={score} onGoToPage={onGoToPage} />
) : (
  <section aria-label="AI Assessment unavailable" ...>...</section>
)}
// Phase 9: insert StockWidget and TrendChartCard here
{SECTION_ORDER.map(...)}
```

---

### `src/components/doc/document-reader-layout.tsx` — prop threading (component, request-response)

**Analog:** Self — extend prop threading.

**Current prop threading pattern** (`document-reader-layout.tsx` lines 27–77):

`DesktopSplitPane` receives `{ documentId, explanation, pdfUrl, pdfRef, score }` and passes `score` down to `ExplanationPanel`. `DocumentReaderLayout` receives the same minus `pdfRef` and passes to both `MobileTabView` and `DesktopSplitPane`.

**Prop threading ladder:**
```
DocumentReaderLayout(props)
  → DesktopSplitPane(props) → ExplanationPanel(props)
  → MobileTabView(props)    → ExplanationPanel(props)
```

**Pattern for adding new props:** Add to all four function signatures and all three call sites simultaneously. The existing `score: ScoreResult | null` (Phase 8) is the exact template — it follows this same ladder.

---

### `src/components/doc/mobile-tab-view.tsx` — prop threading (component, request-response)

**Analog:** Self — extend prop threading.

**Current props** (lines 17–22):
```typescript
export function MobileTabView(props: {
  documentId: string;
  explanation: ExplanationResult;
  pdfUrl: string | null;
  score: ScoreResult | null;
}) {
```

**ExplanationPanel call site** (lines 47–52):
```typescript
<ExplanationPanel
  documentId={documentId}
  explanation={explanation}
  score={score}
  onGoToPage={handleGoToPage}
/>
```

**Pattern:** Add new props to `MobileTabView` type, destructure them, and pass to `ExplanationPanel` call. Exactly mirrors how `score` was added (Phase 8).

---

### `src/app/doc/[documentId]/page.tsx` — extend RSC fetch (route, request-response)

**Analog:** Self — extend existing data fetch.

**Current data fetch pattern** (lines 6–51):
```typescript
export default async function DocumentPage(props: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await props.params;

  let explanation: ExplanationResult | null = null;
  let score: ScoreResult | null = null;
  let pdfUrl: string | null = null;

  // Fetch explanation + score_breakdown in one query
  const analysisRes = await supabaseAdmin
    .from("document_analysis")
    .select("explanation, score_breakdown")
    .eq("doc_id", documentId)
    .maybeSingle();

  if (analysisRes.data?.explanation) {
    const parsed = explanationSchema.safeParse(analysisRes.data.explanation);
    if (parsed.success) {
      explanation = parsed.data;
    }
  }
  // ... pdfUrl fetch ...
  return <DocumentProgressView documentId={documentId} explanation={explanation} pdfUrl={pdfUrl} score={score} />;
}
```

**Pattern for adding stock data fetch:**
1. Extend the `documents` query (currently line 38: `.select("storage_path")`) to also select `ticker, stock_data, stock_fetched_at`.
2. Add `let stockData: StockData | null = null`, `let ticker: string | null = null`, `let stockError = false` alongside existing `let` declarations.
3. After the doc query, conditionally call `fetchStockData(ticker)` (server function direct call — no HTTP round-trip).
4. Pass new props to `<DocumentProgressView>`.

**Zod safeParse pattern** (lines 20–24) — apply to stock data:
```typescript
if (analysisRes.data?.explanation) {
  const parsed = explanationSchema.safeParse(analysisRes.data.explanation);
  if (parsed.success) {
    explanation = parsed.data;
  }
}
```

**Apply:** Use `stockDataSchema.safeParse(docRes.data.stock_data)` to validate cached JSON from `documents.stock_data` before using it. Same null-guard structure.

---

### `src/lib/ingest/parse-document-batch.ts` — inject `detectTicker` (service, batch)

**Analog:** Self — extend existing pipeline.

**Injection point:** After `bootstrapTexts` is assigned (line 88) and after `extractionSource` is determined (line 101), the first 5 page texts are already available in `bootstrapTexts.texts`. The ticker detection runs once, writes to DB, and does not affect the subsequent chunking loop.

**Pattern: single `UPDATE` to `documents` row** (lines 102–110):
```typescript
const up = await supabaseAdmin
  .from("documents")
  .update({
    total_pages: totalPages,
    extraction_source: extractionSource,
  })
  .eq("id", docId);
if (up.error) {
  await failDocument(docId, "Could not update document while parsing.");
  return { done: false };
}
```

**Apply:** Add `ticker: detectTicker(bootstrapTexts.texts)` to the same `update()` call payload. No separate DB round-trip needed — piggybacks on the existing `total_pages` + `extraction_source` write at lines 103–108.

**Soft-fail pattern:** If ticker detection fails for any reason (exception in regex), it must NOT fail the entire parse. Wrap `detectTicker` call in try/catch; on exception log and continue with `ticker: null`. The document parse is more important than ticker detection.

---

### `supabase/migrations/YYYYMMDD_stock_cache_columns.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260517120000_explain_jsonb.sql`

**Pattern** (full file — 9 lines):
```sql
-- Phase 6: explanation column text -> jsonb (EXPLAIN-04 storage shape)
-- D-06 (CONTEXT.md): structured JSON (5 sections) requires jsonb so Supabase JS
-- client accepts plain JS objects without manual JSON.stringify (Pitfall 6).
-- Safe: document_analysis.explanation is NULL for all existing rows
-- (no document_analysis row currently has an explanation written).
-- The USING clause handles the type conversion; NULL casts to NULL in jsonb.

alter table public.document_analysis
  alter column explanation type jsonb using explanation::jsonb;
```

**Apply:** Header comment format with phase reference, safety note, and rationale. Use `ADD COLUMN IF NOT EXISTS` guard (safer than bare ALTER TABLE). Follow existing naming: `timestamptz` for timestamps, `jsonb` for JSON.

---

## Shared Patterns

### `"use client"` Directive
**Source:** `src/components/doc/score-card.tsx` line 1, `src/components/doc/explanation-panel.tsx` line 1, `src/components/doc/pdf-loading-skeleton.tsx` line 1
**Apply to:** `stock-widget.tsx`, `trend-chart-card.tsx`, `stock-loading-skeleton.tsx`

All three new component files must begin with `"use client"`. Recharts (`trend-chart-card`) uses browser DOM APIs. `StockWidget` and `StockLoadingSkeleton` are rendered inside `ExplanationPanel` which is a client component — they inherit the client boundary.

### Supabase Admin Client Import
**Source:** `src/lib/ingest/analyze-document-batch.ts` line 4, `src/app/api/status/route.ts` line 4
```typescript
import { supabaseAdmin } from "@/db/client";
```
**Apply to:** `src/lib/stock/fetch-stock-data.ts`, `src/app/api/stock/[ticker]/route.ts`

Always use `supabaseAdmin` (not `createClient`) for server-side database access. This is the established pattern across all server-side files.

### `import "server-only"` Guard
**Source:** `src/lib/ingest/parse-document-batch.ts` line 1, `src/lib/ingest/analyze-document-batch.ts` line 1, `src/lib/explain/generate-score.ts` line 1
```typescript
import "server-only";
```
**Apply to:** `src/lib/stock/fetch-stock-data.ts`

Any module that calls `yahoo-finance2` (server-only per CLAUDE.md §9) or `supabaseAdmin` must have this guard. Prevents accidental bundling into client code.

### Zod `safeParse` for External Data
**Source:** `src/app/doc/[documentId]/page.tsx` lines 20–24, `src/app/api/status/route.ts` lines 30–51
```typescript
const parsed = explanationSchema.safeParse(analysisRes.data.explanation);
if (parsed.success) {
  explanation = parsed.data;
}
```
**Apply to:** `fetch-stock-data.ts` when validating `yahoo-finance2` response fields, and in `page.tsx` when deserializing `documents.stock_data` from JSONB cache.

### Null-guard conditional rendering
**Source:** `src/components/doc/explanation-panel.tsx` lines 93–107
```typescript
{score ? (
  <ScoreCard ... />
) : (
  <section aria-label="AI Assessment unavailable" ...>...</section>
)}
```
**Apply to:** `ExplanationPanel` — `ticker === null` → render nothing; `stockError === true` → render unavailable message; `chartData === null` → hide `TrendChartCard` entirely (no wrapper section, per D-02).

### `new Date().toISOString()` for Timestamps
**Source:** `src/lib/ingest/analyze-document-batch.ts` lines 47, 61, 164, 232
```typescript
explanation_at: new Date().toISOString(),
```
**Apply to:** `fetch-stock-data.ts` when writing `stock_fetched_at`.

### Error Response Format (API routes)
**Source:** `src/app/api/status/route.ts` lines 18–31
```typescript
return NextResponse.json(
  { error: "Missing query parameters. Required: ..." },
  { status: 400 },
);
```
**Apply to:** `src/app/api/stock/[ticker]/route.ts` — same `{ error: string }` shape for 400 and 404 responses.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/stock/detect-ticker.ts` (test) | test | transform | Closest test is `classify-extraction-source.test.ts` — functional match. No file in the codebase tests regex-based string extraction, but the Vitest/describe/it/expect pattern is well-established. |

Note: `trend-chart-card.tsx` has no exact analog for the Recharts internals — no charting component exists yet. The card shell follows `score-card.tsx`; the `ComposedChart` internals follow RESEARCH.md Pattern 7 (verified via Context7 documentation).

---

## Test File Pattern

All tests follow this structure (from `src/lib/pdf/classify-extraction-source.test.ts` and `src/lib/upload-validation.test.ts`):

```typescript
import { describe, expect, it } from "vitest";
import { functionUnderTest } from "./module-under-test";  // relative import for lib files
// OR
import { functionUnderTest } from "@/lib/path/module";    // alias import

describe("module-name (brief description)", () => {
  it("describes the expected behavior as a statement", () => {
    expect(functionUnderTest(input)).toBe(expectedOutput);
  });
});
```

**Apply to all Phase 9 test files:** `detect-ticker.test.ts`, `fetch-stock-data.test.ts` (with vi.mock), `stock-widget.test.tsx` (jsdom env), `trend-chart-card.test.tsx` (jsdom env), `explanation-panel.test.tsx` (jsdom env).

Component tests (`.test.tsx`) require `jsdom` environment — matched automatically via `vitest.config.ts` glob `src/components/**/*.test.tsx`.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/doc/`, `src/app/api/`, `src/app/doc/`, `supabase/migrations/`
**Files scanned:** 22 source files read directly
**Pattern extraction date:** 2026-05-19
