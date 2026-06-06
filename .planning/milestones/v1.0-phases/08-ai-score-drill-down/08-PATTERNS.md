# Phase 8: AI Score & Drill-Down - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 10 (3 new, 7 modified)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/explain/score-schema.ts` | schema/utility | transform | `src/lib/explain/explanation-schema.ts` | exact |
| `src/lib/explain/score-prompts.ts` | utility | transform | `src/lib/explain/explain-prompts.ts` | exact |
| `src/lib/explain/generate-score.ts` | service | request-response | `src/lib/explain/generate-explanation.ts` | exact |
| `src/lib/ingest/analyze-document-batch.ts` | service | CRUD + request-response | itself (extension) | exact |
| `src/app/doc/[documentId]/page.tsx` | route (RSC) | request-response | itself (extension) | exact |
| `src/components/doc/score-card.tsx` | component | event-driven | `src/components/doc/explanation-panel.tsx` | role-match |
| `src/components/doc/score-loading-skeleton.tsx` | component | - | `src/components/doc/pdf-loading-skeleton.tsx` | exact |
| `src/components/doc/explanation-panel.tsx` | component | event-driven | itself (extension) | exact |
| `src/components/doc/document-reader-layout.tsx` | component | event-driven | itself (extension) | exact |
| `src/components/doc/document-progress-view.tsx` | component | event-driven | itself (extension) | exact |

---

## Pattern Assignments

### `src/lib/explain/score-schema.ts` (schema/utility, transform)

**Analog:** `src/lib/explain/explanation-schema.ts`

**Full file to mirror** (lines 1-32):
```typescript
import { z } from "zod";

export const explanationSchema = z.object({
  revenue: z.string().min(1),
  profitability: z.string().min(1),
  // ... fields
});

export type ExplanationResult = z.infer<typeof explanationSchema>;

export const EXPLANATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: { /* ... */ },
  required: ["revenue", "profitability", "balance_sheet", "cash_flow", "key_risks"],
} as const;
```

**Score variant** — extend with nested array schema. Key differences:
- `snippetSchema` sub-object: `{ text: z.string().min(1), page: z.number().int().positive() }`
- `dimensionSchema` sub-object with `snippets: z.array(snippetSchema).min(1).max(3)`
- `scoreSchema` root: `{ overall_score: z.number().int().min(1).max(10), dimensions: z.array(dimensionSchema).length(4) }`
- `SCORE_RESPONSE_SCHEMA` raw JSON Schema: `minItems: 4, maxItems: 4` for dimensions array; `minimum: 1, maximum: 10` for integer score fields
- Export: `export type ScoreResult = z.infer<typeof scoreSchema>`
- No `import "server-only"` — pure Zod, importable in Vitest tests (same as `explanation-schema.ts`)

---

### `src/lib/explain/score-prompts.ts` (utility, transform)

**Analog:** `src/lib/explain/explain-prompts.ts`

**Imports pattern** (lines 1-6, none — pure module):
```typescript
// No imports — pure strings/functions, importable in Vitest tests.
// Pattern: src/lib/explain/explain-prompts.ts (same constraint)
```

**Model ID pattern** (line 7):
```typescript
// ANALOG: explain-prompts.ts line 7
export const EXPLANATION_MODEL_ID = "gemini-2.0-flash" as const;

// SCORE VERSION — use 2.5-flash explicitly, do NOT inherit from EXPLANATION_MODEL_ID:
export const SCORE_MODEL_ID = "gemini-2.5-flash" as const;
```

**Prompt builder pattern** (lines 70-86):
```typescript
// ANALOG: src/lib/explain/explain-prompts.ts lines 70-86
export function buildExplanationPrompt(totalPages: number, isIndonesian: boolean): string {
  const glossaryBlock = isIndonesian
    ? `\n\nBAHASA INDONESIA VOCABULARY REFERENCE...\n${PSAK_GLOSSARY}`
    : "";
  return `${EXPLAIN_SYSTEM_PROMPT} The document has ${totalPages} total pages...${glossaryBlock}
