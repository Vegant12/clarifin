# Phase 6: AI Explanation Generation - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/explain/explanation-schema.ts` | utility (schema) | transform | `src/lib/eval/schema.ts` | exact |
| `src/lib/explain/explain-prompts.ts` | utility (constants) | transform | `src/lib/eval/prompts.ts` | exact |
| `src/lib/explain/generate-explanation.ts` | service | request-response | `src/lib/eval/gemini-eval-extract.ts` | exact |
| `src/lib/ingest/analyze-document-batch.ts` | service | request-response | `src/lib/ingest/embed-document-batch.ts` | exact |
| `src/app/api/internal/analyze-batch/route.ts` | controller | request-response | `src/app/api/internal/embed-batch/route.ts` | exact |
| `supabase/migrations/YYYYMMDD_explain_jsonb.sql` | migration | CRUD | `supabase/migrations/20260506120000_document_parsing_cursor.sql` | role-match |
| `vercel.json` | config | — | existing `vercel.json` | exact |
| `src/app/api/status/route.ts` (update) | controller | request-response | self (current file) | self |
| `src/app/doc/[documentId]/page.tsx` (update) | component | request-response | `src/components/doc/document-progress-view.tsx` | role-match |

---

## Pattern Assignments

### `src/lib/explain/explanation-schema.ts` (utility, transform)

**Analog:** `src/lib/eval/schema.ts`

**Imports pattern** (lines 1–2):
```typescript
import { z } from "zod";
```

**Core Zod schema pattern** (lines 3–21 of analog):
```typescript
// Pattern: named z.object() export + z.infer<> type alias
export const extractionResultSchema = z.object({
  numericExtractions: z.array(
    z.object({
      key: z.string().min(1),
      valueIDR: z.number().finite(),
      sourcePage: z.number().int().positive().optional(),
    }),
  ),
  // ...
});

export type EvalExtraction = z.infer<typeof extractionResultSchema>;
```

**Adaptation for Phase 6:** Replace the eval schema with a flat 5-key object. Also export the raw JSON Schema object for Gemini `responseSchema` config (Gemini does not accept Zod — it requires a plain JSON Schema object):
```typescript
export const explanationSchema = z.object({
  revenue: z.string().min(1),
  profitability: z.string().min(1),
  balance_sheet: z.string().min(1),
  cash_flow: z.string().min(1),
  key_risks: z.string().min(1),
});

export type ExplanationResult = z.infer<typeof explanationSchema>;

// Raw JSON Schema for Gemini responseSchema config
export const EXPLANATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    revenue: { type: "string" },
    profitability: { type: "string" },
    balance_sheet: { type: "string" },
    cash_flow: { type: "string" },
    key_risks: { type: "string" },
  },
  required: ["revenue", "profitability", "balance_sheet", "cash_flow", "key_risks"],
} as const;
```

**No `server-only`** on this file — it is pure schema/types with no env access; safe to import in tests without `"server-only"`.

---

### `src/lib/explain/explain-prompts.ts` (utility, transform)

**Analog:** `src/lib/eval/prompts.ts`

**Full analog** (`src/lib/eval/prompts.ts` lines 1–27):
```typescript
// Pattern: named string constants + model ID constant
export const EVAL_MODEL_ID = "gemini-2.5-flash" as const;

export const PROMPT_EVAL_BASE = `You are validating an Indonesian-listed company financial PDF...
Reply with ONLY valid JSON (no markdown fences) shaped EXACTLY as: ...
Rules: ...`;
```

**Adaptation for Phase 6:**
- Export `EXPLANATION_MODEL_ID = "gemini-2.5-flash" as const` — same model constant pattern as `EVAL_MODEL_ID`
- Export `PSAK_GLOSSARY` as a `const` string (the full term list from RESEARCH.md)
- Export `buildExplanationPrompt(totalPages: number, isIndonesian: boolean): string` — a builder function (unlike the static eval prompt, Phase 6 needs `totalPages` interpolated for citation-bounding, per Pitfall 3 in RESEARCH.md)
- No `server-only` — pure strings/functions, safe in tests; the calling service (`generate-explanation.ts`) carries `server-only`

