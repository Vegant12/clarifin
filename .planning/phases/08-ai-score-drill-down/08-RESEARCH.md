# Phase 8: AI Score & Drill-Down - Research

**Researched:** 2026-05-19
**Domain:** Structured LLM output generation + React accordion UI with shadcn
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Score generated in the same `analyze-batch` cron tick as explanation — `generateScore()` called sequentially after `generateExplanation()` succeeds.
- **D-02:** Soft fail on score error: explanation-success + score-failure still transitions document to `ready` with `score = null`. Hard fail only if BOTH explanation AND score fail.
- **D-03:** Cache per-document: skip score generation if `document_analysis.score` is non-null for the given `doc_id`.
- **D-04:** Use `@google/genai` with `responseSchema` — NOT Vercel AI SDK `generateObject`.
- **D-05:** Retry on Zod validation failure: 1 retry (2 total attempts). Second failure → score null, soft-fail per D-02.
- **D-06:** Score widget at top of `ExplanationPanel`, above `SECTION_ORDER`. `ExplanationPanel` extended with `score` prop. No layout restructuring to `DocumentReaderLayout` or `DesktopSplitPane`.
- **D-07:** Unavailable state: skeleton while `analyzing`, muted "AI Assessment unavailable" state when `score` is null and document is `ready`.
- **D-08:** "AI Assessment · not financial advice" label below the score number in `text-muted-foreground text-sm`.
- **D-09:** Accordion expand/collapse for drill-down — inline, no modal, no sheet.
- **D-10:** One accordion open at a time — shadcn `Accordion type="single"`.
- **D-11:** Cited snippets reuse `CitationInline` from Phase 7 — same `[p.N]` click → `onGoToPage` behavior.

### Claude's Discretion

- Exact `score_breakdown` JSON schema shape (suggested: `overall_score + dimensions[]` — planner to finalize Zod schema)
- Score number display styling (size, color — follow brand tokens)
- Dimension visual layout (vertical stack vs 2×2 grid)
- Model ID for score prompt (follow `EXPLANATION_MODEL_ID` constant pattern)
- Score prompt structure
- Error state UI copy for "AI Assessment unavailable"
- Whether to use shadcn `Accordion` or lightweight custom expand/collapse

### Deferred Ideas (OUT OF SCOPE)

- Vercel AI SDK `generateObject` for score generation
- Score regeneration UI button
- Score history / version tracking
- Color-coded score (red/yellow/green range) — emerald only in v1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCORE-01 | System generates a holistic 1-10 AI assessment score | `generate-score.ts` mirrors `generate-explanation.ts` using `@google/genai` `responseSchema`; `overall_score: integer 1–10` in Zod schema |
| SCORE-02 | Score breaks down into 4 dimensions: Profitability, Balance Sheet, Growth Trend, Valuation Context | `dimensions: z.array(dimensionSchema).length(4)` in `score-schema.ts`; 4 criteria in `buildScorePrompt` |
| SCORE-03 | Each dimension includes reasoning grounded in document content | `reasoning: z.string().min(1)` per dimension; prompt instructs neutral analytical language with document citations |
| SCORE-04 | User can drill into each dimension to see 2–3 quoted snippets with page citations | `snippets: z.array(snippetSchema).min(1).max(3)` per dimension; `CitationInline` reused in accordion content |
| SCORE-05 | Score output is schema-validated JSON | `scoreSchema.parse()` with Zod + `SCORE_RESPONSE_SCHEMA` raw JSON Schema for Gemini; retry on ZodError (D-05) |
| SCORE-06 | Score prominently labeled "AI Assessment · not financial advice" adjacent to number | Static disclaimer string below 48px score number in `ScoreCard`; confirmed in UI-SPEC copywriting contract |
</phase_requirements>

---

## Summary

Phase 8 adds a schema-validated AI assessment score alongside the existing explanation pipeline. The technical work divides into two independent tracks: (1) backend generation — a new `generate-score.ts` that mirrors `generate-explanation.ts` exactly in structure, wired into `analyze-document-batch.ts` after the explanation step; and (2) frontend display — a new `ScoreCard` component using shadcn Accordion (not yet installed) prepended into `ExplanationPanel`, with a `ScoreLoadingSkeleton` for the loading state.

The most important finding from codebase inspection is that all infrastructure already exists: the DB columns (`score`, `score_breakdown`, `score_at`, `score_reasoning`) are live in `database.types.ts`, the `@google/genai@^1.52.0` SDK is installed, `CitationInline` handles the `[p.N]` click behavior, and the soft-fail/cache-gate orchestration patterns are already established in `analyze-document-batch.ts`. Phase 8 is additive — no existing files are restructured, only extended.

The primary planning risk is the prop threading chain from `document/[documentId]/page.tsx` through `DocumentProgressView → DocumentReaderLayout → DesktopSplitPane/MobileTabView → ExplanationPanel`. Each of these four components must accept and forward two new props (`score: ScoreResult | null`, `isScoreLoading: boolean`). The planner must sequence these modifications carefully to avoid type errors propagating down the chain. The secondary risk is the Langfuse install — it is not yet in `package.json` and must be added before score tracing can be wired in. The AI-SPEC specifies Langfuse tracing as a required production monitoring element, so its install is not optional.