Produce a JSON object with EXACTLY these five string keys...`;
}

// SCORE VERSION — same signature, different body:
export function buildScorePrompt(totalPages: number, isIndonesian: boolean): string {
  const langNote = isIndonesian ? `The document is in Bahasa Indonesia...` : "";
  return `You are a financial analyst reviewing...${langNote}
RULES (non-negotiable):
- Do NOT use: buy, sell, invest, recommend, accumulate, avoid, underweight, overweight.
...`.trim();
}
```

**PSAK_GLOSSARY reuse** — import from `explain-prompts.ts` or duplicate reference if isIndonesian note is injected. Simpler to inline the language note directly since score prompt structure differs.

**Compliance guard function** — export a named function for independent testability:
```typescript
const BLOCKED_TERMS = /\b(buy|sell|invest|recommend|accumulate|avoid|underweight|overweight)\b/i;
export function scanForInvestmentAdvice(text: string): string | null {
  const m = BLOCKED_TERMS.exec(text);
  return m ? m[0] : null;
}
```

---

### `src/lib/explain/generate-score.ts` (service, request-response)

**Analog:** `src/lib/explain/generate-explanation.ts`

**Full imports pattern** (lines 1-16):
```typescript
import "server-only";

import { createPartFromUri, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
import {
  SCORE_RESPONSE_SCHEMA,
  scoreSchema,
  type ScoreResult,
} from "@/lib/explain/score-schema";
import { SCORE_MODEL_ID, buildScorePrompt } from "@/lib/explain/score-prompts";
import { isIndonesianDoc, waitForFileReady, uploadFresh } from "@/lib/explain/generate-explanation";
```

Note: `waitForFileReady` and `uploadFresh` must be exported from `generate-explanation.ts` before this import works (Pitfall 1 from RESEARCH.md — they are currently unexported at lines 21 and 47).

**Params/result interface pattern** (lines 110-123):
```typescript
// ANALOG: src/lib/explain/generate-explanation.ts lines 110-123
export interface GenerateExplanationParams {
  docId: string;
  pdfBytes: Uint8Array | null;
  filename: string;
  totalPages: number;
  extractionSource: string | null;
  fileResourceName: string | null;
  firstPageText: string;
}
export interface GenerateExplanationResult {
  result: ExplanationResult;
  fileResourceName: string;
}

// SCORE VERSION — same shape, different types:
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

**File resource resolution pattern** (lines 143-167):
```typescript
// ANALOG: src/lib/explain/generate-explanation.ts lines 143-167
try {
  if (params.fileResourceName) {
    const ready = await waitForFileReady(ai, params.fileResourceName);
    resourceName = params.fileResourceName;
    uri = ready.uri;
    mimeType = ready.mimeType;
  } else {
    if (!params.pdfBytes) {
      throw new Error("generateExplanation: no fileResourceName and no pdfBytes...");
    }
    const fresh = await uploadFresh(ai, params.pdfBytes, params.filename);
    resourceName = fresh.resourceName;
    uri = fresh.uri;
    mimeType = fresh.mimeType;
  }
} catch (err) {
  // FAILED / expired path — fall through to re-upload if we have bytes
  if (!params.pdfBytes) throw err;
  const fresh = await uploadFresh(ai, params.pdfBytes, params.filename);
  resourceName = fresh.resourceName;
  uri = fresh.uri;
  mimeType = fresh.mimeType;
}
```

**generateContentStream call pattern** (lines 172-185):
```typescript
// ANALOG: src/lib/explain/generate-explanation.ts lines 172-185
const stream = await ai.models.generateContentStream({
  model: EXPLANATION_MODEL_ID,
  contents: [createPartFromUri(uri, mimeType), { text: prompt }],
  config: {
    responseMimeType: "application/json",
    responseSchema: EXPLANATION_RESPONSE_SCHEMA,
  },
});