**Key prompt rules to embed (all mandatory per decisions):**
- DISCLAIM-02 no-recommendation clause: "Do NOT make buy/sell recommendations. Frame ALL output as explanation and analysis only."
- `[p.N]` citation instruction with explicit upper bound: "The document has N total pages; every [p.N] must reference a page in that range."
- Grade-9 reading level: "Write for a smart adult who does NOT understand accounting."
- Jargon rule: "If you quote a Bahasa Indonesia financial term, immediately follow it with its English translation in parentheses."
- PSAK glossary block injected when `isIndonesian === true`

---

### `src/lib/explain/generate-explanation.ts` (service, request-response)

**Analog:** `src/lib/eval/gemini-eval-extract.ts`

**Imports pattern** (lines 1–9 of analog):
```typescript
import { createPartFromUri, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
import { parseEvalExtractionResponse } from "@/lib/eval/load-manifest";
import { EVAL_MODEL_ID, PROMPT_EVAL_BASE, PROMPT_EVAL_BROKEN } from "@/lib/eval/prompts";
import type { EvalExtraction } from "@/lib/eval/schema";
import { clonePdfBytes } from "@/lib/pdf/clone-pdf-bytes";
```

**`waitForFileReady` pattern** (lines 12–28 of analog — copy verbatim, or import from `gemini-pdf-pages.ts` which has the authoritative version):
```typescript
// src/lib/pdf/gemini-pdf-pages.ts lines 31–47
async function waitForFileReady(
  ai: GoogleGenAI,
  name: string,
): Promise<{ uri: string; mimeType: string }> {
  let file = await ai.files.get({ name });
  while (file.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 1500));
    file = await ai.files.get({ name });
  }
  if (file.state === "FAILED") {
    throw new Error("Gemini file processing failed.");
  }
  if (!file.uri) {
    throw new Error("Gemini file has no URI.");
  }
  return { uri: file.uri, mimeType: file.mimeType ?? "application/pdf" };
}
```

**File resource reuse pattern** (lines 61–85 of `gemini-pdf-pages.ts`):
```typescript
// Reuse cached resource name if present; re-upload from Supabase Storage otherwise
if (params.fileResourceName) {
  resourceName = params.fileResourceName;
  const ready = await waitForFileReady(ai, resourceName);
  uri = ready.uri;
  mimeType = ready.mimeType;
} else {
  // Download bytes from Supabase Storage, upload to Files API
  const bytes = clonePdfBytes(params.pdfBytes);
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: "application/pdf" });
  const uploaded = await ai.files.upload({
    file: blob,
    config: { mimeType: "application/pdf", displayName: params.filename },
  });
  if (!uploaded.name) throw new Error("Gemini file upload returned no name.");
  resourceName = uploaded.name;
  const ready = await waitForFileReady(ai, resourceName);
  uri = ready.uri;
  mimeType = ready.mimeType;
}
```

**`generateContent` + `responseSchema` pattern** (lines 75–111 of analog). For Phase 6, switch to `generateContentStream` and accumulate:
```typescript
// src/lib/eval/gemini-eval-extract.ts lines 75–111 — but use streaming variant
const stream = await ai.models.generateContentStream({
  model: EXPLANATION_MODEL_ID,
  contents: [
    createPartFromUri(uri, mimeType),
    { text: buildExplanationPrompt(totalPages, isIndonesian) },
  ],
  config: {
    responseMimeType: "application/json",
    responseSchema: EXPLANATION_RESPONSE_SCHEMA,
  },
});

let accumulated = "";
for await (const chunk of stream) {
  accumulated += chunk.text ?? "";
}
// Chunks are valid partial JSON — accumulate then parse once
const result = explanationSchema.parse(JSON.parse(accumulated));
```

**Language detection pattern** — pure string heuristic (no library), inline in this file or in a small helper. Check `extraction_source` and first-page text stopwords per RESEARCH.md section 2:
```typescript
const ID_STOPWORDS = ["dan", "yang", "dalam", "untuk", "dengan", "laporan", "tahun"];
function isIndonesianDoc(extractionSource: string | null, firstPageText: string): boolean {
  // Gemini OCR path: extraction_source may be null during parse; default to injecting glossary
  if (!extractionSource || extractionSource === "gemini_files") return true;
  const sample = firstPageText.slice(0, 200).toLowerCase();
  const hits = ID_STOPWORDS.filter((w) => sample.includes(w));
  return hits.length >= 5;
}
```