**Primary recommendation:** Create files in dependency order — schema first, prompts second, generation third, orchestration wiring fourth, UI components fifth, prop threading sixth. This mirrors the Phase 6 build sequence and avoids broken imports during development.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Score generation (Gemini call, Zod parse, retry) | API / Backend (cron job) | — | Gemini API key cannot be exposed to browser; generation runs in `analyze-document-batch.ts` Fluid Compute context |
| Score persistence | Database / Storage | — | Upsert to `document_analysis` on `doc_id` conflict; same pattern as explanation |
| Score retrieval (RSC fetch) | Frontend Server (SSR) | — | RSC `page.tsx` queries Supabase; `score_breakdown` parsed with Zod before passing to client component |
| Score display (`ScoreCard`) | Browser / Client | — | Accordion interaction requires client state; `"use client"` component |
| Loading skeleton (`ScoreLoadingSkeleton`) | Browser / Client | — | Animated `animate-pulse` runs client-side only |
| Accordion drill-down (shadcn Accordion) | Browser / Client | — | Radix Accordion is client-interactive; controlled state for single-open behavior |
| Citation navigation (`CitationInline`) | Browser / Client | — | Reused from Phase 7; `onGoToPage` callback is client-side imperative handle |
| Compliance guardrail (investment advice blocklist) | API / Backend | — | Pre-persist scan of `accumulated` string; must run server-side before Supabase write |

---

## Standard Stack

### Core (all already installed — verified against package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | ^1.52.0 | Structured score generation via `generateContentStream` + `responseSchema` | [VERIFIED: package.json] Already in use for `generate-explanation.ts`; D-04 locks this choice |
| `zod` | ^3.25.76 | Schema validation for `ScoreResult` | [VERIFIED: package.json] Same as `explanationSchema` pattern |
| `@supabase/supabase-js` | ^2.105.1 | DB upsert for score columns; admin client for server-side writes | [VERIFIED: package.json] Already in use throughout codebase |
| `shadcn` | ^4.6.0 | New York style preset; `accordion` component | [VERIFIED: package.json] Already initialized; `npx shadcn add accordion` still needed |
| `vitest` | ^2.1.9 | Test framework for schema, prompt, and generation unit tests | [VERIFIED: package.json] All existing tests use vitest |

### Supporting (to install)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `langfuse` | latest (3.38.20 available) | Trace every `generateScore` call; log compliance violations and parse failures | [VERIFIED: npm registry via node_modules check] Not yet in package.json — must install before score tracing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@google/genai` direct | Vercel AI SDK `generateObject` | Deferred in D-04 — consistency with existing codebase; revisit in Phase 11 |
| shadcn `Accordion` | Custom expand/collapse | shadcn Accordion is already the project standard (Radix-backed, keyboard nav, ARIA managed automatically) |

**Installation (net new):**
```bash
npm install langfuse
npx shadcn add accordion
```

**Version verification:**
- `@google/genai`: `^1.52.0` confirmed in `package.json` [VERIFIED: codebase]
- `langfuse`: `3.38.20` confirmed as available on npm [VERIFIED: node_modules lookup]
- shadcn accordion: official New York style registry, no version pin needed [VERIFIED: 08-UI-SPEC.md]

---

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │         Vercel Cron Tick                │
                    │        analyze-batch route              │
                    └──────────────┬──────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────┐
                    │         runAnalyzeBatch()               │
                    │                                         │
                    │  [cache gate: explanation exists?]      │
                    │         │ YES → skip, ready             │
                    │         │ NO ↓                          │
                    │  generateExplanation() ──────────────── ▶ Gemini Files API
                    │         │ success                       │   (PDF reference)
                    │         ▼                               │
                    │  [upsert explanation columns]           │
                    │         │                               │
                    │  [cache gate: score exists?] ◀─── NEW  │
                    │         │ YES → skip                    │
                    │         │ NO ↓                          │
                    │  generateScore() ─────────────────────▶ Gemini Files API
                    │         │ (reuse fileResourceName)      │   (same PDF ref)
                    │         ▼                               │
                    │  [Zod parse + compliance scan]          │
                    │         │ fail → retry (max 1)          │
                    │         │ success ▼                     │
                    │  [upsert score/score_breakdown/score_at]│
                    │         │                               │
                    │  status → ready (D-02: even if score=null)
                    └─────────────────────────────────────────┘

                           ↓ RSC fetch at page load

                    ┌─────────────────────────────────────────┐
                    │       /doc/[documentId]/page.tsx        │
                    │  select(explanation, score_breakdown)   │
                    │  Zod parse scoreSchema (safe)           │
                    │  pass ScoreResult | null downward       │
                    └──────────────┬──────────────────────────┘
                                   │
              ┌────────────────────▼────────────────────────┐
              │          DocumentProgressView               │
              │  (score + isScoreLoading props threaded)    │
              └───────────┬────────────────────────────────┘
                          │
         ┌────────────────▼─────────────────────┐
         │        DocumentReaderLayout          │
         │  forwards score props to both:       │
         └────────┬──────────────────┬─────────┘
                  │                  │
     ┌────────────▼──┐      ┌───────▼──────────┐
     │DesktopSplitPane│      │  MobileTabView  │
     │ → ExplanationPanel    │ → ExplanationPanel
     └────────────────┘      └────────────────-┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       ExplanationPanel      │
                    │  (score prop added)         │
                    │                             │
                    │  ┌──────────────────────┐   │
                    │  │   ScoreCard (NEW)    │   │
                    │  │  or ScoreLoadingSkeleton  │
                    │  │  or "unavailable" state   │
                    │  └──────────────────────┘   │
                    │  [SECTION_ORDER map below]  │
                    └─────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── lib/
