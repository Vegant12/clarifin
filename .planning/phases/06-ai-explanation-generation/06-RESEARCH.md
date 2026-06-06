# Phase 6: AI Explanation Generation — Research

**Researched:** 2026-05-17
**Domain:** Gemini Files API + structured output + Next.js internal route pattern
**Confidence:** HIGH (all critical claims verified via docs/codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Explanation generation fires automatically after embedding completes via Vercel Cron + `/api/internal/analyze-batch`. Status flow: `uploaded → parsing → embedding → analyzing → ready`. `"analyzing"` already in `document_status` enum — no migration needed.
- **D-02:** Cron + internal route pattern mirrors existing `parse-batch` and `embed-batch` routes. Follow those patterns exactly.
- **D-03:** Cron polls for documents in `"embedding"` status that have completed embedding (all chunks embedded) and transitions them to `"analyzing"` before calling Gemini.
- **D-04:** Store explanation as structured JSON in `document_analysis.explanation` — five string-keyed sections: `revenue`, `profitability`, `balance_sheet`, `cash_flow`, `key_risks`. Each string contains inline `[p.N]` citations.
- **D-05:** Citations use inline `[p.N]` markers within prose text (e.g., "Revenue grew 18% `[p.12]` driven by…").
- **D-06:** Planner decides: add migration to change `explanation` column to `jsonb`, or stringify and store as `text`. Column is currently `text`.
- **D-07:** No separate pre-translation pass. Pass full PDF to Gemini 2.5 Flash natively.
- **D-08:** Inject PSAK/IFRS glossary into system prompt for every analysis call. Language detection from `extraction_source` field or first-page text sniff. Planner to implement detection.
- **D-09:** Explanation cached per-document in `document_analysis`. If `explanation` non-null for a `doc_id`, serve from cache — do not call Gemini again.
- **D-10:** `document_analysis` row created (or upserted) by the analyze-batch route.
- **D-11:** Streaming applies to first generation pass only. Analyze cron must start within ≤60s after embedding completes to meet 5s-first-section target. Cached content is served instantly.
- **D-12:** SDK choice left to planner. Codebase uses `@google/genai` natively. ROADMAP recommends Vercel AI SDK. Planner should evaluate whether native streaming is sufficient.
- **D-13:** Reuse stored `gemini_file_resource_name` if present and within 48h TTL. Re-upload from Supabase Storage if null or expired. Mirrors pattern in `extractPagesWithGemini`.
- **D-14:** Vercel Hobby function timeout is a known constraint. Planner must address via `maxDuration` export, incremental persistence, or accepted retry path.
- **D-15:** Every Gemini prompt hard-codes no-recommendation instructions per DISCLAIM-02.

### Claude's Discretion

- Exact Gemini model prompt structure (temperature, system vs user message split, `generateContent` with `responseSchema` vs free-form streaming)
- Whether to add a `jsonb` migration for `document_analysis.explanation` or keep as `text`
- Cron interval for the analyze cron (must be ≤60s to hit 5s-first-section target)
- PSAK glossary initial term list (50–100 terms from eval fixture documents)
- Error handling for Gemini quota exhaustion during analyze

### Deferred Ideas (OUT OF SCOPE)

- Vercel AI SDK `useChat` integration (Phase 10)
- Artificial streaming of cached explanation
- Per-section regeneration (v2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPLAIN-01 | 5-section plain-English explanation: Revenue, Profitability, Balance Sheet, Cash Flow, Key Risks | `responseSchema` with five string properties; model produces section prose in one call |
| EXPLAIN-02 | Every factual claim includes inline `[p.N]` citation | Prompt engineering: explicit `[p.N]` instruction; validated by eval harness at 92.6% |
| EXPLAIN-03 | Readable at Flesch-Kincaid grade 9 or lower | Prompt instruction: "write for a non-finance professional, no jargon without inline definition" |
| EXPLAIN-04 | Cached per-document; not regenerated on refresh | Cache check: `document_analysis.explanation IS NOT NULL` gate before any Gemini call |
| EXPLAIN-05 | Explanation streams progressively to UI | `generateContentStream` + `after()` trigger pattern; first chunk within ~1–3s of generation start |
| TRANSLATE-01 | Accurate Bahasa Indonesia source handling without pre-translation | Gemini 2.5 Flash native multilingual; validated by eval harness on ID-only docs (97.8% numeric) |
| TRANSLATE-02 | PSAK/IFRS glossary (50–100 terms) injected in every system prompt | Glossary block in system prompt; ~1–2K tokens at 100 terms — well within budget |
| DISCLAIM-02 | No-recommendation instruction hard-coded in every LLM prompt | Prompt constant includes "Do not make buy/sell recommendations. Frame all output as explanation and analysis." |
</phase_requirements>

---

## Summary

Phase 6 is the first user-visible AI output in Clarifin. The core mechanism is a Gemini Files API single-pass generation using `@google/genai` native SDK, mirroring the eval harness pattern already validated in Phase 5. The explanation is structured JSON (5 sections) produced via `responseSchema`, cached in `document_analysis`, and triggered automatically by a Vercel Cron + internal route after embedding completes.

The most important research findings: (1) Vercel Fluid Compute is now the default on the Hobby plan, giving the `analyze-batch` route up to 300 seconds — the previously documented "60s timeout problem" is resolved without any workaround code. (2) Gemini 2.5 Flash supports `responseSchema` with `generateContentStream`, where streamed chunks are valid partial JSON that concatenate to the final object. (3) The `explanation` column migration from `text` to `jsonb` is clean and recommended — `jsonb` is the standard Supabase type for structured JSON, the JS client accepts plain objects, and the migration is a one-line `ALTER TABLE`. (4) `p-limit` is not the correct concurrency mechanism for this phase; the Vercel Hobby plan processes one document at a time (cron picks the oldest `analyzing` doc), so concurrency is naturally capped. INFRA-03 formal cap belongs in Phase 11.

**Primary recommendation:** Use `@google/genai` natively (no Vercel AI SDK) with `generateContentStream` + `responseSchema`. Collect full JSON in a server-side accumulation loop, then upsert to `document_analysis`. The streaming behavior (EXPLAIN-05) is satisfied during the generation-to-storage pass; the UI polling mechanism detects `status: "ready"` and reads the cached explanation instantly.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trigger analyze after embedding | API Backend (cron route) | — | Mirrors parse-batch / embed-batch cron pattern; no browser involvement |
| Gemini Files API upload / reuse | API Backend | — | Server-only; API key must not reach browser |
| Explanation generation (LLM call) | API Backend | — | Server-only Gemini call; responseSchema structured output |
| Bahasa Indonesia handling / glossary | API Backend (prompt) | — | Injected at generation time; no client-side processing |
| Explanation cache read | API Backend → DB | Frontend (read) | Supabase `document_analysis`; doc page reads row on load |
| Status polling (analyzing → ready) | Frontend (polling) | API Backend | Existing `/api/status` route; frontend polls until `ready` |
| Serving cached explanation to UI | Frontend | — | Phase 7 renders `document_analysis.explanation` from cache |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | `^1.52.0` | Gemini Files API upload, `generateContentStream`, `responseSchema` | Already in `package.json`; validated in eval harness |
| `zod` | `^3.25.76` | Schema validation of explanation JSON response | Already in `package.json`; used throughout codebase |
| `@supabase/supabase-js` | `^2.105.1` | DB upsert to `document_analysis`; Supabase Storage download for re-upload | Already in stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | `^0.0.1` | Enforce server boundary on all explanation code | Use on every new `src/lib/explain/` file — existing codebase pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@google/genai` native | `@ai-sdk/google` (Vercel AI SDK) | Vercel AI SDK adds `streamText` convenience + provider-agnostic interface, but Phase 6 does not stream to a browser client — it streams internally and persists to DB. The `@google/genai` streaming API (`generateContentStream`) is sufficient. Vercel AI SDK entry point is Phase 10 (chat). |

**Installation:** No new dependencies required — all packages already in `package.json`. [VERIFIED: package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
[Vercel Cron: * * * * *]
        |
        v
POST /api/internal/analyze-batch?secret=...
        |
        | 1. Auth check (timingSafeEqual)
        | 2. Pick oldest doc with status = "analyzing"
        | 3. Cache check: document_analysis.explanation IS NOT NULL → skip (EXPLAIN-04)
        v
runAnalyzeBatch({ docId })
        |
        | 4. Check gemini_file_resource_name (D-13)
        |    - if present: waitForFileReady (may re-upload if FAILED)
        |    - if null: download PDF bytes from Supabase Storage, upload to Files API
        v
generateExplanation({ uri, mimeType, docId, extractionSource })
        |
        | 5. Detect language (extraction_source OR first-page text sniff)
        | 6. Build prompt: PROMPT_EXPLAIN_BASE + PSAK glossary block + no-rec instruction
        | 7. ai.models.generateContentStream({ responseSchema, responseMimeType: "application/json" })
        | 8. Accumulate chunks server-side → full JSON string
        v
Validate (Zod) → explanationSchema.parse(JSON.parse(accumulated))
        |
        v
supabaseAdmin.from("document_analysis").upsert({ doc_id, explanation: JSON.stringify(result), explanation_at })
        |
        v
supabaseAdmin.from("documents").update({ status: "ready" })
        |
        v
[/api/status poller] detects status: "ready" → UI reads document_analysis.explanation
```

### Recommended Project Structure
```
src/
├── lib/
│   └── explain/
│       ├── generate-explanation.ts    # generateExplanation() — Files API + stream + validate
│       ├── explain-prompts.ts         # PROMPT_EXPLAIN_BASE, EXPLANATION_MODEL_ID, PSAK_GLOSSARY
│       └── explanation-schema.ts      # Zod schema for ExplanationResult (5 section keys)
├── lib/ingest/
│   └── analyze-document-batch.ts     # runAnalyzeBatch() — mirrors embed-document-batch.ts
└── app/api/internal/
    └── analyze-batch/
        └── route.ts                   # Cron-invoked route — mirrors embed-batch/route.ts
```

### Pattern 1: Structured Streaming Accumulation (no browser streaming)
**What:** `generateContentStream` with `responseSchema` accumulates full JSON server-side before Supabase upsert
**When to use:** When the output is structured JSON (not free-form prose streaming to browser). Streaming reduces Gemini's time-to-first-chunk for the API call, but the structured JSON cannot be partially applied — accumulate the full string first.

```typescript
// Source: @google/genai v1.52 docs (verified via Context7: /googleapis/js-genai)
import { createPartFromUri, GoogleGenAI } from "@google/genai";

const stream = await ai.models.generateContentStream({
  model: EXPLANATION_MODEL_ID,
  contents: [
    createPartFromUri(uri, mimeType),
    { text: buildExplanationPrompt(extractionSource) },
  ],
  config: {
    responseMimeType: "application/json",
    responseSchema: EXPLANATION_RESPONSE_SCHEMA,   // raw JSON Schema object
  },
});

let accumulated = "";
for await (const chunk of stream) {
  accumulated += chunk.text ?? "";
}
// chunks are valid partial JSON that concatenate to the final object
// [VERIFIED: ai.google.dev/gemini-api/docs/structured-output]
const result = explanationSchema.parse(JSON.parse(accumulated));
```

### Pattern 2: Gemini File Resource Reuse (copy from gemini-pdf-pages.ts)
**What:** Check `gemini_file_resource_name` first; re-upload from Supabase Storage only when null or expired
**When to use:** Every analyze-batch invocation — mirror `extractPagesWithGemini` exactly

```typescript
// Source: src/lib/pdf/gemini-pdf-pages.ts (VERIFIED: codebase)
if (params.fileResourceName) {
  // Reuse existing resource
  const ready = await waitForFileReady(ai, params.fileResourceName);
  // waitForFileReady handles FAILED state by throwing — caller must re-upload
} else {
  // Download bytes from Supabase Storage, upload to Files API
  const { data: pdfBytes } = await supabaseAdmin.storage
    .from("documents")
    .download(storagePath);
  // ... upload via ai.files.upload(...)
}
```

### Pattern 3: Internal Route + Cron + after() (copy from embed-batch)
**What:** POST handler authenticated via `INTERNAL_PARSE_SECRET`; Vercel Cron invokes via GET with `?secret=`; `after()` chains batches for large docs
**When to use:** Every internal pipeline stage — this codebase's established pattern

```typescript
// Source: src/app/api/internal/embed-batch/route.ts (VERIFIED: codebase)
export const maxDuration = 300; // Fluid Compute on Hobby = 300s ceiling [VERIFIED: vercel.com/docs]

export function GET(request: Request): Promise<Response> { return handleAnalyzeBatch(request); }
export function POST(request: Request): Promise<Response> { return handleAnalyzeBatch(request); }
```

### Pattern 4: `document_analysis` Upsert
**What:** Upsert on `doc_id` (unique FK constraint, `isOneToOne: true` in database.types.ts)

```typescript
// Source: src/db/database.types.ts — document_analysis.doc_id is 1:1 FK (VERIFIED: codebase)
await supabaseAdmin
  .from("document_analysis")
  .upsert(
    {
      doc_id: docId,
      explanation: JSON.stringify(result), // or raw object if column is jsonb
      explanation_at: new Date().toISOString(),
    },
    { onConflict: "doc_id" },
  );
```

### Anti-Patterns to Avoid
- **Streaming structured JSON directly to browser:** The five-section JSON object cannot be partially applied to UI state. Accumulate fully on server, upsert, then return `{ ok: true }`. Browser polls status route.
- **Calling `generateContentStream` before file is `ACTIVE`:** Upload is async; always use `waitForFileReady()` loop (already implemented in `gemini-pdf-pages.ts` — copy, do not rewrite).
- **Module-level `p-limit` singleton for concurrency cap:** Next.js serverless functions do not guarantee a single warm instance. A module-level `p-limit` instance provides no cross-invocation concurrency protection on Vercel. INFRA-03 formal cap is Phase 11 scope.
- **Using `generateObject` (Vercel AI SDK) instead of `responseSchema` (native SDK):** `generateObject` is the Vercel AI SDK pattern for Phase 8 (AI Score). For Phase 6, stay consistent with the `@google/genai` SDK already validated in the eval harness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload / polling / ACTIVE state | Custom Files API wrapper | `waitForFileReady()` from `gemini-pdf-pages.ts` | Already proven; handles FAILED state; returns `{uri, mimeType}` |
| JSON schema validation of Gemini response | Custom JSON parser | `zod` — `explanationSchema.parse()` | Throws on malformed output; matches existing codebase pattern |
| Bahasa Indonesia glossary detection | Language detection library | `extraction_source` field + first-page text sniff | `extraction_source` is already set to `"gemini-ocr"` for scanned, `"unpdf"` for text; language sniff is a simple character-frequency check |
| Auth on internal route | Custom header check | `timingSafeStringEq(candidate, env.INTERNAL_PARSE_SECRET)` | Copy verbatim from `parse-batch/route.ts` — timing-safe pattern already implemented |

**Key insight:** Phase 6 is mostly assembly, not invention. The eval harness (Phase 5) proved the Gemini Files API pattern works on IDX docs. The parse-batch and embed-batch routes proved the cron pattern. Phase 6 connects them with an explanation-specific prompt.

---

## Common Pitfalls

### Pitfall 1: `responseSchema` Blocks Partial Streaming Application
**What goes wrong:** Developer treats streamed JSON chunks as individually parseable objects and tries to update UI state per chunk. JSON schema output streams partial JSON — chunks are not individually valid JSON.
**Why it happens:** Confusion between free-form text streaming (where each chunk is a sentence fragment) and structured JSON streaming (where chunks are byte fragments of a JSON object).
**How to avoid:** Accumulate all chunks into a string, then parse once at the end. The streamed chunks are valid partial JSON that concatenate to form the complete object. [VERIFIED: ai.google.dev/gemini-api/docs/structured-output]
**Warning signs:** `JSON.parse(chunk.text)` throws on early chunks.

### Pitfall 2: Gemini File Resource Re-upload on Expired TTL
**What goes wrong:** `gemini_file_resource_name` is stored in DB, but 48h have elapsed. Calling `generateContentStream` with the stale URI returns a "file not found" error.
**Why it happens:** Gemini Files API TTL is 48 hours; the resource name persists in the DB but the file is deleted on Gemini's side.
**How to avoid:** `waitForFileReady()` will return `state === "FAILED"` or throw for a missing file. Catch this in `runAnalyzeBatch` and fall through to re-upload from Supabase Storage. Store the new `gemini_file_resource_name` back in the `documents` row.
**Warning signs:** 404 or "file not found" error in the generation call, despite a non-null `gemini_file_resource_name`.

### Pitfall 3: `[p.N]` Citation Hallucination
**What goes wrong:** Gemini produces `[p.N]` citations with page numbers that do not correspond to any page in the document (e.g., `[p.999]` in a 200-page document, or `[p.1]` for every claim).
**Why it happens:** Without explicit constraint, models cite conveniently round numbers or fall back to page 1.
**How to avoid:** The explanation prompt must explicitly instruct: "Cite the PDF page index where the specific number or statement appears. The document has N total pages (from `documents.total_pages`). Every `[p.N]` must reference a page that exists." Include `total_pages` in the prompt interpolation.
**Warning signs:** All citations cluster on page 1, or citation numbers exceed `total_pages`.

### Pitfall 4: Indonesian Jargon Leaking Into Explanation Output
**What goes wrong:** Output contains untranslated phrases like "laba bersih" or "pendapatan komprehensif lain" without English translation, violating EXPLAIN-01 and TRANSLATE-01.
**Why it happens:** Gemini correctly extracts the text but defaults to quoting it rather than explaining it, especially for less common PSAK vocabulary.
**How to avoid:** PSAK glossary injection (TRANSLATE-02) is the primary mitigation. The prompt must also say "If you quote a Bahasa Indonesia term, immediately follow it with its English translation in parentheses." Eval harness re-run (EXPLAIN gate) validates this.
**Warning signs:** Indonesian terms appear in section prose without `(English equivalent)` annotations.

### Pitfall 5: `analyzing` Status Never Resolved on Gemini Quota Exhaustion
**What goes wrong:** Document is set to `"analyzing"`, Gemini API returns a 429 (rate limit) or 503, the route throws, and the document is stuck in `"analyzing"` forever with no user feedback.
**Why it happens:** Error path does not include a status update back to `"failed"` with a retry-friendly message.
**How to avoid:** The `runAnalyzeBatch` function must catch all Gemini errors and call `failDocumentAnalyze(docId, message)` — same pattern as `failDocumentEmbed` in `embed-document-batch.ts`. A 429 specifically should set a retry-able `error_message` ("AI service busy — will retry shortly") and leave the status as `"analyzing"` (not `"failed"`) so the cron picks it up again. A permanent error (invalid API key, FAILED file state) should set `"failed"`.
**Warning signs:** User sees the progress bar frozen at "Analyzing" indefinitely.

### Pitfall 6: Explanation Column Type Mismatch
**What goes wrong:** Code does `supabaseAdmin.from("document_analysis").upsert({ explanation: resultObject })` (passing a plain JS object) but the column is `text` — Supabase JS client silently converts the object to `"[object Object]"` instead of JSON.
**Why it happens:** Supabase JS client auto-serializes to `jsonb` columns but does NOT auto-stringify to `text` columns.
**How to avoid:** If keeping the column as `text`, always `JSON.stringify(result)` before upsert. If migrating to `jsonb`, pass the plain object directly. The migration path is cleaner — one `ALTER TABLE` is less error-prone than maintaining two serialization conventions.
**Warning signs:** `explanation` reads back as `"[object Object]"` or `null`.

---

## Code Examples

### Explanation Prompt Template
```typescript
// Source: derived from PROMPT_EVAL_BASE in src/lib/eval/prompts.ts (VERIFIED: codebase)
// and DISCLAIM-02 requirement (REQUIREMENTS.md)

export const EXPLANATION_MODEL_ID = "gemini-2.5-flash" as const;

export const PSAK_GLOSSARY = `
PSAK/IFRS Financial Vocabulary (Bahasa Indonesia → English):
- laba bersih → net income (profit attributable to owners of parent)
- laba kotor → gross profit
- laba usaha / laba operasi → operating income / EBIT
- laba sebelum pajak → pre-tax income
- pendapatan / penjualan → revenue / net sales
- beban pokok penjualan → cost of goods sold (COGS)
- ekuitas → equity (shareholders' equity)
- aset lancar → current assets
- liabilitas lancar → current liabilities
- arus kas dari aktivitas operasi → operating cash flow
- arus kas dari aktivitas investasi → investing cash flow
- arus kas dari aktivitas pendanaan → financing cash flow
- laba ditahan → retained earnings
- pendapatan komprehensif lain → other comprehensive income (OCI)
- catatan atas laporan keuangan → notes to financial statements
- laporan keuangan konsolidasian → consolidated financial statements
- laporan posisi keuangan → statement of financial position (balance sheet)
- beban bunga → interest expense
- pajak penghasilan → income tax
- aset tidak lancar → non-current assets
- utang usaha → trade payables / accounts payable
- piutang usaha → trade receivables / accounts receivable
- persediaan → inventory
- goodwill → goodwill
- aset tetap → fixed assets / property, plant & equipment (PP&E)
- penyusutan → depreciation
- amortisasi → amortization
- modal disetor → paid-in capital / share capital
- saham treasury → treasury shares
- laba per saham → earnings per share (EPS)
- dividen → dividend
` as const;

export function buildExplanationPrompt(
  totalPages: number,
  isIndonesian: boolean,
): string {
  const glossaryBlock = isIndonesian
    ? `\n\nBAHASA INDONESIA VOCABULARY REFERENCE (use these English translations in your output):\n${PSAK_GLOSSARY}`
    : "";

  return `You are a financial analyst explaining an IDX-listed company's financial document to a non-finance retail investor.

IMPORTANT RULES:
- Write for a smart adult who does NOT understand accounting. Use plain English, grade 9 reading level.
- Do NOT make buy/sell recommendations. Frame ALL output as explanation and analysis only.
- Every factual claim (a number, a ratio, a trend) MUST include an inline citation: [p.N] where N is the PDF page index (1-indexed) where that fact appears. The document has ${totalPages} total pages; every [p.N] must be a valid page in that range.
- If you quote a Bahasa Indonesia financial term, immediately follow it with its English translation in parentheses.
- No jargon without an inline plain-English definition on first use.${glossaryBlock}

Produce a JSON object with EXACTLY these five string keys. Each value is a paragraph (or two) of plain-English analysis with inline [p.N] citations woven into the prose:
- revenue: Explain what the company earns, revenue growth or decline, and what drove it.
- profitability: Explain gross margin, operating margin, and net margin trends.
- balance_sheet: Explain total assets, debt level, liquidity, and equity position.
- cash_flow: Explain operating cash flow quality and whether the company generates or consumes cash.
- key_risks: Explain 2-3 material risks evident from the document.`;
}
```

### Zod Schema for Explanation Result
```typescript
// Source: mirrors pattern in src/lib/eval/schema.ts (VERIFIED: codebase)
import { z } from "zod";

export const explanationSchema = z.object({
  revenue: z.string().min(1),
  profitability: z.string().min(1),
  balance_sheet: z.string().min(1),
  cash_flow: z.string().min(1),
  key_risks: z.string().min(1),
});

export type ExplanationResult = z.infer<typeof explanationSchema>;

// Raw JSON Schema for Gemini responseSchema config (Gemini takes raw JSON Schema, not Zod)
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

### Migration: `explanation` Column from `text` to `jsonb`
```sql
-- Source: VERIFIED pattern against Supabase docs (supabase.com/docs/guides/database/json)
-- Safe to run: column is currently NULL for all rows (no existing data to convert)
ALTER TABLE document_analysis
  ALTER COLUMN explanation TYPE jsonb USING explanation::jsonb;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel Hobby 60s function timeout | 300s default via Fluid Compute | June 25, 2025 | Phase 6 can run a full Gemini generation pass without timeout workarounds on Hobby |
| Separate `responseSchema` vs streaming (mutually exclusive concern) | `generateContentStream` + `responseSchema` supported on 2.5 Flash | Late 2024 / 2025 | Chunks are valid partial JSON; accumulate then parse |
| `explanation` as free-form markdown blob | Structured JSON with 5 named sections | Phase 6 design (D-04) | Phase 7 can render each section independently and parse `[p.N]` per section |

**Deprecated/outdated:**
- 60-second function timeout concern: Resolved by Vercel Fluid Compute. The `maxDuration = 300` export is still best practice to be explicit, but the default is now 300s on Hobby.
- `LangChain` for pipeline orchestration: Already ruled out in Phase 5. Direct `@google/genai` SDK is the project standard.

---

## Focus Area Deep-Dives

### 1. Gemini Files API Citation-Forcing Prompt Engineering

**Finding:** The eval harness achieved 92.6% citation accuracy using `PROMPT_EVAL_BASE` — a prompt that explicitly names citation IDs and requires page indices. The explanation prompt should follow the same discipline: explicit instruction, named anchor points, and document page count as a constraint. [VERIFIED: 05-VERIFICATION.md and eval harness results]

**Technique:** Embed `total_pages` in the prompt as an explicit upper bound for `[p.N]` values. This removes the model's freedom to hallucinate page numbers above the document length.

**`responseSchema` vs free-form:** Using `responseSchema` gives two benefits: (1) Gemini is forced to produce the 5-section JSON structure — no need to parse markdown; (2) schema compliance is validated before storage. The eval harness already uses this pattern (`gemini-eval-extract.ts` uses `responseSchema` in `config`). [VERIFIED: codebase]

**Streaming with `responseSchema`:** Supported on Gemini 2.5 Flash. Chunks are valid partial JSON strings; accumulate all chunks before `JSON.parse`. [VERIFIED: ai.google.dev/gemini-api/docs/structured-output]

### 2. PSAK/IFRS Glossary Injection

**Finding:** The glossary block should be ~25–30 terms minimum, targeting the high-risk vocabulary identified in `05-AI-SPEC.md` Section 1b: the `laba` family (net/gross/operating/pre-tax income), consolidated vs. parent-entity labels, denomination notes. [VERIFIED: 05-AI-SPEC.md codebase]

**Token budget:** 100 terms × ~10 tokens/term = ~1,000 tokens. The explanation prompt including glossary will be ~1,500–2,000 tokens total. The 200-page PDF occupies ~50K–100K vision tokens. Total request is well within the 1M context window. [ASSUMED: token estimate based on training knowledge; reasonable but not measured]

**Language detection:** The `extraction_source` field (`"gemini-ocr"` for scanned, `"unpdf"` for text-layer) does NOT indicate language — it indicates the parsing method. Language detection requires inspecting the first-page text: check for high frequency of Bahasa Indonesia stopwords (`"dan"`, `"yang"`, `"dalam"`, `"untuk"`, `"dengan"`, `"laporan"`, `"tahun"`). A count of ≥5 of these in the first 200 characters of extracted text reliably identifies an ID-first document. The glossary should be injected for any document where language detection returns `"id"` OR where `extraction_source` indicates Gemini OCR (which implies we have no text to sniff — default to injecting glossary). [ASSUMED: the specific threshold of 5 stopwords in 200 chars is a reasonable heuristic; should be verified in implementation]

### 3. SDK Choice: `@google/genai` vs Vercel AI SDK

**Recommendation: Stay with `@google/genai` native for Phase 6.**

Rationale:
- The analyze-batch route does NOT stream to a browser. It streams internally (server-side accumulation) and writes to Supabase. Vercel AI SDK's `streamText` is designed for browser-streaming use cases via `useChat` — it is the right choice for Phase 10 (chat), not Phase 6.
- The eval harness already validated `@google/genai` with `responseSchema` + `generateContentStream` on real IDX PDFs.
- Adding `@ai-sdk/google` as a new dependency for a non-browser-streaming use case introduces provider-abstraction overhead with no benefit here.
- Vercel AI SDK does not natively support `responseSchema` with Gemini Files API parts in the same call pattern as `@google/genai` — it would require a custom provider adapter. [ASSUMED: this specific limitation; needs verification if Vercel AI SDK path is later chosen]

### 4. `explanation` Column: `jsonb` Migration

**Recommendation: Add a migration to change `explanation` from `text` to `jsonb`.**

Evidence:
- Supabase JS client accepts plain JS objects for `jsonb` columns; no `JSON.stringify()` required. For `text` columns, you must stringify manually — one more source of bugs. [VERIFIED: supabase.com/docs/guides/database/json]
- `score_breakdown` in the same `document_analysis` table is already `jsonb`. Consistency is valuable.
- The `ALTER TABLE` migration is safe: the column is currently `NULL` for all rows (no existing data to convert). [VERIFIED: codebase — `explanation` is `string | null` in database.types.ts and no analysis rows exist yet]
- `jsonb` enables Phase 7 and Phase 8 to query individual section values via Supabase operators (`explanation->>revenue`) without a full string deserialize if needed later.

Migration:
```sql
ALTER TABLE document_analysis
  ALTER COLUMN explanation TYPE jsonb USING explanation::jsonb;
```

After migration, update `database.types.ts` to reflect `explanation: Json | null` (currently `string | null`).

### 5. Vercel 60s Timeout Mitigation

**Finding: The 60-second timeout concern from CONTEXT.md D-14 is RESOLVED by Vercel Fluid Compute.**

As of June 25, 2025, Vercel Fluid Compute is enabled by default on all plans including Hobby. The new default maximum duration is **300 seconds (5 minutes)** on Hobby. [VERIFIED: vercel.com/docs/functions/configuring-functions/duration, verified 2026-02-27 last-updated date; cross-verified via Vercel changelog announcement]

Action required: Export `export const maxDuration = 300` in the `analyze-batch/route.ts` file. This is the explicit declaration pattern used throughout the codebase (`embed-document-batch.ts` uses `MAX_EMBED_BATCH_WALL_MS = 52_000`; `analyze-batch` should set `maxDuration = 300`).

For a 200-page IDX annual report: Gemini 2.5 Flash processes large PDFs and generates ~500–1,500 tokens of explanation in approximately 15–45 seconds based on community observations. [ASSUMED: these latency estimates are based on training knowledge and forum reports; actual latency should be measured during implementation smoke tests]

### 6. INFRA-03 Concurrency Cap

**Finding: Module-level `p-limit` does NOT work on Vercel for cross-invocation concurrency. INFRA-03 formal implementation belongs in Phase 11.**

For Phase 6 specifically: the cron picks **one document** per invocation (`LIMIT 1` query on `analyzing` documents). Because each cron tick processes one document, the natural concurrency is 1 per cron interval (1 minute). This is well within the ≤2 concurrent Gemini calls constraint of INFRA-03. No concurrency control code is needed in Phase 6.

The formal `p-limit`-style cap (using a DB semaphore or Vercel's Fluid Compute `after()` queue) belongs in Phase 11 per the roadmap assignment of INFRA-03. [VERIFIED: REQUIREMENTS.md — INFRA-03 assigned to Phase 11]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@google/genai` | Gemini Files API, generation | ✓ | `^1.52.0` in package.json | — |
| `zod` | Schema validation | ✓ | `^3.25.76` in package.json | — |
| `@supabase/supabase-js` | DB upsert, Storage download | ✓ | `^2.105.1` in package.json | — |
| `GEMINI_API_KEY` env var | All Gemini calls | ✓ (required by existing pipeline) | — | — |
| `INTERNAL_PARSE_SECRET` env var | Cron route auth | ✓ (already used by parse-batch, embed-batch) | — | — |
| Vercel Cron (Hobby) | Analyze trigger | ✓ | 2 free cron jobs on Hobby | — |
| Supabase Storage | PDF re-download for re-upload | ✓ | Already provisioned | — |

**Missing dependencies with no fallback:** None — all required infrastructure is already provisioned.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^2.1.9` |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `pnpm vitest run src/lib/explain/` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPLAIN-01 | Five-section JSON structure is produced and validated | Unit (schema) | `pnpm vitest run src/lib/explain/explanation-schema.test.ts` | ❌ Wave 0 |
| EXPLAIN-02 | `[p.N]` citations present in every section string | Unit (prompt output fixture) | `pnpm vitest run src/lib/explain/explain-prompts.test.ts` | ❌ Wave 0 |
| EXPLAIN-03 | Prompt includes plain-English, no-jargon instruction | Unit (prompt string check) | included in `explain-prompts.test.ts` | ❌ Wave 0 |
| EXPLAIN-04 | Cache gate: `explanation IS NOT NULL` → skip Gemini call | Unit (mock supabase return) | `pnpm vitest run src/lib/ingest/analyze-document-batch.test.ts` | ❌ Wave 0 |
| EXPLAIN-05 | First section present after generation completes | Integration (live Gemini, single small PDF) | `pnpm vitest run --testPathPattern=analyze-pipeline-live` | ❌ Wave 0 (live test) |
| TRANSLATE-01 | Gemini handles ID-only PDF without translation errors | Eval gate (pnpm eval) | `pnpm eval` (existing harness) | ✅ Phase 5 |
| TRANSLATE-02 | PSAK glossary string is non-empty, includes required terms | Unit (string check) | included in `explain-prompts.test.ts` | ❌ Wave 0 |
| DISCLAIM-02 | Every prompt build includes no-recommendation clause | Unit (string check) | included in `explain-prompts.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run src/lib/explain/ src/lib/ingest/analyze-document-batch.test.ts`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** `pnpm eval` exits 0 (≥90% numeric AND ≥90% citation across all 9 eval docs) — blocking sign-off gate per roadmap success criterion 5

### Wave 0 Gaps
- [ ] `src/lib/explain/explanation-schema.test.ts` — covers EXPLAIN-01 (Zod schema parse/reject tests)
- [ ] `src/lib/explain/explain-prompts.test.ts` — covers EXPLAIN-02, EXPLAIN-03, TRANSLATE-02, DISCLAIM-02 (prompt string assertions; no API call)
- [ ] `src/lib/ingest/analyze-document-batch.test.ts` — covers EXPLAIN-04 (cache gate unit test with mocked Supabase)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (no user auth in v1) | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes (internal route protection) | `timingSafeStringEq` against `INTERNAL_PARSE_SECRET` — already implemented in parse-batch/embed-batch |
| V5 Input Validation | Yes (Gemini response) | `zod` schema parse on `explanationSchema` — throws on malformed output |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized analyze-batch trigger | Spoofing | `timingSafeEqual` on `INTERNAL_PARSE_SECRET` (copy from existing routes) |
| Gemini response injection (malicious PDF causes Gemini to output crafted explanation) | Tampering | Zod schema validation rejects extra fields; `[p.N]` citation markers are display-only in Phase 7 (no code execution) |
| No-recommendation instruction bypass via prompt injection | Elevation of Privilege | Hard-coded `DISCLAIM-02` clause at start of prompt; cannot be overridden by PDF content because PDF is passed as a binary file part, not interpolated into the prompt string |
| PDF download from Supabase with invalid `storage_path` | Tampering | `supabaseAdmin` RLS bypasses row-level filtering, but `storage_path` comes from the `documents` row looked up by `docId` — not from user input at analyze time |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gemini 2.5 Flash generates a 200-page IDX annual report explanation in 15–45 seconds | Timeout Mitigation | If generation takes >120s regularly, the 300s limit is still fine; >300s would require incremental persistence |
| A2 | PSAK glossary injection of ~100 terms uses ~1,000 tokens | Glossary Injection | If token usage is higher, reduce glossary to top-50 terms; still within 1M context budget |
| A3 | Language detection via Bahasa Indonesia stopword frequency in first 200 chars is reliable | Language Detection | False negatives possible for bilingual (EN+ID) docs; safe fallback is to inject glossary for all docs (minor prompt size increase, no quality degradation) |
| A4 | Vercel AI SDK does not natively support `responseSchema` + Files API `createPartFromUri` in the same call | SDK Choice | If it does, Vercel AI SDK could be used in Phase 6 as a forward-compatible choice; investigation during implementation is low risk |

---

## Open Questions

1. **Should the `after()` chain-on-not-done pattern from embed-batch apply to analyze-batch?**
   - What we know: `embed-document-batch.ts` uses `after()` to chain batches within the 60s (now 300s) window. Embedding is naturally chunked. Analysis is a single Gemini call — not chunked.
   - What's unclear: Can a Gemini call exceed 300s on a very large document under free-tier rate limiting?
   - Recommendation: Do not implement `after()` chaining for analyze-batch in v1. If the Gemini call exceeds 300s, the status stays `"analyzing"` and the cron retries on the next tick. Document this as acceptable retry behavior.

2. **Should the status route (`/api/status`) return the cached explanation when status is `ready`?**
   - What we know: The status route currently returns `{status, updated_at, error_message}`. The doc page will need the explanation to render it.
   - What's unclear: Whether the doc page should fetch explanation via a separate query or get it from the status route.
   - Recommendation: Keep the status route lightweight (status only). Add a separate GET `/api/doc/[id]` endpoint (or server component data fetch) that returns the full `document_analysis` row when `status === "ready"`. This is cleaner and prevents large JSON in polling responses.

3. **What is the correct `documents.gemini_file_resource_name` lifecycle for explain vs. parse?**
   - What we know: `gemini-pdf-pages.ts` sets `gemini_file_resource_name` during parsing. The analyze route should reuse it if within TTL.
   - What's unclear: The parse phase may run, store a resource name, then the 48h TTL expires before the analyze phase runs (if embedding takes a very long time or there is a queue delay).
   - Recommendation: `waitForFileReady` with FAILED-state handling; fall through to re-upload from Supabase Storage with appropriate DB update of `gemini_file_resource_name` to the new value.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 6 |
|-----------|-------------------|
| Budget: Free-tier only, ~$0/month | Use Gemini 2.5 Flash free tier (250 RPD); cron interval designed to not exhaust daily quota with normal traffic |
| Citations non-negotiable | Every factual claim must have `[p.N]` — prompt must enforce, eval harness must gate |
| Product must NOT make buy/sell recommendations | DISCLAIM-02 clause hard-coded in every prompt constant; not post-filtered |
| Audience: non-finance English readers | Flesch-Kincaid grade 9 target; PSAK glossary; inline definitions for jargon |
| No LangChain | `@google/genai` SDK only |
| No exotic infrastructure | Vercel Cron + Supabase — no queues, no external job runners |
| Scope discipline: upload-only v1 | No auto-fetch, no multi-doc comparison in Phase 6 |

---

## Sources

### Primary (HIGH confidence)
- `/googleapis/js-genai` (Context7) — `generateContentStream`, `responseSchema`, `createPartFromUri` API
- `src/lib/eval/gemini-eval-extract.ts` (codebase) — `responseSchema` + Files API pattern, verified working on IDX PDFs
- `src/lib/pdf/gemini-pdf-pages.ts` (codebase) — `waitForFileReady`, file resource reuse pattern
- `src/app/api/internal/embed-batch/route.ts` (codebase) — cron route auth pattern
- `src/lib/ingest/embed-document-batch.ts` (codebase) — `MAX_EMBED_BATCH_WALL_MS`, status transition pattern
- `src/db/database.types.ts` (codebase) — `document_analysis` schema, `document_status` enum
- `src/lib/eval/prompts.ts` (codebase) — `PROMPT_EVAL_BASE` citation-forcing pattern, `EVAL_MODEL_ID`
- [Vercel Functions Duration docs](https://vercel.com/docs/functions/configuring-functions/duration) — 300s Hobby limit (last updated 2026-02-27)
- [Gemini Structured Output docs](https://ai.google.dev/gemini-api/docs/structured-output) — `responseSchema` streaming support, partial JSON chunk behavior

### Secondary (MEDIUM confidence)
- [Vercel Fluid Compute Changelog](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute) — June 2025 Hobby 300s announcement
- [Supabase JSON docs](https://supabase.com/docs/guides/database/json) — `jsonb` vs `text` tradeoffs, JS client object passing

### Tertiary (LOW confidence)
- Community reports on Gemini 2.5 Flash generation latency (15–45s for large PDFs) — flagged as A1 in Assumptions Log

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in codebase, verified versions
- Architecture: HIGH — mirrors established codebase patterns exactly
- Gemini streaming with responseSchema: HIGH — verified via official Gemini docs and Context7
- Vercel timeout: HIGH — verified via official Vercel docs (last updated 2026-02-27)
- Prompt engineering for citations: HIGH — validated by Phase 5 eval harness (92.6% citation accuracy)
- Generation latency estimates: LOW — assumed from training knowledge; measure during smoke tests

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — Gemini API stable; Vercel limits recently updated)