**`server-only` guard** — add `import "server-only"` at line 1 (matches pattern of `gemini-embed.ts` line 1, `embed-document-batch.ts` line 1).

**Supabase Storage download** — the analog for re-uploading a PDF already stored in Supabase appears in `parse-document-batch.ts` lines 69–76:
```typescript
const download = await supabaseAdmin.storage.from("pdfs").download(doc.storage_path);
if (download.error || !download.data) {
  // handle error
}
const pdfMaster = new Uint8Array(await download.data.arrayBuffer());
```
Note: the bucket name in the parse phase is `"pdfs"` — verify the bucket name used for PDFs before writing the analyze code. Check `src/app/api/upload-init/route.ts` if needed.

---

### `src/lib/ingest/analyze-document-batch.ts` (service, request-response)

**Analog:** `src/lib/ingest/embed-document-batch.ts` (entire file — mirror this exactly)

**File header / server guard** (lines 1–6 of analog):
```typescript
import "server-only";

import { supabaseAdmin } from "@/db/client";
import { embedTextBatch, vectorToPgString } from "@/lib/embed/gemini-embed";

export const MAX_EMBED_BATCH_WALL_MS = 52_000;
```
Adaptation: replace the embed imports with explain imports; replace the wall-clock constant with a reasonable ceiling (300s is the Vercel Fluid Compute max, but a local deadline guard is still useful for safety).

**Error message helper pattern** (lines 12–19 of analog):
```typescript
function embedFailureUserMessage(err: unknown): string {
  const dev = process.env.NODE_ENV === "development";
  if (dev && err instanceof Error && err.message) {
    const m = err.message.trim();
    return m.length > 400 ? `Embedding failed: ${m.slice(0, 400)}…` : `Embedding failed: ${m}`;
  }
  return "Embedding failed. Try uploading again.";
}
```
Adaptation: replace "Embedding" with "Analysis" in messages.

**`failDocument*` helper pattern** (lines 21–30 of analog):
```typescript
async function failDocumentEmbed(docId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("documents")
    .update({
      status: "failed",
      error_message: message,
      failed_at: new Date().toISOString(),
    })
    .eq("id", docId);
}
```
Adaptation: create `failDocumentAnalyze`. Per Pitfall 5 in RESEARCH.md, a 429 from Gemini should NOT set `status: "failed"` — it should leave the doc in `"analyzing"` so the cron retries. A permanent error (bad API key, exhausted retries) sets `"failed"`.

**Status gate pattern** (lines 56–59 of analog):
```typescript
if (docRes.data.status !== "embedding") {
  return { done: true };
}
```
Adaptation: gate on `"analyzing"` status; return early if already `"ready"` (cache hit — EXPLAIN-04).

**Cache check pattern** — not in embed analog, but required per D-09. Add before the Gemini call:
```typescript
const analysisRes = await supabaseAdmin
  .from("document_analysis")
  .select("explanation")
  .eq("doc_id", docId)
  .maybeSingle();
if (analysisRes.data?.explanation != null) {
  // Explanation already cached — ensure status is ready and return
  await supabaseAdmin.from("documents").update({ status: "ready" }).eq("id", docId);
  return { done: true };
}
```

**`document_analysis` upsert pattern** (from RESEARCH.md Pattern 4):
```typescript
await supabaseAdmin
  .from("document_analysis")
  .upsert(
    {
      doc_id: docId,
      explanation: result,            // plain object if column is jsonb after migration
      explanation_at: new Date().toISOString(),
    },
    { onConflict: "doc_id" },
  );
```

**Status transition on success** (lines 79, 125 of analog — transition to next pipeline status):
```typescript
await supabaseAdmin.from("documents").update({ status: "analyzing" }).eq("id", docId);
```
Adaptation: transition `analyzing → ready` on success.

**Return shape** — `{ done: boolean }` (same as embed, matches route handler expectation).

---

### `src/app/api/internal/analyze-batch/route.ts` (controller, request-response)

**Analog:** `src/app/api/internal/embed-batch/route.ts` (copy verbatim, change names)

**Full route structure** (lines 1–94 of analog — copy entirely):