│   └── explain/
│       ├── generate-explanation.ts  (existing — exports isIndonesianDoc, waitForFileReady, uploadFresh)
│       ├── explanation-schema.ts    (existing)
│       ├── explain-prompts.ts       (existing — exports PSAK_GLOSSARY)
│       ├── generate-score.ts        (NEW)
│       ├── score-schema.ts          (NEW)
│       └── score-prompts.ts         (NEW)
├── components/
│   └── doc/
│       ├── explanation-panel.tsx    (MODIFIED — score prop added)
│       ├── document-reader-layout.tsx  (MODIFIED — score props forwarded)
│       ├── document-progress-view.tsx  (MODIFIED — score props accepted)
│       ├── score-card.tsx           (NEW — "use client")
│       └── score-loading-skeleton.tsx  (NEW — "use client")
└── app/
    └── doc/
        └── [documentId]/
            └── page.tsx             (MODIFIED — select score_breakdown, Zod parse)
```

### Pattern 1: Score Schema (Dual Zod + Raw JSON Schema)

**What:** Two parallel definitions in one file — Zod for TypeScript inference and runtime validation, raw JSON Schema for Gemini `responseSchema`. MUST stay in sync.

**When to use:** Every `@google/genai` structured output call.

```typescript
// Source: src/lib/explain/explanation-schema.ts (existing pattern to mirror)
import { z } from "zod";

const snippetSchema = z.object({
  text: z.string().min(1),
  page: z.number().int().positive(),
});

const dimensionSchema = z.object({
  name: z.string().min(1),
  score: z.number().int().min(1).max(10),
  reasoning: z.string().min(1),
  snippets: z.array(snippetSchema).min(1).max(3),
});

export const scoreSchema = z.object({
  overall_score: z.number().int().min(1).max(10),
  dimensions: z.array(dimensionSchema).length(4),
});

export type ScoreResult = z.infer<typeof scoreSchema>;

export const SCORE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overall_score: { type: "integer", minimum: 1, maximum: 10 },
    dimensions: {
      type: "array", minItems: 4, maxItems: 4,
      items: { type: "object",
        properties: {
          name: { type: "string" },
          score: { type: "integer", minimum: 1, maximum: 10 },
          reasoning: { type: "string" },
          snippets: { type: "array", minItems: 1, maxItems: 3,
            items: { type: "object",
              properties: { text: { type: "string" }, page: { type: "integer", minimum: 1 } },
              required: ["text", "page"] } },
        },
        required: ["name", "score", "reasoning", "snippets"] },
    },
  },
  required: ["overall_score", "dimensions"],
} as const;
```

### Pattern 2: Score Generation (Mirror of generate-explanation.ts)

**What:** Import `isIndonesianDoc`, `waitForFileReady`, `uploadFresh` from `generate-explanation.ts`. Substitute schema/prompt imports. Add `thinkingBudget: 0`.

**When to use:** Anytime structured extraction from a Files API PDF resource is needed.

```typescript
// Source: src/lib/explain/generate-explanation.ts (lines 172–200 pattern)
const stream = await ai.models.generateContentStream({
  model: SCORE_MODEL_ID,
  contents: [createPartFromUri(uri, mimeType), { text: prompt }],
  config: {
    responseMimeType: "application/json",
    responseSchema: SCORE_RESPONSE_SCHEMA,
    thinkingConfig: { thinkingBudget: 0 }, // NEW vs explanation — disable thinking for extraction
  },
});
```

Key difference from `generate-explanation.ts`: `thinkingBudget: 0` is set because score generation is deterministic structured extraction, not open-ended prose. The explanation intentionally omits this.

### Pattern 3: Orchestration Integration (analyze-document-batch.ts)

**What:** After Step 8 (explanation upserted), before Step 9 (status → ready): cache check → generate → compliance scan → upsert.

**When to use:** Any new generation step added to `runAnalyzeBatch`.

```typescript
// Source: src/lib/ingest/analyze-document-batch.ts (lines 96–107 cache pattern to mirror)
// Step 8b — Score cache check
const scoreCacheRes = await supabaseAdmin
  .from("document_analysis")
  .select("score")
  .eq("doc_id", docId)
  .maybeSingle();

if (scoreCacheRes.data?.score == null) {
  let scoreGenResult = null;
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
      { doc_id: docId, score: scoreGenResult.result.overall_score,
        score_breakdown: scoreGenResult.result, score_at: new Date().toISOString() },
      { onConflict: "doc_id" },
    );
  }
}
// Step 9 unchanged — status → ready
```

### Pattern 4: Prop Threading (RSC to Client Components)

**What:** RSC fetches `score_breakdown` from `document_analysis`, parses it with `scoreSchema.safeParse()`, passes `ScoreResult | null` and a boolean down through 4 component layers.

**When to use:** Any new data field fetched by the RSC and consumed by a leaf component.

The threading chain (verified by reading all 4 component files):
```
page.tsx (RSC, select + Zod parse)
  → DocumentProgressView (client, passes to reader)
    → DocumentReaderLayout (client, forwards to both layout children)
      → DesktopSplitPane (client, passes to ExplanationPanel)
      → MobileTabView (client, passes to ExplanationPanel)
        → ExplanationPanel (client, renders ScoreCard | ScoreLoadingSkeleton | null)