// Accumulate chunks — each chunk is partial JSON; do NOT JSON.parse per chunk (Pitfall 1)
let accumulated = "";
for await (const chunk of stream) {
  accumulated += (chunk as { text?: string }).text ?? "";
}

// SCORE VERSION — add thinkingBudget: 0 in config:
const stream = await ai.models.generateContentStream({
  model: SCORE_MODEL_ID,
  contents: [createPartFromUri(uri, mimeType), { text: prompt }],
  config: {
    responseMimeType: "application/json",
    responseSchema: SCORE_RESPONSE_SCHEMA,
    thinkingConfig: { thinkingBudget: 0 },
  },
});
```

**Markdown fence strip + Zod parse pattern** (lines 192-199):
```typescript
// ANALOG: src/lib/explain/generate-explanation.ts lines 192-199
const stripped = accumulated
  .trim()
  .replace(/^```(?:json)?\s*/i, "")
  .replace(/\s*```$/i, "");

const parsed = JSON.parse(stripped) as unknown;
const result = explanationSchema.parse(parsed);  // throws ZodError on invalid shape

return { result, fileResourceName: resourceName };
```

**Compliance scan** — insert between `Zod parse` and `return`, using `scanForInvestmentAdvice`:
```typescript
// NEW in score — compliance check before returning result
for (const dim of result.dimensions) {
  const violation = scanForInvestmentAdvice(dim.reasoning);
  if (violation) {
    throw new Error(`Compliance violation: blocked term "${violation}" in reasoning.`);
  }
  for (const snip of dim.snippets) {
    const v2 = scanForInvestmentAdvice(snip.text);
    if (v2) throw new Error(`Compliance violation: blocked term "${v2}" in snippet.`);
  }
}
```

---

### `src/lib/ingest/analyze-document-batch.ts` (service, CRUD + request-response) — MODIFIED

**Analog:** itself

**Cache gate pattern to mirror** (lines 98-107):
```typescript
// ANALOG: src/lib/ingest/analyze-document-batch.ts lines 98-107
const cacheRes = await supabaseAdmin
  .from("document_analysis")
  .select("explanation")
  .eq("doc_id", docId)
  .maybeSingle();

if (!cacheRes.error && cacheRes.data?.explanation != null) {
  await supabaseAdmin.from("documents").update({ status: "ready" }).eq("id", docId);
  return { done: true };
}
```

**Score cache gate to insert after step 8 (upsert explanation)**:
```typescript
// NEW Step 8b — Score cache check (mirrors explanation cache gate above)
const scoreCacheRes = await supabaseAdmin
  .from("document_analysis")
  .select("score")
  .eq("doc_id", docId)
  .maybeSingle();

if (scoreCacheRes.data?.score == null) {
  let scoreGenResult: GenerateScoreResult | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      scoreGenResult = await generateScore({ ... });
      break;
    } catch (err) {
      const isZodError = err instanceof Error && err.name === "ZodError";
      if (!isZodError || attempt === 2) { console.error(...); break; }
    }
  }
  if (scoreGenResult) {
    await supabaseAdmin.from("document_analysis").upsert(
      {
        doc_id: docId,
        score: scoreGenResult.result.overall_score,
        score_breakdown: scoreGenResult.result,
        score_at: new Date().toISOString(),
      },
      { onConflict: "doc_id" },
    );
  }
  // Soft fail (D-02): if scoreGenResult is null, document still transitions to ready below
}
```

**Upsert pattern** (lines 160-174):
```typescript
// ANALOG: src/lib/ingest/analyze-document-batch.ts lines 160-174
const upsert = await supabaseAdmin
  .from("document_analysis")
  .upsert(
    { doc_id: docId, explanation: result, explanation_at: new Date().toISOString() },
    { onConflict: "doc_id" },
  );