**Imports** (lines 1–9):
```typescript
import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { env } from "@/lib/env";
import { runEmbedBatch } from "@/lib/ingest/embed-document-batch";
import { scheduleEmbedBatchesForDoc } from "@/lib/ingest/trigger-parse-batch";
```
Adaptation: change `runEmbedBatch` to `runAnalyzeBatch` from `analyze-document-batch.ts`; remove the `scheduleEmbedBatchesForDoc` import (analyze does not chain to another batch via `after()` — see RESEARCH.md Open Question 1).

**Auth helpers** (lines 16–35 — copy verbatim, `timingSafeStringEq` + `extractBearer`):
```typescript
function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  const len = Math.max(ba.length, bb.length);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  ba.copy(padA);
  bb.copy(padB);
  return timingSafeEqual(padA, padB) && ba.length === bb.length;
}

function extractBearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}
```

**Body schema** (lines 37–39 — copy verbatim):
```typescript
const bodySchema = z.object({
  doc_id: z.string().uuid().optional(),
});
```

**Document picker** — change status filter from `"embedding"` to `"analyzing"` (line 72 of analog):
```typescript
const pick = await supabaseAdmin
  .from("documents")
  .select("id")
  .eq("status", "analyzing")          // was "embedding"
  .order("updated_at", { ascending: true })
  .limit(1)
  .maybeSingle();
```

**`maxDuration` export** — per RESEARCH.md Pattern 3 and D-14 resolution:
```typescript
export const maxDuration = 300;
```
This must be added at the top of the route file (module-level export). Neither embed-batch nor parse-batch currently exports this — add it explicitly for the analyze route.

**GET/POST exports** (lines 88–94 of analog — copy verbatim):
```typescript
export function GET(request: Request): Promise<Response> {
  return handleAnalyzeBatch(request);
}

export function POST(request: Request): Promise<Response> {
  return handleAnalyzeBatch(request);
}
```

---

### `supabase/migrations/YYYYMMDD_explain_jsonb.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260506120000_document_parsing_cursor.sql`

**Migration header comment pattern** (lines 1–4 of analog):
```sql
-- Phase 3: resumable parsing cursor and extraction routing (INGEST-03)
-- parse_next_page: 1-based next page to process in batch runs
-- extraction_source: unpdf vs gemini_files OCR path
-- gemini_file_resource_name: Files API resource name for TTL cleanup
```
Adaptation: write a Phase 6 header describing the `jsonb` type change.

**`ALTER TABLE` pattern** (lines 6–9 of analog):
```sql
alter table public.documents
  add column if not exists parse_next_page integer not null default 1;
```
Adaptation: use `ALTER COLUMN ... TYPE` instead of `ADD COLUMN`:
```sql
-- Safe: explanation column is NULL for all existing rows (no data to convert)
ALTER TABLE document_analysis
  ALTER COLUMN explanation TYPE jsonb USING explanation::jsonb;
```

**Naming convention:** timestamp-prefixed `YYYYMMDD_explain_jsonb.sql`. Follow the existing pattern: `20260503000000_init.sql`, `20260506120000_...`, `20260508120000_...`. Use today's date: `20260517120000_explain_jsonb.sql`.

**After migration:** `database.types.ts` must be updated — `explanation: string | null` becomes `explanation: Json | null` (the `Json` type is already defined at line 1 of `database.types.ts`).

---

### `vercel.json` (config)

**Analog:** existing `vercel.json` (the file itself — extend the `crons` array)

**Current structure** (full file):
```json
{
  "crons": [
    {
      "path": "/api/internal/parse-batch?secret=${INTERNAL_PARSE_SECRET}",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/internal/embed-batch?secret=${INTERNAL_PARSE_SECRET}",
      "schedule": "* * * * *"
    }
  ]
}
```

**Adaptation:** add a third cron entry following the exact same pattern:
```json
{
  "path": "/api/internal/analyze-batch?secret=${INTERNAL_PARSE_SECRET}",
  "schedule": "* * * * *"
}
```
Schedule is `* * * * *` (every minute) — same as parse and embed, satisfying the ≤60s trigger requirement from D-11. Note: Vercel Hobby allows 2 free cron jobs; adding a third requires upgrade. **The planner must address this constraint** — options include: combining the analyze trigger with one of the existing cron paths (e.g., embed-batch chains to analyze on completion), or noting Vercel's 2-cron limit and deciding whether to combine jobs.

---