```

**Critical observation:** `DocumentReaderLayout` currently has a hard guard `if (!explanation) return <fallback />`. The score is optional (`score: ScoreResult | null` is valid), so this guard does NOT need to change. Score null is a valid rendered state (unavailable message).

### Pattern 5: ScoreCard Component (shadcn Accordion)

**What:** Client component with shadcn `Accordion type="single" collapsible`. Score header (number + disclaimer) above 4 `AccordionItem` triggers. Each trigger expands to show snippets with `CitationInline`.

**When to use:** Any interactive expand/collapse list with single-open semantics.

```typescript
// Source: 08-UI-SPEC.md anatomy + shadcn Accordion pattern
// ScoreCard is "use client" — uses Accordion controlled state
<Accordion type="single" collapsible>
  {score.dimensions.map((dim) => (
    <AccordionItem key={dim.name} value={dim.name}>
      <AccordionTrigger>
        {/* flex row: name + reasoning + [N/10] chip */}
      </AccordionTrigger>
      <AccordionContent>
        {dim.snippets.map((snip, i) => (
          <div key={i} className="border-l-2 border-muted pl-3 py-1 my-1 bg-muted/40">
            <span className="text-sm italic text-foreground">{snip.text} </span>
            <CitationInline page={snip.page} docId={docId} onGoToPage={onGoToPage} />
          </div>
        ))}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

### Anti-Patterns to Avoid

- **Parsing JSON chunks in the stream loop:** Each `chunk.text` is a partial JSON fragment. Calling `JSON.parse(chunk.text)` inside the `for await` loop throws on every chunk. Accumulate the full string first. [VERIFIED: generate-explanation.ts lines 182–185]
- **Importing `generate-explanation.ts` helpers via re-export:** `waitForFileReady` and `uploadFresh` are currently unexported (not in the export list). The planner must either export them from `generate-explanation.ts` or duplicate them in `generate-score.ts`. Re-exporting is cleaner.
- **Forgetting `thinkingBudget: 0`:** `gemini-2.5-flash` has thinking enabled by default. Score extraction does not benefit from thinking — it adds 100–400ms and extra tokens. Set `thinkingBudget: 0` explicitly.
- **Schema and Zod drift:** Adding a field to one without the other causes either silent missing data or production ZodErrors. Always update `scoreSchema` and `SCORE_RESPONSE_SCHEMA` together in the same commit.
- **Upsert conflict on `doc_id` without specifying `onConflict`:** The `document_analysis` table has a unique constraint on `doc_id` (one-to-one relationship). Without `{ onConflict: "doc_id" }`, the upsert will error on the second write. The explanation upsert already uses this pattern correctly.
- **Threading `score` prop as `undefined` vs `null`:** TypeScript `exactOptionalPropertyTypes` is likely active. Use `score: ScoreResult | null` (nullable), not `score?: ScoreResult` (optional), so the presence/absence distinction is explicit.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion expand/collapse | Custom toggle state + CSS transition | shadcn `Accordion` (Radix) | Radix handles `aria-expanded`, keyboard nav (Enter/Space/Arrow), focus management, animation — all free |
| Compliance term scanning | Custom LLM post-processor | In-process regex blocklist before persist | Simple, zero-latency, no additional API call; sufficient for the known blocked-term set |
| Schema-constrained JSON generation | Manual prompt engineering for JSON structure | `responseMimeType: "application/json"` + `responseSchema` | Gemini constrained decoding eliminates markdown fences and structural errors at the model level |
| LLM tracing / prompt versioning | Custom logging | `langfuse` SDK | Langfuse handles trace correlation, generation metadata, prompt version management, alert thresholds — not worth building |
| Retry loop with backoff | Complex retry infrastructure | Simple `for (let attempt = 1; attempt <= 2; attempt++)` | Only 1 retry warranted (D-05); Zod error is the only retry condition; no exponential backoff needed at this scale |

**Key insight:** The `@google/genai` `responseSchema` feature eliminates 80% of the parsing fragility in structured output calls. The remaining 20% is covered by the 1-retry Zod loop. Do not build additional JSON repair or output normalization logic.

---

## Common Pitfalls

### Pitfall 1: `waitForFileReady` and `uploadFresh` Are Currently Unexported

**What goes wrong:** `generate-score.ts` needs `waitForFileReady`, `uploadFresh`, and `isIndonesianDoc` from `generate-explanation.ts`. These functions currently have no `export` keyword — they are module-private. Importing them in `generate-score.ts` will produce a TypeScript "not exported" error.

**Why it happens:** Phase 6 built `generate-explanation.ts` as a self-contained module. Phase 8 needs to reuse the internal helpers.

**How to avoid:** The first task in `generate-score.ts` creation must be adding `export` to `waitForFileReady`, `uploadFresh`, and `isIndonesianDoc` in `generate-explanation.ts`. (Note: `isIndonesianDoc` IS already exported — verified at line 96. `waitForFileReady` and `uploadFresh` are NOT exported — verified at lines 21 and 47.)

**Warning signs:** TypeScript error `Module '"@/lib/explain/generate-explanation"' has no exported member 'waitForFileReady'`.

### Pitfall 2: EXPLANATION_MODEL_ID is "gemini-2.0-flash" — Score Should Use "gemini-2.5-flash"

**What goes wrong:** `explain-prompts.ts` line 7 sets `EXPLANATION_MODEL_ID = "gemini-2.0-flash"`. The AI-SPEC and CONTEXT.md both specify score generation uses `"gemini-2.5-flash"`. If the planner copies the model ID from the explanation file without updating it, score generation will use the wrong (less capable) model.

**Why it happens:** Phase 6 was built with `gemini-2.0-flash`; the CLAUDE.md stack table shows `Gemini 2.5 Flash` as primary but the prompt file diverges.

**How to avoid:** `score-prompts.ts` must explicitly set `export const SCORE_MODEL_ID = "gemini-2.5-flash"` and NOT inherit from `EXPLANATION_MODEL_ID`. The explain-prompts.test.ts assertion `expect(EXPLANATION_MODEL_ID).toBe("gemini-2.5-flash")` currently FAILS (it is `gemini-2.0-flash`) — this is an existing bug in the Phase 6 code, not introduced by Phase 8. Do not fix it in Phase 8 (separate scope).

**Warning signs:** Score generation latency much higher than expected (2.5 Flash is faster); quality difference in structured extraction.

### Pitfall 3: Prop Threading Breaks TypeScript at DocumentProgressView

**What goes wrong:** `DocumentProgressView` is the first client component in the prop chain. It currently renders `<DocumentReaderLayout explanation={explanation} pdfUrl={pdfUrl} />`. Adding `score` and `isScoreLoading` requires updating the prop interface of `DocumentProgressView`, `DocumentReaderLayout`, `DesktopSplitPane`, `MobileTabView`, and `ExplanationPanel` — five components in sequence. Missing any one causes a TypeScript error that blocks compilation.

**Why it happens:** Deep prop drilling through a 5-component hierarchy.

**How to avoid:** Update component signatures in order from bottom to top: `ExplanationPanel` → `DesktopSplitPane` (inside `document-reader-layout.tsx`) → `MobileTabView` → `DocumentReaderLayout` → `DocumentProgressView` → `page.tsx`. This ensures each component's new props are already typed before the parent tries to pass them.

**Warning signs:** TypeScript error `Property 'score' does not exist on type...` cascading through multiple files.

### Pitfall 4: `score_breakdown` Is `Json | null` in DB but Needs Zod Parse Before Use

**What goes wrong:** `document_analysis.score_breakdown` is typed as `Json | null` in `database.types.ts`. Passing raw DB JSON directly to UI components skips the `ScoreResult` type and loses TypeScript safety. If Gemini ever produces a malformed breakdown that passes DB storage (e.g., a legacy row), the UI component crashes.

**Why it happens:** Supabase returns `Json` — the TypeScript union type, not a validated `ScoreResult`.

**How to avoid:** In `page.tsx` RSC, use `scoreSchema.safeParse(analysisRes.data.score_breakdown)` — identical to the `explanationSchema.safeParse(analysisRes.data.explanation)` pattern already there. Pass `parsed.success ? parsed.data : null` to `DocumentProgressView`.

**Warning signs:** TypeScript errors about `Json` not being assignable to `ScoreResult`; or runtime crashes in `ScoreCard` accessing `score.dimensions`.

### Pitfall 5: Compliance Guardrail Must Run Before Persist, Not After

**What goes wrong:** If the investment advice blocklist regex runs after `document_analysis.upsert()`, a non-compliant score reaches the database and potentially the UI before it's caught.

**Why it happens:** It's tempting to add the compliance check as a logging-only post-processing step.

**How to avoid:** Run the compliance regex against `accumulated` (the raw accumulated string) AND against each `reasoning` and `text` field after Zod parse, but BEFORE the Supabase upsert call. If any blocked term is found, set `scoreGenResult = null` and log the violation. The upsert is never reached for a non-compliant result.

**Warning signs:** `compliance_violation` Langfuse events appearing AFTER documents transition to `ready`.

### Pitfall 6: isScoreLoading Logic in DocumentProgressView

**What goes wrong:** The `DocumentProgressView` currently only shows `<DocumentReaderLayout>` when `data?.status === "ready"`. Before that, it shows the `PipelineStepper`. So `isScoreLoading` is `true` when the document is still in the stepper view — but `ExplanationPanel` (and thus `ScoreCard`) is NOT rendered at all during that time. The score skeleton only appears after the document reaches `ready`.

**Why it happens:** The score loading skeleton is only visible in the reader layout, not in the stepper/progress view.

**How to avoid:** `isScoreLoading` should be `score === null && document status === "ready"` — not `document status !== "ready"`. While the stepper is showing, the score slot doesn't exist yet. The skeleton appears when the reader layout renders with a null score (edge case: score generation took longer than expected, though in practice both complete before `status → ready`). Simplest implementation: if `score === null` when `DocumentReaderLayout` first renders, show `ScoreLoadingSkeleton`; this is an instantaneous swap since score is set before `ready`. In practice, the skeleton may never display for more than a render cycle.

---

## Code Examples

### score-schema.ts (complete, verified against explanation-schema.ts pattern)

```typescript
// Source: mirrors src/lib/explain/explanation-schema.ts [VERIFIED: codebase]
import { z } from "zod";

const snippetSchema = z.object({
  text: z.string().min(1),
  page: z.number().int().positive(),
});

const dimensionSchema = z.object({
  name: z.string().min(1),
  score: z.number().int().min(1).max(10),
  reasoning: z.string().min(1),
  snippets: z.array(snippetSchema).min(1).max(3),
});

export const scoreSchema = z.object({
  overall_score: z.number().int().min(1).max(10),
  dimensions: z.array(dimensionSchema).length(4),
});

export type ScoreResult = z.infer<typeof scoreSchema>;

export const SCORE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overall_score: { type: "integer", minimum: 1, maximum: 10,
      description: "Overall assessment score from 1 (very poor) to 10 (excellent)." },
    dimensions: {
      type: "array", minItems: 4, maxItems: 4,
      items: {
        type: "object",
        properties: {
          name: { type: "string",
            description: "One of: Profitability, Balance Sheet, Growth Trend, Valuation Context." },
          score: { type: "integer", minimum: 1, maximum: 10 },
          reasoning: { type: "string",
            description: "One sentence of neutral analytical reasoning. No buy/sell." },
          snippets: {
            type: "array", minItems: 1, maxItems: 3,
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "Verbatim quoted text." },
                page: { type: "integer", minimum: 1, description: "1-based page number." },
              },
              required: ["text", "page"],
            },
          },
        },
        required: ["name", "score", "reasoning", "snippets"],
      },
    },
  },
  required: ["overall_score", "dimensions"],
} as const;
```

### score-prompts.ts (verified model ID and prompt structure per AI-SPEC §4)

```typescript
// Source: 08-AI-SPEC.md §4 Implementation Guidance [VERIFIED: 08-AI-SPEC.md]
// NOTE: EXPLANATION_MODEL_ID in explain-prompts.ts is "gemini-2.0-flash" (Phase 6 legacy).
// Score uses "gemini-2.5-flash" as specified in AI-SPEC. Do NOT inherit from explanation.
export const SCORE_MODEL_ID = "gemini-2.5-flash" as const;

export function buildScorePrompt(totalPages: number, isIndonesian: boolean): string {
  const langNote = isIndonesian
    ? `The document is in Bahasa Indonesia. Use correct English equivalents for PSAK financial terms.`
    : "";
  return `You are a financial analyst reviewing an IDX-listed company financial document (${totalPages} pages).
${langNote}

Score this document on exactly 4 dimensions. Return the JSON object specified by the schema.

Dimension criteria:
1. Profitability — net profit margin, operating income, ROE from continuing operations.
   Exclude extraordinary items (pos luar biasa). Do not count OCI as core profit.
2. Balance Sheet — current ratio, debt-to-equity, interest coverage. Note sector context
   for banks/financial institutions (structurally high leverage — do not penalise unless
   capital adequacy ratios are also stressed).
3. Growth Trend — YoY revenue and net income over at least 3 years of comparative data.
   Distinguish organic growth from one-time revaluations or acquisitions.
4. Valuation Context — P/E and P/B where available. Frame as "above/below sector norms"
   without directional investment advice. If ratios not in document, note that live market
   data is required and score conservatively (5).

RULES (non-negotiable):
- Do NOT use: buy, sell, invest, recommend, accumulate, avoid, underweight, overweight.
- All reasoning must be descriptive, not prescriptive.
- Page numbers must match actual document pages containing the cited data.
- overall_score is the mean of the 4 dimension scores, rounded to the nearest integer.
`.trim();
}
```

### DB columns already exist (no migration needed)

```typescript
// Source: src/db/database.types.ts lines 136-147 [VERIFIED: codebase]
// document_analysis Row includes:
//   score: number | null
//   score_at: string | null
//   score_breakdown: Json | null
//   score_reasoning: string | null   ← not used in Phase 8 (reasoning is inside score_breakdown)
```

### RSC page.tsx extension pattern

```typescript
// Source: src/app/doc/[documentId]/page.tsx lines 14-22 [VERIFIED: codebase]
// Pattern to follow for score_breakdown fetch:
const analysisRes = await supabaseAdmin
  .from("document_analysis")
  .select("explanation, score_breakdown")  // extend select
  .eq("doc_id", documentId)
  .maybeSingle();

// Then parse score_breakdown separately:
const scoreParseResult = scoreSchema.safeParse(analysisRes.data?.score_breakdown);
const score: ScoreResult | null = scoreParseResult.success ? scoreParseResult.data : null;
```

### shadcn accordion install (not yet installed — confirmed)

```bash
# Source: 08-UI-SPEC.md §New shadcn Component [VERIFIED: codebase — not in src/components/ui/]
npx shadcn add accordion
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel AI SDK `generateObject` for structured output | `@google/genai` direct with `responseSchema` | Phase 6 decision (D-04 confirms) | Consistency with existing codebase; avoids two SDK abstractions |
| Manual JSON Schema construction for every model | `responseSchema` + parallel Zod schema in same file | Phase 6 established pattern | Type safety and validation in one place; both must stay in sync |
| `generateContent` (non-streaming) for large PDFs | `generateContentStream` with accumulation | Phase 6 | Avoids Vercel function appearing hung; functionally equivalent result |
| `gemini-2.0-flash` in explain-prompts.ts | `gemini-2.5-flash` target for score (per AI-SPEC) | Phase 8 | Better structured extraction quality; `thinkingBudget: 0` for determinism |

**Deprecated/outdated:**
- `EXPLANATION_MODEL_ID = "gemini-2.0-flash"`: The AI-SPEC and CLAUDE.md stack table specify `gemini-2.5-flash` as primary. This appears to be a Phase 6 implementation drift. Phase 8 score generation uses `gemini-2.5-flash` explicitly. The explanation model mismatch is noted but out of scope for Phase 8.

---

## Runtime State Inventory

Phase 8 is additive (not a rename/refactor/migration). The `score`, `score_breakdown`, `score_at`, and `score_reasoning` columns already exist in the live `document_analysis` table. No migration is needed. All existing rows have these columns as `null` — when Phase 8 runs, scores will be generated for new documents only (cache gate D-03 prevents generation for documents already scored).

**Nothing to migrate in any category** — verified by `database.types.ts` confirming all four score columns already exist.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@google/genai` | Score generation | ✓ | ^1.52.0 | — |
| `zod` | Schema validation | ✓ | ^3.25.76 | — |
| `vitest` | Unit tests | ✓ | ^2.1.9 | — |
| `shadcn accordion` | Drill-down UI | ✗ (not in src/components/ui/) | — | Install: `npx shadcn add accordion` |
| `langfuse` | Score tracing (AI-SPEC §7) | ✗ (not in package.json) | 3.38.20 available | None — required for production monitoring per AI-SPEC |
| `LANGFUSE_PUBLIC_KEY` env var | Langfuse SDK init | Unknown (not verified) | — | Add to `.env.local` and Vercel project settings |
| `LANGFUSE_SECRET_KEY` env var | Langfuse SDK init | Unknown (not verified) | — | Add to `.env.local` and Vercel project settings |

**Missing dependencies with no fallback:**
- `langfuse` package — must install before score tracing can be wired
- `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` — must be present in env before Langfuse initializes

**Missing dependencies with fallback:**
- `shadcn accordion` — `npx shadcn add accordion` installs from official New York registry; no code changes needed, just the install

---

## Validation Architecture

`nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | inferred from `package.json` (`"test": "vitest run"`) |
| Quick run command | `npx vitest run src/lib/explain/__tests__/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-01 | `scoreSchema.parse()` accepts valid 1–10 overall_score | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ Wave 0 |
| SCORE-01 | `scoreSchema.parse()` rejects out-of-range score (0, 11) | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ Wave 0 |
| SCORE-02 | `scoreSchema.parse()` rejects when `dimensions.length !== 4` | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ Wave 0 |
| SCORE-02 | `SCORE_RESPONSE_SCHEMA` declares `minItems: 4, maxItems: 4` for dimensions | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ Wave 0 |
| SCORE-03 | `buildScorePrompt` contains no-recommendation clause | unit | `npx vitest run src/lib/explain/__tests__/score-prompts.test.ts` | ❌ Wave 0 |
| SCORE-03 | `buildScorePrompt` with isIndonesian=true injects language note | unit | `npx vitest run src/lib/explain/__tests__/score-prompts.test.ts` | ❌ Wave 0 |
| SCORE-04 | `snippetSchema` rejects when `snippets.length > 3` | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ Wave 0 |
| SCORE-04 | `snippetSchema` requires `page >= 1` | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ Wave 0 |
| SCORE-05 | Compliance regex blocks "buy", "sell", "recommend" in reasoning | unit | `npx vitest run src/lib/explain/__tests__/score-schema.test.ts` | ❌ Wave 0 |
| SCORE-06 | `ScoreCard` renders "AI Assessment · not financial advice" text | unit | `npx vitest run src/components/doc/__tests__/score-card.test.tsx` | ❌ Wave 0 |
| SCORE-06 | Disclaimer is adjacent to score number in DOM | unit | `npx vitest run src/components/doc/__tests__/score-card.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/explain/__tests__/` (schema + prompt tests, < 5s)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/explain/__tests__/score-schema.test.ts` — covers SCORE-01, SCORE-02, SCORE-04, SCORE-05
- [ ] `src/lib/explain/__tests__/score-prompts.test.ts` — covers SCORE-03
- [ ] `src/components/doc/__tests__/score-card.test.tsx` — covers SCORE-06
- [ ] `src/lib/explain/__tests__/generate-score.test.ts` — unit test with mocked `@google/genai` (pattern: `generate-explanation.test.ts`)

---

## Security Domain

`security_enforcement` is not set to `false` in config — this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in v1 (per CLAUDE.md §12) |
| V3 Session Management | no | Session token in localStorage only; not relevant to score generation |
| V4 Access Control | no | Internal cron route uses existing `INTERNAL_CRON_SECRET` header pattern |
| V5 Input Validation | yes | `scoreSchema.parse()` validates all LLM output before DB write; `responseSchema` constrains Gemini output |
| V6 Cryptography | no | No new cryptographic operations in Phase 8 |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Investment advice language in LLM output | Repudiation (regulatory) | Compliance regex blocklist on `accumulated` string AND post-Zod field scan before persist; log `compliance_violation` to Langfuse |
| Schema injection via PDF content | Tampering | `responseSchema` constrains Gemini output to declared JSON shape; Zod validates before any field is used |
| Hallucinated page citations reaching UI | Spoofing | Prompt explicitly bounds `page` values to `totalPages`; `page: z.number().int().positive()` in Zod; UI passes page to existing `CitationInline` which navigates PDF viewer (does not fetch server data for navigation) |
| Score null silently (quota exhaustion) | Denial of Service (degradation) | `isTransientGeminiError()` already in `analyze-document-batch.ts`; soft-fail per D-02; Langfuse quota exhaustion alert |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `waitForFileReady` and `uploadFresh` are not yet exported from `generate-explanation.ts` | Common Pitfalls #1 | If they ARE exported, Pitfall #1 does not apply — Wave 0 or pre-task verification will confirm |
| A2 | `EXPLANATION_MODEL_ID = "gemini-2.0-flash"` (not 2.5-flash) — observed discrepancy from CLAUDE.md stack table | Common Pitfalls #2 | If explanation model was already updated to 2.5-flash in a recent commit, no discrepancy exists — planner should verify by reading `explain-prompts.ts` line 7 at task time |
| A3 | `langfuse` package is not yet installed | Environment Availability | If already installed (e.g., added during Phase 11 prep), Wave 0 install step is a no-op |
| A4 | `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` env vars are not yet configured | Environment Availability | If already present in `.env.local`, env var setup step is a no-op |

**If this table is empty after build:** All assumptions were verified at task time — no user confirmation needed.

---

## Open Questions

1. **Should `generate-explanation.ts` helpers be exported or duplicated in `generate-score.ts`?**
   - What we know: `waitForFileReady` and `uploadFresh` are needed by both files; they are currently private.
   - What's unclear: project convention for sharing internal helpers between sibling modules.
   - Recommendation: Export from `generate-explanation.ts` (single source of truth). Duplicating creates drift risk.

2. **Should Langfuse tracing be wired in Phase 8 or deferred to Phase 11 (Observability)?**
   - What we know: AI-SPEC §7 specifies Langfuse tracing as required for score generation monitoring. Phase 11 is the dedicated Observability phase. Langfuse is not yet installed.
   - What's unclear: Whether the user wants score-specific tracing now or consolidated in Phase 11.
   - Recommendation: Wire Langfuse tracing in Phase 8 as a lightweight addition (install + 4 lines per the AI-SPEC §7 pattern). This satisfies the AI-SPEC monitoring requirement and gives production data before Phase 11. If deferred, score failures in production have no diagnostic trail.

3. **Should the compliance regex scan run as a separate Wave 0 test or be part of `generate-score.ts` unit tests?**
   - What we know: The compliance check is an in-process string scan, testable with Vitest.
   - What's unclear: Whether the compliance scan lives in a dedicated guard function (testable in isolation) or inline in `analyze-document-batch.ts` (harder to unit test).
   - Recommendation: Extract compliance scan to a named function `scanForInvestmentAdvice(text: string): string | null` in `score-prompts.ts` or a sibling `score-guardrails.ts`. This makes it independently testable.

---

## Sources

### Primary (HIGH confidence)

- `src/lib/explain/generate-explanation.ts` — verified: function exports, stream accumulation pattern, Files API upload pattern [VERIFIED: codebase]
- `src/lib/explain/explanation-schema.ts` — verified: dual Zod + JSON Schema pattern [VERIFIED: codebase]
- `src/lib/explain/explain-prompts.ts` — verified: model ID (`gemini-2.0-flash`), PSAK_GLOSSARY, prompt structure [VERIFIED: codebase]
- `src/lib/ingest/analyze-document-batch.ts` — verified: cache gate, soft/hard fail, upsert pattern, step numbering [VERIFIED: codebase]
- `src/components/doc/explanation-panel.tsx` — verified: current props interface, SECTION_ORDER, CitationInline usage [VERIFIED: codebase]
- `src/components/doc/document-reader-layout.tsx` — verified: prop threading, DesktopSplitPane structure [VERIFIED: codebase]
- `src/components/doc/document-progress-view.tsx` — verified: props received from RSC, DocumentReaderLayout call signature [VERIFIED: codebase]
- `src/app/doc/[documentId]/page.tsx` — verified: RSC select pattern, explanationSchema.safeParse pattern [VERIFIED: codebase]
- `src/db/database.types.ts` — verified: `document_analysis` score columns exist, types [VERIFIED: codebase]
- `src/components/ui/` listing — verified: shadcn accordion NOT yet installed [VERIFIED: codebase]
- `package.json` — verified: dependency versions, test script, `langfuse` not present [VERIFIED: codebase]
- `.planning/phases/08-ai-score-drill-down/08-AI-SPEC.md` — full AI design contract [VERIFIED: file read]
- `.planning/phases/08-ai-score-drill-down/08-UI-SPEC.md` — full UI design contract [VERIFIED: file read]
- `.planning/phases/08-ai-score-drill-down/08-CONTEXT.md` — locked decisions D-01 through D-11 [VERIFIED: file read]
- `.planning/config.json` — verified: `nyquist_validation: true`, `commit_docs: true` [VERIFIED: file read]

### Secondary (MEDIUM confidence)

- `node_modules/langfuse/package.json` version check: 3.38.20 available (package exists from prior environment check) [VERIFIED: npm lookup]

### Tertiary (LOW confidence)

- None — all critical claims were verified against codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against package.json and codebase
- Architecture: HIGH — all component files read and prop chains traced
- Pitfalls: HIGH — identified by direct codebase inspection (missing exports, model ID discrepancy, prop threading sequence)
- Test patterns: HIGH — existing test files read and patterns extracted

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable libraries; Gemini API changes may affect tokenization estimates)
