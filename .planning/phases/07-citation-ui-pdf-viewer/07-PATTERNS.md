# Phase 7: Citation UI & PDF Viewer - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/doc/[documentId]/page.tsx` (modify) | component (RSC page) | request-response | `src/app/doc/[documentId]/page.tsx` (self, current) | self |
| `src/components/doc/document-progress-view.tsx` (modify) | component (client) | event-driven | `src/components/doc/document-progress-view.tsx` (self, current) | self |
| `src/components/doc/document-reader-layout.tsx` | component (client) | event-driven | `src/components/doc/document-progress-view.tsx` | role-match |
| `src/components/doc/explanation-panel.tsx` | component (client) | transform | `src/components/upload/pipeline-stepper.tsx` | role-match |
| `src/components/doc/pdf-viewer-panel.tsx` | component (client) | event-driven | `src/components/upload/pdf-dropzone.tsx` | role-match |
| `src/components/doc/citation-inline.tsx` | component (client) | event-driven | `src/components/upload/pipeline-stepper.tsx` | role-match |
| `src/components/doc/citation-popover.tsx` | component (client) | request-response | `src/components/upload/pdf-dropzone.tsx` | role-match |
| `src/components/doc/jargon-tooltip.tsx` | component (client) | event-driven | `src/components/upload/pipeline-stepper.tsx` | role-match |
| `src/components/doc/pdf-loading-skeleton.tsx` | component (client) | event-driven | `src/components/upload/pipeline-stepper.tsx` | role-match |
| `src/components/doc/mobile-tab-view.tsx` | component (client) | event-driven | `src/components/doc/document-progress-view.tsx` | role-match |
| `src/app/api/page-text/route.ts` | controller (API route) | request-response | `src/app/api/status/route.ts` | exact |
| `src/lib/jargon/jargon-dictionary.json` | utility (static data) | transform | `src/lib/eval/prompts.ts` (static export) | partial-match |

---

## Pattern Assignments

### `src/app/doc/[documentId]/page.tsx` (RSC page, request-response) — MODIFY

**Analog:** `src/app/doc/[documentId]/page.tsx` (current state) + `src/app/page.tsx`

**Current file** (lines 1–7) — extend this, don't replace the async RSC pattern:
```typescript
import { DocumentProgressView } from "@/components/doc/document-progress-view";

export default async function DocumentPage(props: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await props.params;

  return <DocumentProgressView documentId={documentId} />;
}
```

**Server-side Supabase fetch pattern** — copy from `src/app/api/status/route.ts` (lines 55–73) but adapted for RSC:
```typescript
// RSC pattern: import supabaseAdmin directly (server-only module), fetch at render time
import { supabaseAdmin } from "@/db/client";

// Fetch explanation JSON from document_analysis
const analysisRow = await supabaseAdmin
  .from("document_analysis")
  .select("explanation")
  .eq("doc_id", documentId)
  .maybeSingle();

// Fetch signed URL for the PDF from Storage
const signedRes = await supabaseAdmin.storage
  .from("pdfs")
  .createSignedUrl(storagePath, 3600); // 1h TTL
```

**Graceful null handling** — if `analysisRow.data` is null or status is not "ready", pass null props to let the client component handle the empty state. No throw/redirect.

---

### `src/components/doc/document-progress-view.tsx` (client component) — MODIFY

**Analog:** self (`src/components/doc/document-progress-view.tsx`, current)

**Change:** add a branch on `data?.status === "ready"` that renders `DocumentReaderLayout` instead of `PipelineStepper`. The existing mount-guard, session-token guard, and UUID validation patterns stay unchanged.

**Existing branch pattern to extend** (lines 38–40):
```typescript
const terminal = data?.status === "ready" || data?.status === "failed";
```

**New branch** — insert after line 104 (current `status === "ready"` message block):
```typescript
if (data?.status === "ready") {
  return (
    <DocumentReaderLayout
      documentId={documentId}
      explanation={explanation}   // prop passed from page.tsx RSC
      pdfUrl={pdfUrl}             // signed URL prop from page.tsx RSC
    />
  );
}
```

**Import additions** (top of file, following existing import ordering: next → react → local shadcn → local lib):
```typescript
import { DocumentReaderLayout } from "@/components/doc/document-reader-layout";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
```