### `src/app/api/status/route.ts` (controller update, request-response)

**Analog:** self — the current file at `src/app/api/status/route.ts`

**Current response shape** (lines 105–109):
```typescript
return NextResponse.json({
  status: row.status,
  updated_at: row.updated_at,
  error_message: row.error_message,
});
```

**Phase 6 update:** The RESEARCH.md Open Question 2 recommends keeping the status route lightweight (status only) and adding a separate `/api/doc/[id]` endpoint for the full `document_analysis` row. If the planner agrees with this recommendation, Phase 6 changes to this file are minimal: only add the `"analyzing" → ready` stub handling in `STUB_PIPELINE_TICK` (lines 78–103) to mirror the existing `"embedding" → "analyzing"` stub at lines 92–102:
```typescript
// Add after the existing "embedding" → "analyzing" stub block (lines 92–102):
} else if (stale && row.status === "analyzing") {
  await supabaseAdmin.from("documents").update({ status: "ready" }).eq("id", doc_id);
  docQuery = await supabaseAdmin
    .from("documents")
    .select("status, updated_at, error_message")
    .eq("id", doc_id)
    .single();
  if (!docQuery.error && docQuery.data) {
    row = docQuery.data;
  }
}
```
This unblocks the local dev stub pipeline for testing Phase 6 UI without a real Gemini call.

**Existing query pattern to extend** (lines 65–74 — Supabase select with session guard):
```typescript
let docQuery = await supabaseAdmin
  .from("documents")
  .select("status, updated_at, error_message")
  .eq("id", doc_id)
  .eq("session_id", sessionRes.data.id)
  .maybeSingle();
```
If the planner decides to include `explanation` in the status response (contra the RESEARCH.md recommendation), extend the `select` string: `.select("status, updated_at, error_message, document_analysis(explanation)")` and join via Supabase's implicit FK join syntax.

---

### `src/app/doc/[documentId]/page.tsx` (component update, request-response)

**Analog:** `src/components/doc/document-progress-view.tsx` (primary) and `src/app/doc/[documentId]/page.tsx` (current, minimal wrapper)

**Current page.tsx pattern** (all 7 lines):
```typescript
import { DocumentProgressView } from "@/components/doc/document-progress-view";

export default async function DocumentPage(props: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await props.params;
  return <DocumentProgressView documentId={documentId} />;
}
```
This is a server component that delegates entirely to a client component. Phase 6 needs to add an explanation render path when `status === "ready"`.

**Component conditional render pattern** from `document-progress-view.tsx` (lines 104–107):
```typescript
{data?.status === "ready" ? (
  <p className="text-muted-foreground text-sm">
    This stage is wired for later phases — your PDF is queued for analysis.
  </p>
) : null}
```
**Adaptation for Phase 6:** replace the placeholder text with a new `<ExplanationView>` component (or inline JSX) that renders the 5-section explanation from `document_analysis`. The explanation data must be fetched when `status === "ready"` — either via a new `/api/doc/[id]` route or by extending the status hook.

**shadcn/ui component pattern** (lines 7–14 of `document-progress-view.tsx`):
```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
```
All three shadcn primitives are available. Use `Card` + `CardContent` for each explanation section. New section components live in `src/components/doc/`.

**`useDocumentStatus` hook pattern** (lines 32–36 of `document-progress-view.tsx`):
```typescript
const { data, error } = useDocumentStatus({
  docId: documentId,
  sessionToken,
  enabled: mounted && hasToken && isSessionReady && docIdValid,
});
```
The hook currently stops polling on `"ready"` (line 108 of `use-document-status.ts`). Phase 6 must fetch the explanation *after* the hook resolves to `"ready"`. Recommended pattern: add a second `useEffect` that fires a `fetch("/api/doc/[id]")` when `data?.status === "ready"` and stores the result in local state.

---

## Shared Patterns

### `server-only` Boundary
**Source:** `src/lib/ingest/embed-document-batch.ts` line 1, `src/lib/embed/gemini-embed.ts` line 1, `src/db/client.ts` line 1
**Apply to:** `src/lib/explain/generate-explanation.ts`, `src/lib/ingest/analyze-document-batch.ts`
**Do NOT apply to:** `src/lib/explain/explanation-schema.ts`, `src/lib/explain/explain-prompts.ts` (pure functions/strings, no env access — omitting `server-only` allows them to be imported in Vitest tests without mock setup)
```typescript
import "server-only";
```

