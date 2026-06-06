# Phase 6: AI Explanation Generation - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate, stream, cache, and serve a 5-section plain-English explanation with inline `[p.N]`
citations from an IDX PDF — handling Bahasa Indonesia source documents faithfully. Phase 6
delivers the explanation only; the PDF viewer (Phase 7), score (Phase 8), stock data (Phase 9),
and chat (Phase 10) are downstream consumers of the cached explanation.

</domain>

<decisions>
## Implementation Decisions

### Analysis Trigger

- **D-01:** Explanation generation fires **automatically after embedding completes** via Vercel Cron
  + `/api/internal/analyze-batch`. The status flow is:
  `uploaded → parsing → embedding → analyzing → ready`.
  The `"analyzing"` status is already in the `document_status` enum — no migration needed.
- **D-02:** The cron + internal route pattern mirrors the existing `parse-batch` and `embed-batch`
  routes in `src/app/api/internal/`. Follow those patterns exactly.
- **D-03:** The cron polls for documents in `"embedding"` status that have completed embedding
  (all chunks embedded) and transitions them to `"analyzing"` before calling Gemini.

### Explanation Storage Format

- **D-04:** Store the explanation as **structured JSON** in `document_analysis.explanation`.
  Schema:
  ```json
  {
    "revenue": "string with inline [p.N] citations",
    "profitability": "string with inline [p.N] citations",
    "balance_sheet": "string with inline [p.N] citations",
    "cash_flow": "string with inline [p.N] citations",
    "key_risks": "string with inline [p.N] citations"
  }
  ```
  This gives Phase 7 (Citation UI) clean section boundaries to render each section independently
  and parse `[p.N]` markers per section without regex-splitting a markdown blob.