---

### `src/app/api/page-text/route.ts` (API route, request-response) — NEW

**Analog:** `src/app/api/status/route.ts` (exact role + data flow match)

**Imports pattern** (analog lines 1–5):
```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
```

**Query param validation pattern** (analog lines 7–51):
```typescript
const querySchema = z.object({
  doc_id: z.string().uuid(),
  page: z.coerce.number().int().positive(),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawDocId = url.searchParams.get("doc_id");
  const rawPage = url.searchParams.get("page");

  if (rawDocId === null || rawPage === null) {
    return NextResponse.json(
      { error: "Missing query parameters. Required: doc_id (UUID) and page (integer)." },
      { status: 400 },
    );
  }

  const parsed = querySchema.safeParse({ doc_id: rawDocId, page: rawPage });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters." }, { status: 400 });
  }
```

**Session validation pattern** (analog lines 55–63) — NOTE: the `/api/page-text` route validates `session_token` the same way, then checks the doc belongs to that session before returning chunk text:
```typescript
  const sessionRes = await supabaseAdmin
    .from("chat_sessions")
    .select("id")
    .eq("session_token", session_token)
    .maybeSingle();

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
```

**Supabase query pattern** (analog lines 65–73) — for page-text, query `chunks` table:
```typescript
  const chunkRes = await supabaseAdmin
    .from("chunks")
    .select("content")
    .eq("doc_id", parsed.data.doc_id)
    .eq("page_number", parsed.data.page)
    .limit(1)
    .maybeSingle();

  if (chunkRes.error || !chunkRes.data) {
    return NextResponse.json({ error: "Page text not found." }, { status: 404 });
  }

  return NextResponse.json({ text: chunkRes.data.content });
```

**Error return shape:** `NextResponse.json({ error: string }, { status: N })` — consistent with all other API routes.

---

### `src/components/doc/document-reader-layout.tsx` (client component, event-driven) — NEW

**Analog:** `src/components/doc/document-progress-view.tsx` (same role: client wrapper component)

**"use client" + import ordering pattern** (analog lines 1–13):
```typescript
"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
// react-resizable-panels: Panel, PanelGroup, PanelResizeHandle
```

**Props interface pattern** — use explicit typed props object, same as all existing components:
```typescript
export function DocumentReaderLayout(props: {
  documentId: string;
  explanation: ExplanationResult | null;
  pdfUrl: string | null;
}) {
  const { documentId, explanation, pdfUrl } = props;
```

**Tailwind responsive pattern** — follow `src/app/page.tsx` (className-based responsive, no JS media queries):
```typescript
// Desktop: hidden md:flex  (react-resizable-panels PanelGroup)
// Mobile:  flex md:hidden   (MobileTabView)
```

**LocalStorage persistence** — react-resizable-panels has a built-in `storage` prop; no manual localStorage code needed. Supply `id="reader-panel-group"` for stable key.

**Error/empty state pattern** — copy from `document-progress-view.tsx` (lines 62–76) using `Card + CardContent + Button asChild` layout for the "explanation not ready" fallback:
```typescript
if (!explanation) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-16 px-6 py-16">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-8">
          <p className="font-semibold text-base">Explanation not ready</p>
          <p className="text-muted-foreground text-sm">
            The analysis is still processing. Check back in a moment.
          </p>
          <Button asChild variant="outline" className="h-11">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
```

---

### `src/components/doc/explanation-panel.tsx` (client component, transform) — NEW

**Analog:** `src/components/upload/pipeline-stepper.tsx` (client component rendering structured data)

**"use client" + imports pattern** (analog lines 1–6):
```typescript
"use client";

import { cn } from "@/lib/utils";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
```

**Structured data rendering pattern** — pipeline-stepper maps over a fixed array; explanation-panel maps over the 5 sections of `ExplanationResult`. Same shape: derive display labels from a constant map, iterate, render each item.

**Section label constant pattern** (analog `STEPS` array lines 7–7):
```typescript
const SECTION_LABELS: Record<keyof ExplanationResult, string> = {
  revenue: "Revenue",
  profitability: "Profitability",
  balance_sheet: "Balance Sheet",
  cash_flow: "Cash Flow",
  key_risks: "Key Risks",
} as const;
```