### `supabaseAdmin` for All Server Writes
**Source:** `src/db/client.ts` (full file) — service-role client, bypasses RLS
**Apply to:** `src/lib/ingest/analyze-document-batch.ts`, `src/app/api/internal/analyze-batch/route.ts`
```typescript
import { supabaseAdmin } from "@/db/client";
```

### `timingSafeStringEq` Auth Guard
**Source:** `src/app/api/internal/embed-batch/route.ts` lines 16–35
**Apply to:** `src/app/api/internal/analyze-batch/route.ts` (copy verbatim — do not hand-roll)
```typescript
function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  const len = Math.max(ba.length, bb.length);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  ba.copy(padA);
  bb.copy(padB);
  return timingSafeEqual(padA, padB) && ba.length === bb.length;
}
```

### `GoogleGenAI` Instantiation
**Source:** `src/lib/eval/gemini-eval-extract.ts` line 53, `src/lib/pdf/gemini-pdf-pages.ts` line 56
**Apply to:** `src/lib/explain/generate-explanation.ts`
```typescript
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
```

### Status Update Pattern (Supabase)
**Source:** `src/lib/ingest/embed-document-batch.ts` lines 24–30, 79, 125
**Apply to:** `src/lib/ingest/analyze-document-batch.ts`
```typescript
// Success: transition to next status
await supabaseAdmin.from("documents").update({ status: "ready" }).eq("id", docId);

// Failure: set failed + message + timestamp
await supabaseAdmin
  .from("documents")
  .update({
    status: "failed",
    error_message: message,
    failed_at: new Date().toISOString(),
  })
  .eq("id", docId);
```

### Path Alias Imports
**Source:** all existing files — consistently use `@/` alias, not relative paths
**Apply to:** all Phase 6 files
```typescript
import { supabaseAdmin } from "@/db/client";
import { env } from "@/lib/env";
```

### `env` Module for Secrets
**Source:** `src/lib/env.ts` — centralized env validation
**Apply to:** `src/lib/explain/generate-explanation.ts` (for `GEMINI_API_KEY`)
```typescript
import { env } from "@/lib/env";
// Access via: env.GEMINI_API_KEY, env.INTERNAL_PARSE_SECRET
```

---

## No Analog Found

No files are without an analog. All Phase 6 files have a direct or role-match equivalent in the codebase.

---

## Critical Notes for Planner

1. **Vercel Cron 2-job limit on Hobby:** The current `vercel.json` already uses both free cron slots (`parse-batch` and `embed-batch`). Adding `analyze-batch` as a third cron requires either upgrading to Vercel Pro or triggering analyze via `after()` chained from the embed-batch route (which sets `status: "analyzing"` at line 79 and 125 of `embed-document-batch.ts`). The planner must decide this. The `scheduleEmbedBatchesForDoc` in `trigger-parse-batch.ts` is the existing `after()` pattern for chaining.

2. **Bucket name:** Parse phase uses `supabaseAdmin.storage.from("pdfs")` (line 69 of `parse-document-batch.ts`). The analyze route re-downloading a PDF for Gemini re-upload must use the same bucket name.

3. **`database.types.ts` update after migration:** After applying the `explanation jsonb` migration, `database.types.ts` line 135 changes from `explanation: string | null` to `explanation: Json | null`. The `Json` type is already defined at lines 1–6 of that file.

4. **`maxDuration = 300` export:** Neither `embed-batch/route.ts` nor `parse-batch/route.ts` exports `maxDuration`. The planner must add `export const maxDuration = 300;` to `analyze-batch/route.ts` as the explicit Fluid Compute ceiling declaration per RESEARCH.md Pattern 3.

5. **`after()` chain for analyze:** The RESEARCH.md Open Question 1 recommends NOT using `after()` chaining in `analyze-batch`. The single Gemini call is not chunked. If generation exceeds 300s (unlikely per assumptions), the status stays `"analyzing"` and the cron retries on next tick.

---

## Metadata

**Analog search scope:** `src/`, `supabase/migrations/`, `vercel.json`
**Files scanned:** 22 TypeScript files + 3 SQL migrations + 1 JSON config
**Pattern extraction date:** 2026-05-17