if (upsert.error) {
  await failDocumentAnalyze(docId, "Could not save explanation. Try again later.");
  return { done: false };
}
```

**Soft/hard fail helpers** (lines 40-60):
```typescript
// ANALOG: src/lib/ingest/analyze-document-batch.ts lines 40-60
async function failDocumentAnalyze(docId: string, message: string): Promise<void> {
  await supabaseAdmin.from("documents").update({
    status: "failed", error_message: message, failed_at: new Date().toISOString(),
  }).eq("id", docId);
}
async function softFailDocumentAnalyze(docId: string, message: string): Promise<void> {
  await supabaseAdmin.from("documents").update({
    error_message: message, updated_at: new Date().toISOString(),
  }).eq("id", docId);
}
```

---

### `src/app/doc/[documentId]/page.tsx` (RSC route) — MODIFIED

**Analog:** itself

**Current RSC fetch + safeParse pattern** (lines 12-23):
```typescript
// ANALOG: src/app/doc/[documentId]/page.tsx lines 12-23
const analysisRes = await supabaseAdmin
  .from("document_analysis")
  .select("explanation")
  .eq("doc_id", documentId)
  .maybeSingle();

if (analysisRes.data?.explanation) {
  const parsed = explanationSchema.safeParse(analysisRes.data.explanation);
  if (parsed.success) {
    explanation = parsed.data;
  }
}
```

**Score extension** — extend `.select()` and add parallel safeParse:
```typescript
// MODIFIED: extend select to include score_breakdown
const analysisRes = await supabaseAdmin
  .from("document_analysis")
  .select("explanation, score_breakdown")
  .eq("doc_id", documentId)
  .maybeSingle();

// Existing explanation parse (unchanged)
if (analysisRes.data?.explanation) {
  const parsed = explanationSchema.safeParse(analysisRes.data.explanation);
  if (parsed.success) { explanation = parsed.data; }
}

// NEW: score_breakdown parse (same safeParse pattern)
const scoreParseResult = scoreSchema.safeParse(analysisRes.data?.score_breakdown);
const score: ScoreResult | null = scoreParseResult.success ? scoreParseResult.data : null;
```

**Return** — extend `DocumentProgressView` call:
```typescript
// MODIFIED: add score prop
return <DocumentProgressView documentId={documentId} explanation={explanation} pdfUrl={pdfUrl} score={score} />;
```

---

### `src/components/doc/score-card.tsx` (component, event-driven) — NEW

**Analog:** `src/components/doc/explanation-panel.tsx`

**"use client" + import pattern** (lines 1-11):
```typescript
// ANALOG: src/components/doc/explanation-panel.tsx lines 1-8
"use client";

import { Fragment } from "react";
import { parseCitations } from "@/lib/citations/parse-citations";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
import { cn } from "@/lib/utils";
import { CitationInline } from "./citation-inline";

// SCORE VERSION imports:
"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { ScoreResult } from "@/lib/explain/score-schema";
import { CitationInline } from "./citation-inline";
```

**Props interface pattern** (lines 77-83):
```typescript
// ANALOG: src/components/doc/explanation-panel.tsx lines 77-83
export function ExplanationPanel(props: {
  documentId: string;
  explanation: ExplanationResult;
  onGoToPage: (page: number) => void;
  className?: string;
})

// SCORE VERSION:
export function ScoreCard(props: {
  documentId: string;
  score: ScoreResult;
  onGoToPage: (page: number) => void;
  className?: string;
})
```

**CitationInline reuse pattern** (lines 101-110):
```typescript
// ANALOG: src/components/doc/explanation-panel.tsx lines 101-110
<CitationInline
  key={`${sectionKey}.cite.${idx}`}
  page={tok.page}
  docId={documentId}
  onGoToPage={onGoToPage}
/>