- **D-05:** Citations use **inline `[p.N]` markers** within prose text (e.g., "Revenue grew 18%
  `[p.12]` driven by..."). Consistent with REQUIREMENTS.md EXPLAIN-02 and the `[p.N]` format
  Phase 7 will parse into clickable links.
- **D-06:** The `document_analysis.explanation` column is already `string | null` — store the
  JSON as a stringified blob, or use Supabase's `jsonb` if a migration is appropriate. Planner
  to decide: add a migration to change the column type to `jsonb`, or stringify and store as text.

### Bahasa Indonesia Handling

- **D-07:** No separate pre-translation pass. Pass the full PDF to Gemini 2.5 Flash natively —
  the model handles Bahasa Indonesia financial vocabulary directly (validated by eval harness
  at 97.8% numeric / 92.6% citation accuracy on ID-only docs).
- **D-08:** Inject the PSAK/IFRS glossary (TRANSLATE-02, 50–100 terms) into the system prompt
  for every analysis call. Detection of ID source is automatic (based on the `extraction_source`
  field or a lightweight language-sniff of first-page text). Planner to implement detection.

### Caching

- **D-09:** Explanation is cached per-document in `document_analysis`. If `explanation` is
  non-null for a `doc_id`, serve from cache and do **not** call Gemini again (EXPLAIN-04).
- **D-10:** The `document_analysis` row is created (or upserted) by the analyze-batch route.
  The doc page reads from cache on load.

### Streaming

- **D-11:** Streaming (EXPLAIN-05) applies to the **first generation** pass. The analyze-batch
  route generates and stores the explanation; the doc page then serves it from cache (no
  artificial re-streaming of cached content). The "first section within 5s" requirement means
  the analyze cron must start quickly after embedding completes — cron interval should be ≤60s.
- **D-12:** SDK choice is left to the planner. The codebase uses `@google/genai` natively
  (established in parse and eval). The ROADMAP recommends Vercel AI SDK (`@ai-sdk/google`).
  Planner should evaluate whether native `@google/genai` streaming to a Next.js route handler
  is sufficient, or whether Vercel AI SDK's `streamText` adds meaningful benefit for the
  analyze-batch use case.

### Gemini File Resource Reuse

- **D-13:** Reuse the stored `gemini_file_resource_name` if present and within the 48h TTL.
  Re-upload the PDF from Supabase Storage if the resource name is null or the file is
  expired/FAILED. This mirrors the existing pattern in `extractPagesWithGemini` in
  `src/lib/pdf/gemini-pdf-pages.ts`.

### Vercel Function Timeout

- **D-14:** Vercel Hobby plan caps serverless function duration at **60 seconds**. For large
  IDX annual reports (200+ pages), Gemini generation may exceed this. Planner must address:
  - Use Vercel's `maxDuration` export (up to 300s on Pro, 60s on Hobby)
  - Or stream the generation result server-side and persist incrementally
  - Or accept that on Hobby, very large docs may time out and surface a retry path

### No-Recommendation Guard

- **D-15:** Every Gemini prompt for explanation generation must hard-code no-recommendation
  instructions per DISCLAIM-02 (requirements): "Do not make buy/sell recommendations. Frame all
  output as explanation and analysis." This is a prompt-level constraint, not a post-filter.

### Claude's Discretion

- Exact Gemini model prompt structure (temperature, system vs user message split, whether
  to use `generateContent` with `responseSchema` or free-form streaming)
- Whether to add a `jsonb` migration for `document_analysis.explanation` or keep as `text`
- Cron interval for the analyze cron (must be ≤60s to hit the 5s-first-section target)
- PSAK glossary initial term list (planner/researcher to compile 50–100 terms from
  eval fixture documents and TRANSLATE-02 requirement)
- Error handling for Gemini quota exhaustion during analyze (set status to `failed` with
  a retry-friendly message, or a new `analyze_failed` sub-status)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §EXPLAIN-01–05 — 5-section format, citation format, reading
  level, caching, streaming requirements
- `.planning/REQUIREMENTS.md` §TRANSLATE-01–02 — Bahasa Indonesia handling, PSAK glossary
- `.planning/REQUIREMENTS.md` §DISCLAIM-02 — no-recommendation prompt constraint
- `.planning/REQUIREMENTS.md` §INFRA-03 — LLM concurrency cap (≤2 concurrent Gemini calls)

### Phase 5 Artifacts (eval gate — MUST read)
- `.planning/phases/05-indonesian-eval-harness/05-VERIFICATION.md` — Phase 6 gate confirmed
  passed (97.8% numeric, 92.6% citation); Phase 6 may proceed
- `.planning/phases/05-indonesian-eval-harness/05-AI-SPEC.md` — Gemini Files API patterns
  validated during eval; follow these prompt patterns
- `eval/README.md` — "Phase 6 gate status: pnpm eval exits 0" sign-off
- `src/lib/eval/prompts.ts` — `EVAL_MODEL_ID`, `PROMPT_EVAL_BASE` — reference for citation-
  extraction prompt style and `gemini-2.5-flash` model constant

### Existing Pipeline Code (follow these patterns)
- `src/lib/pdf/gemini-pdf-pages.ts` — Gemini Files API upload + waitForFileReady + re-upload
  pattern; reuse for analysis
- `src/lib/eval/gemini-eval-extract.ts` — Full `@google/genai` generation pattern with
  `responseSchema`; mirror for explanation generation
- `src/app/api/internal/parse-batch/route.ts` — Internal route pattern (cron-invoked)
- `src/app/api/internal/embed-batch/route.ts` — Internal route pattern (cron-invoked)
- `src/lib/ingest/parse-document-batch.ts` — Status transition pattern (`analyzing` already
  in enum)
- `src/lib/ingest/embed-document-batch.ts` — Post-embed hook / status transition to read

### Schema
- `src/db/database.types.ts` — `document_analysis` table shape: `explanation (string|null)`,
  `doc_id` (1:1 FK to `documents`); `documents.gemini_file_resource_name` for file reuse
- `src/db/database.types.ts` — `document_status` enum (includes `"analyzing"`)

### ROADMAP
- `.planning/ROADMAP.md` §Phase 6 — Success criteria, requirements list, research flag

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/pdf/gemini-pdf-pages.ts` — `extractPagesWithGemini()` and `waitForFileReady()`:
  reuse the file-resource-name caching + re-upload pattern for explanation generation
- `src/lib/eval/gemini-eval-extract.ts` — Full generation pattern with `createPartFromUri`,
  `responseSchema`, and cleanup: mirror this for the explanation prompt
- `src/lib/embed/gemini-embed.ts` — `EMBEDDING_MODEL_ID` constant pattern; create similar
  `EXPLANATION_MODEL_ID = "gemini-2.5-flash"` constant
- `src/lib/rag/match-document-chunks.ts` — RAG retriever already works; available if the
  explanation prompt needs retrieval-augmented context (optional for Phase 6)
- `src/components/ui/card.tsx`, `button.tsx`, `separator.tsx` — shadcn/ui primitives in use

### Established Patterns
- **Cron + internal route**: `src/app/api/internal/{parse,embed}-batch/route.ts` — POST
  endpoint with internal secret header, called by Vercel Cron; follow this exactly
- **Status machine**: documents move through `document_status` enum; the analyze route
  transitions `embedding → analyzing → ready` (or `→ failed`)
- **`supabaseAdmin` for all server writes**: use `src/db/client.ts` admin client
- **Server-only imports**: all Gemini and Supabase server code uses `"use server"` or
  `import "server-only"` — maintain this boundary

### Integration Points
- **Trigger**: `src/lib/ingest/embed-document-batch.ts` completes → document status becomes
  `"embedding"` then transitions out; analyze cron picks up documents in this state
- **Output**: writes to `document_analysis` table (upsert on `doc_id`)
- **Consumer**: `/doc/[documentId]` page — currently shows `DocumentProgressView`; after
  `ready` status, the page will need to render the explanation from `document_analysis`
- **Status polling**: `src/app/api/status/route.ts` — already polls `document_analysis`;
  update response shape to include `explanation` when present

</code_context>

<specifics>
## Specific Ideas

- The `document_analysis` table was designed in Phase 1 with `explanation (string|null)` — the
  planner should decide whether to add a migration changing this to `jsonb` (for structured
  JSON storage) or stringify the JSON object and store as text. Given the structured-JSON
  decision (D-04), `jsonb` is cleaner but requires a migration.
- The eval harness (`pnpm eval`) already proves Gemini handles ID-only docs at ≥90% accuracy
  with the `PROMPT_EVAL_BASE` citation-extraction pattern. The explanation prompt should be
  modeled on this proven approach, extended to produce the 5-section format.

</specifics>

<deferred>
## Deferred Ideas

- **Vercel AI SDK `useChat` integration** — The ROADMAP recommends Vercel AI SDK for chat
  (Phase 10). Phase 6 does not need `useChat`. If the planner determines Vercel AI SDK
  `streamText` adds value for the analyze route, it can be adopted here; otherwise, Phase 10
  is the natural entry point.
- **Artificial streaming of cached explanation** — Some products re-stream cached content
  for a "live" feel on re-visits. Deferred: serve cached JSON instantly from `document_analysis`,
  no fake streaming.
- **Per-section regeneration** — Ability to regenerate one section without re-running the full
  explanation. Deferred to v2.

</deferred>

---

*Phase: 06-ai-explanation-generation*
*Context gathered: 2026-05-17*