**Citation inline detection** — scan each section string for `[p.N]` using a regex split, render plain text spans interleaved with `<CitationInline page={N} />` components. Pattern similar to the step label rendering in pipeline-stepper.

**Jargon detection** — after citation splitting, run a client-side substring match against the jargon dictionary on each plain text segment; wrap matching substrings in `<JargonTooltip>`. Case-insensitive.

**Tailwind classes** — body text: `text-base text-foreground leading-relaxed`, section headings: `text-xl font-semibold`, section gaps: `flex flex-col gap-6`.

---

### `src/components/doc/pdf-viewer-panel.tsx` (client component, event-driven) — NEW

**Analog:** `src/components/upload/pdf-dropzone.tsx` (async loading state, error handling, Loader2 pattern)

**"use client" + state pattern** (analog lines 1–26):
```typescript
"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
// react-pdf: Document, Page

type LoadState = "loading" | "loaded" | "error";

export function PdfViewerPanel(props: {
  pdfUrl: string | null;
  onPageCount?: (total: number) => void;
}) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
```

**Imperative scroll API** — expose via `useImperativeHandle` / forwarded ref or callback prop so `CitationInline` click can call `scrollToPage(N)`. Pattern: store per-page `div` refs in a `Map<number, HTMLDivElement>`, call `ref.scrollIntoView({ behavior: "smooth" })`.

**Loading state pattern** — copy from `pdf-dropzone.tsx` (lines 195–200): render `PdfLoadingSkeleton` while `loadState === "loading"`, hide with conditional:
```typescript
{loadState === "loading" ? <PdfLoadingSkeleton /> : null}
```

**Error state pattern** — copy destructive alert pattern from `document-progress-view.tsx` (lines 112–121):
```typescript
{loadState === "error" ? (
  <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm">
    Could not load PDF. Try refreshing the page.
  </div>
) : null}
```

**ARIA pattern** — `aria-label="Source document viewer"`, `aria-busy={loadState === "loading"}` (mirrors `aria-live="polite"` usage in document-progress-view.tsx line 99).

---

### `src/components/doc/citation-inline.tsx` (client component, event-driven) — NEW

**Analog:** `src/components/upload/pipeline-stepper.tsx` (renders a single step item with conditional styling)

**"use client" + minimal imports pattern**:
```typescript
"use client";

import { cn } from "@/lib/utils";
```

**Props interface** — keep minimal, follow pipeline-stepper step shape:
```typescript
export function CitationInline(props: {
  page: number;
  docId: string;
  onGoToPage: (page: number) => void;
}) {
```

**Interactive span pattern** — keyboard accessible, follows project `tabIndex` + role pattern:
```typescript
<span
  role="button"
  tabIndex={0}
  aria-label={`View source for page ${page}`}
  className={cn(
    "inline-flex items-center rounded-full bg-primary px-1.5 py-0.5",
    "text-primary-foreground text-xs cursor-pointer",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  )}
  onClick={() => onGoToPage(page)}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onGoToPage(page); }}
>
  {`[p.${page}]`}
</span>
```

**Popover wrapping** — `CitationInline` wraps itself in a shadcn `Popover` with `CitationPopover` as content. Open state: `open` prop controlled by hover (150ms delay) and keyboard focus. Use `onOpenChange` to toggle.

---

### `src/components/doc/citation-popover.tsx` (client component, request-response) — NEW

**Analog:** `src/components/upload/pdf-dropzone.tsx` (on-demand fetch with loading/error/success states, same `fetch` + error string pattern)

**Fetch pattern** — on-demand per hover, cached in a `Map` (same cancellation safety as `use-document-status.ts`):
```typescript
// Client-side cache — keyed by `${docId}:${page}`
const pageTextCache = new Map<string, string>();

async function fetchPageText(docId: string, page: number): Promise<string> {
  const key = `${docId}:${page}`;
  if (pageTextCache.has(key)) return pageTextCache.get(key)!;

  const qs = new URLSearchParams({ doc_id: docId, page: String(page) });
  const res = await fetch(`/api/page-text?${qs.toString()}`);
  if (!res.ok) throw new Error("unavailable");
  const body = (await res.json()) as { text: string };
  pageTextCache.set(key, body.text);
  return body.text;
}
```