// SCORE VERSION — inside AccordionContent per snippet:
{dim.snippets.map((snip, i) => (
  <div key={i} className="border-l-2 border-muted pl-3 py-1 my-1 bg-muted/40">
    <span className="text-sm italic text-foreground">{snip.text} </span>
    <CitationInline page={snip.page} docId={documentId} onGoToPage={onGoToPage} />
  </div>
))}
```

**shadcn Accordion pattern** (from RESEARCH.md §Pattern 5):
```typescript
<Accordion type="single" collapsible>
  {score.dimensions.map((dim) => (
    <AccordionItem key={dim.name} value={dim.name}>
      <AccordionTrigger>
        {/* flex row: name + reasoning + [N/10] chip */}
      </AccordionTrigger>
      <AccordionContent>
        {/* snippets with CitationInline */}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

**Score number + disclaimer block** (D-08):
```typescript
// Score header — large number, disclaimer directly beneath in text-muted-foreground text-sm
<div className="flex flex-col items-center gap-1">
  <span className="text-5xl font-bold text-emerald-600">{score.overall_score}</span>
  <span className="text-muted-foreground text-sm">AI Assessment · not financial advice</span>
</div>
```

---

### `src/components/doc/score-loading-skeleton.tsx` (component) — NEW

**Analog:** `src/components/doc/pdf-loading-skeleton.tsx`

**Full file to mirror** (lines 1-16):
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

// SCORE VERSION — same skeleton structure, different aria-label and block sizes:
"use client";

export function ScoreLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading AI Assessment…"
      aria-busy="true"
      className="flex flex-col gap-3 p-4"
    >
      {/* Score number placeholder */}
      <div className="mx-auto h-12 w-16 animate-pulse rounded-md bg-muted" />
      {/* 4 dimension row placeholders */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-10 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
```

---

### `src/components/doc/explanation-panel.tsx` (component) — MODIFIED

**Analog:** itself

**Current props** (lines 77-83):
```typescript
export function ExplanationPanel(props: {
  documentId: string;
  explanation: ExplanationResult;
  onGoToPage: (page: number) => void;
  className?: string;
})
```

**Extended props — add score**:
```typescript
// MODIFIED: add score prop (nullable, per D-06/D-07)
export function ExplanationPanel(props: {
  documentId: string;
  explanation: ExplanationResult;
  score: ScoreResult | null;          // NEW
  onGoToPage: (page: number) => void;
  className?: string;
})
```

**Score card insertion point** — before `SECTION_ORDER.map(...)` in the `<article>` (line 90):
```typescript
// ANALOG: src/components/doc/explanation-panel.tsx lines 85-90
return (
  <article className={cn("flex flex-col gap-12 px-6 py-8", className)} ...>
    {SECTION_ORDER.map((sectionKey) => { ... })}
  </article>
);

// MODIFIED: prepend ScoreCard (or skeleton/unavailable) before SECTION_ORDER:
return (
  <article className={cn("flex flex-col gap-12 px-6 py-8", className)} ...>
    {score ? (
      <ScoreCard documentId={documentId} score={score} onGoToPage={onGoToPage} />
    ) : (
      <div className="text-muted-foreground text-sm">AI Assessment unavailable</div>
    )}
    {SECTION_ORDER.map((sectionKey) => { /* unchanged */ })}
  </article>
);
```

---

### `src/components/doc/document-reader-layout.tsx` (component) — MODIFIED

**Analog:** itself

**Current DesktopSplitPane props** (lines 26-31):
```typescript
function DesktopSplitPane(props: {
  documentId: string;
  explanation: ExplanationResult;
  pdfUrl: string | null;
  pdfRef: React.RefObject<PdfViewerHandle | null>;
})
```

**Extended — add score prop, forward to ExplanationPanel** (lines 57-63):
```typescript
// ANALOG: src/components/doc/document-reader-layout.tsx lines 57-63
<ExplanationPanel
  documentId={documentId}
  explanation={explanation}
  onGoToPage={handleGoToPage}
/>

// MODIFIED:
<ExplanationPanel
  documentId={documentId}
  explanation={explanation}
  score={score}        // NEW
  onGoToPage={handleGoToPage}
/>
```

**Current DocumentReaderLayout props** (lines 76-80):
```typescript
export function DocumentReaderLayout(props: {
  documentId: string;
  explanation: ExplanationResult | null;
  pdfUrl: string | null;
})
```

**Extended — add score prop**:
```typescript
export function DocumentReaderLayout(props: {
  documentId: string;
  explanation: ExplanationResult | null;
  pdfUrl: string | null;
  score: ScoreResult | null;   // NEW
})
```

The `if (!explanation) return <fallback />` guard at line 84 does NOT need to change — `score: null` is a valid rendered state.

---

### `src/components/doc/document-progress-view.tsx` (component) — MODIFIED

**Analog:** itself

**Current props** (lines 18-22):
```typescript
export function DocumentProgressView(props: {
  documentId: string;
  explanation: ExplanationResult | null;
  pdfUrl: string | null;
})
```

**Extended — add score prop**:
```typescript
export function DocumentProgressView(props: {
  documentId: string;
  explanation: ExplanationResult | null;
  pdfUrl: string | null;
  score: ScoreResult | null;   // NEW
})
```

**Current DocumentReaderLayout call** (line 47):
```typescript
// ANALOG: src/components/doc/document-progress-view.tsx line 47
return (
  <DocumentReaderLayout documentId={documentId} explanation={explanation} pdfUrl={pdfUrl} />
);

// MODIFIED: thread score prop
return (
  <DocumentReaderLayout documentId={documentId} explanation={explanation} pdfUrl={pdfUrl} score={score} />
);
```

---

## Shared Patterns

### @google/genai Structured Output
**Source:** `src/lib/explain/generate-explanation.ts`
**Apply to:** `generate-score.ts`
```typescript
// Pattern: responseMimeType + responseSchema + stream accumulation + Zod parse
// Lines 172-199 in generate-explanation.ts
const stream = await ai.models.generateContentStream({
  model: MODEL_ID,
  contents: [createPartFromUri(uri, mimeType), { text: prompt }],
  config: {
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
    // score adds: thinkingConfig: { thinkingBudget: 0 }
  },
});
let accumulated = "";
for await (const chunk of stream) {
  accumulated += (chunk as { text?: string }).text ?? "";
}
if (!accumulated) throw new Error("Empty Gemini response (no chunks accumulated).");
const stripped = accumulated.trim()
  .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
const parsed = JSON.parse(stripped) as unknown;
const result = schema.parse(parsed);  // Zod throws ZodError on invalid shape
```

### Dual Zod + Raw JSON Schema
**Source:** `src/lib/explain/explanation-schema.ts`
**Apply to:** `score-schema.ts`
```typescript
// Pattern: parallel Zod schema + raw JSON Schema object in one file; both must stay in sync
// Lines 7-32 in explanation-schema.ts
export const explanationSchema = z.object({ /* fields */ });
export type ExplanationResult = z.infer<typeof explanationSchema>;
export const EXPLANATION_RESPONSE_SCHEMA = { type: "object", properties: { /* ... */ }, required: [ /* ... */ ] } as const;
```

### Cache Gate + Upsert on doc_id
**Source:** `src/lib/ingest/analyze-document-batch.ts`
**Apply to:** score generation block in `analyze-document-batch.ts`
```typescript
// Pattern: maybeSingle() check → non-null means skip; upsert with { onConflict: "doc_id" }
// Lines 98-107 (cache check), lines 160-174 (upsert)
const cacheRes = await supabaseAdmin.from("document_analysis").select("field").eq("doc_id", docId).maybeSingle();
if (!cacheRes.error && cacheRes.data?.field != null) { /* skip */ }
// ...
await supabaseAdmin.from("document_analysis").upsert(
  { doc_id: docId, ...fields },
  { onConflict: "doc_id" },
);
```

### RSC safeParse Pattern
**Source:** `src/app/doc/[documentId]/page.tsx`
**Apply to:** `score_breakdown` fetch in `page.tsx`
```typescript
// Pattern: lines 18-22 in page.tsx
if (analysisRes.data?.field) {
  const parsed = schema.safeParse(analysisRes.data.field);
  if (parsed.success) { typedVar = parsed.data; }
}
// Score version: const score: ScoreResult | null = scoreSchema.safeParse(data?.score_breakdown).success ? ... : null
```

### animate-pulse Skeleton
**Source:** `src/components/doc/pdf-loading-skeleton.tsx`
**Apply to:** `score-loading-skeleton.tsx`
```typescript
// Pattern: lines 1-16 in pdf-loading-skeleton.tsx
<div role="status" aria-label="Loading…" aria-busy="true" className="flex flex-col gap-3 p-4">
  {[0, 1, 2].map((i) => <div key={i} className="h-48 w-full animate-pulse rounded-md bg-muted" />)}
</div>
```

### Prop Threading (nullable optional data through component chain)
**Source:** `src/components/doc/document-progress-view.tsx` → `document-reader-layout.tsx` → `explanation-panel.tsx`
**Apply to:** All 4 prop threading files for `score: ScoreResult | null`
```typescript
// Pattern: ExplanationResult | null passed through same chain for explanation prop
// Always use `prop: Type | null` (not `prop?: Type`) for explicit null semantics (D-11 note in RESEARCH.md)
```

### Server-Only + GoogleGenAI Init
**Source:** `src/lib/explain/generate-explanation.ts`
**Apply to:** `generate-score.ts`
```typescript
// Lines 1-5 in generate-explanation.ts
import "server-only";
import { createPartFromUri, GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";
// ...
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
```

### Vitest Mock Pattern for @google/genai
**Source:** `src/lib/explain/__tests__/generate-explanation.test.ts`
**Apply to:** `src/lib/explain/__tests__/generate-score.test.ts`
```typescript
// Lines 7-34 in generate-explanation.test.ts
const { generateContentStream, filesGet, filesUpload, createPartFromUri } = vi.hoisted(() => ({ ... }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    files: { get: filesGet, upload: filesUpload },
    models: { generateContentStream },
  })),
  createPartFromUri,
}));
vi.mock("@/lib/env", () => ({ env: { GEMINI_API_KEY: "test-key" } }));
vi.mock("server-only", () => ({}));
async function* makeStream(text: string): AsyncGenerator<{ text: string }> { yield { text }; }
```

---

## Files With No Analog (Partial — Uses RESEARCH.md Patterns)

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/ui/accordion.tsx` | ui-primitive | event-driven | Generated by `npx shadcn add accordion` — not hand-authored; follow shadcn New York style preset already in project |

---

## Prop Threading Sequence (Bottom-Up)

The planner must modify components in this order to avoid cascading TypeScript errors (Pitfall 3 from RESEARCH.md):

1. `src/lib/explain/score-schema.ts` — define `ScoreResult` type first
2. `src/components/doc/score-card.tsx` — leaf component, consumes `ScoreResult`
3. `src/components/doc/score-loading-skeleton.tsx` — leaf component, no props
4. `src/components/doc/explanation-panel.tsx` — add `score: ScoreResult | null` prop
5. `src/components/doc/document-reader-layout.tsx` — add `score` to `DesktopSplitPane` (internal) and `DocumentReaderLayout` (exported)
6. `src/components/doc/mobile-tab-view.tsx` — add `score` prop, pass to `ExplanationPanel`
7. `src/components/doc/document-progress-view.tsx` — add `score` prop, pass to `DocumentReaderLayout`
8. `src/app/doc/[documentId]/page.tsx` — RSC: extend select, safeParse, pass to `DocumentProgressView`

---

## Metadata

**Analog search scope:** `src/lib/explain/`, `src/lib/ingest/`, `src/components/doc/`, `src/app/doc/`, `src/app/api/internal/analyze-batch/`
**Files scanned:** 15
**Pattern extraction date:** 2026-05-19