**Loading state pattern** — copy `aria-live="polite"` + text swap from `pdf-dropzone.tsx` (lines 196–200):
```typescript
type FetchState = "idle" | "loading" | "loaded" | "error";
const [fetchState, setFetchState] = useState<FetchState>("idle");
const [pageText, setPageText] = useState<string | null>(null);
```

**Error display** — `text-muted-foreground text-sm` (not destructive — copy muted tone from document-progress-view.tsx line 47).

**"Go to page" button** — use existing `Button` component with `variant="default"` (emerald primary fill per UI-SPEC):
```typescript
<Button size="sm" onClick={() => onGoToPage(page)}>
  {`Go to page ${page} →`}
</Button>
```

---

### `src/components/doc/jargon-tooltip.tsx` (client component, event-driven) — NEW

**Analog:** `src/components/upload/pipeline-stepper.tsx` (wraps a child with conditional visual treatment)

**Minimal client component pattern**:
```typescript
"use client";

// shadcn Tooltip: TooltipProvider, Tooltip, TooltipTrigger, TooltipContent
```

**Props interface**:
```typescript
export function JargonTooltip(props: {
  term: string;
  definition: string;
  children: React.ReactNode;
}) {
```

**Dotted underline** — CSS class only, no icon. Use `decoration-dotted underline decoration-muted-foreground underline-offset-2` (Tailwind utility classes, consistent with project's utility-only styling):
```typescript
<TooltipTrigger asChild>
  <span
    className="underline decoration-dotted decoration-muted-foreground underline-offset-2 cursor-help"
    aria-describedby={tooltipId}
  >
    {children}
  </span>
</TooltipTrigger>
```

**Tooltip delay** — `delayDuration={300}` on shadcn `<Tooltip>` (matches UI-SPEC 300ms).

---

### `src/components/doc/pdf-loading-skeleton.tsx` (client component, event-driven) — NEW

**Analog:** `src/components/upload/pipeline-stepper.tsx` (renders a static visual structure)

**Minimal pattern** — no state, no effects, pure presentational:
```typescript
"use client";

export function PdfLoadingSkeleton() {
  return (
    <div aria-label="Loading PDF document…" aria-busy="true" className="flex flex-col gap-3 p-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-48 w-full animate-pulse rounded-md bg-muted"
        />
      ))}
    </div>
  );
}
```

**`animate-pulse` class** — already used in project via `tw-animate-css` (imported in `globals.css` line 2). No new dependencies.

---

### `src/components/doc/mobile-tab-view.tsx` (client component, event-driven) — NEW

**Analog:** `src/components/doc/document-progress-view.tsx` (client wrapper with conditional section rendering)

**"use client" + shadcn Tabs pattern**:
```typescript
"use client";

import { useState } from "react";
// shadcn: Tabs, TabsList, TabsTrigger, TabsContent
```

**Props interface** — accepts the same explanation + pdfUrl + docId as DocumentReaderLayout, renders them in tab layout:
```typescript
export function MobileTabView(props: {
  documentId: string;
  explanation: ExplanationResult | null;
  pdfUrl: string | null;
  onGoToPage: (page: number) => void;
}) {
```

**Tab copy** — "Explanation" and "Source PDF" (verbatim from UI-SPEC copywriting contract).

**Active tab indicator** — shadcn Tabs uses `data-[state=active]` selectors; add `data-[state=active]:border-b-2 data-[state=active]:border-primary` to `TabsTrigger` className for emerald bottom border (UI-SPEC active tab visual).

---

### `src/lib/jargon/jargon-dictionary.json` (static data) — NEW

**Analog:** `src/lib/eval/prompts.ts` (static export of a constant data structure)

**Shape** — flat JSON object, keys are lowercase term strings, values are one-sentence plain-English definitions:
```json
{
  "laba bersih": "Net profit — the money left after all expenses are subtracted from total revenue.",
  "aset lancar": "Current assets — assets a company can convert to cash within one year.",
  "ekuitas": "Equity — the value owned by shareholders after all debts are subtracted.",
  "arus kas": "Cash flow — the actual cash moving in and out of the company.",
  "beban pokok penjualan": "Cost of goods sold (COGS) — the direct costs of producing what the company sells."
}
```

**Import pattern** — static JSON, imported directly in `jargon-tooltip.tsx` or a thin wrapper `src/lib/jargon/index.ts`:
```typescript
import jargonDict from "@/lib/jargon/jargon-dictionary.json";
// type: Record<string, string>
```

No `"use client"` on the JSON import file itself. The JSON is bundled at build time.

---

## Shared Patterns

### "use client" Directive
**Source:** `src/components/doc/document-progress-view.tsx` (line 1), `src/components/upload/pdf-dropzone.tsx` (line 1)
**Apply to:** All 9 new component files
```typescript
"use client";
```
All Phase 7 components are client components. The only RSC in this phase is the modified `page.tsx`.

### Import Ordering Convention
**Source:** `src/components/doc/document-progress-view.tsx` (lines 1–13)
**Apply to:** All new files
```typescript
// 1. "use client" (if client component)
// 2. External packages (react, next, lucide-react, third-party)
// 3. shadcn/ui components from @/components/ui/
// 4. Local doc components from @/components/doc/
// 5. Local lib/hooks from @/lib/
```

### Session Token + Doc Ownership Pattern
**Source:** `src/app/api/status/route.ts` (lines 7–73)
**Apply to:** `src/app/api/page-text/route.ts`

Every GET route that takes `doc_id` must:
1. Validate `doc_id` and `session_token` with `z.string().uuid()`
2. Confirm `session_token` exists in `chat_sessions` via `.maybeSingle()`
3. Confirm the doc's `session_id` matches before returning data

```typescript
// Step 1: validate params
const querySchema = z.object({
  doc_id: z.string().uuid(),
  session_token: z.string().uuid(),
});

// Step 2: confirm session
const sessionRes = await supabaseAdmin
  .from("chat_sessions")
  .select("id")
  .eq("session_token", session_token)
  .maybeSingle();
if (sessionRes.error || !sessionRes.data) {
  return NextResponse.json({ error: "Document not found." }, { status: 404 });
}
```

### Error Display (Client)
**Source:** `src/components/doc/document-progress-view.tsx` (lines 112–121) + `src/components/upload/pdf-dropzone.tsx` (lines 183–192)
**Apply to:** `CitationPopover`, `PdfViewerPanel`, `DocumentReaderLayout`

Two tiers:
- **Destructive error** (PDF load fail, hard errors): `border-destructive/40 bg-destructive/5 text-destructive` with `role="alert"`
- **Muted/soft error** (popover "unavailable"): `text-muted-foreground text-sm` (no alert role)

### Supabase Admin Server-Only Import
**Source:** `src/db/client.ts` (line 1: `import "server-only"`)
**Apply to:** `src/app/api/page-text/route.ts`, `src/app/doc/[documentId]/page.tsx` (RSC fetch additions)
```typescript
import { supabaseAdmin } from "@/db/client";
// supabaseAdmin is server-only — never import in client components
```

### `cn()` Utility
**Source:** `src/lib/utils.ts`
**Apply to:** All new components with conditional Tailwind classes
```typescript
import { cn } from "@/lib/utils";
// Usage: className={cn("base-class", condition && "conditional-class")}
```

### NextResponse JSON Shape
**Source:** `src/app/api/status/route.ts` (lines 115–119), `src/app/api/upload-complete/route.ts` (lines 103–105)
**Apply to:** `src/app/api/page-text/route.ts`

Success: `NextResponse.json({ fieldName: value })` — single flat object, no wrapper.
Error: `NextResponse.json({ error: string }, { status: N })` — always an `error` string key.

### Tailwind Layout Pattern
**Source:** `src/app/page.tsx` (lines 32–33), `src/components/doc/document-progress-view.tsx` (line 41)
**Apply to:** `DocumentReaderLayout`, `ExplanationPanel`, `MobileTabView`

Full-height reader layout uses `min-h-screen` + `flex` columns. The split-pane layout breaks from `max-w-3xl` — use `w-full` + `h-screen overflow-hidden` for the reader to fill the viewport.

---

## No Analog Found

All files have analogs in the existing codebase. No entries needed here.

---

## Metadata

**Analog search scope:** `src/` (all TypeScript + TSX files)
**Files scanned:** 53
**Pattern extraction date:** 2026-05-18
