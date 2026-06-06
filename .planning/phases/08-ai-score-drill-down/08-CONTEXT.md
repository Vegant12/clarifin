# Phase 8: AI Score & Drill-Down - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate, store, and display a schema-validated 1-10 AI assessment score with a 4-dimension
breakdown (Profitability, Balance Sheet, Growth Trend, Valuation Context). Each dimension
includes a one-sentence reasoning summary and 2–3 quoted document snippets with clickable
page citations. The score is generated inside the existing `analyze-batch` pipeline (same
cron tick as explanation), cached per-document, and displayed at the top of the explanation
panel in the document reader.

Phase 8 does NOT include: stock data/charts (Phase 9), chat (Phase 10), or observability (Phase 11).

</domain>

<decisions>
## Implementation Decisions

### Score Generation Timing

- **D-01:** Score is generated **in the same `analyze-batch` run** as the explanation — sequential
  in the same cron tick. `runAnalyzeBatch` calls `generateExplanation()` first, then
  `generateScore()` immediately after explanation succeeds (and is persisted). Document
  transitions `analyzing → ready` only after both complete (or score soft-fails per D-02).
  No new cron slot, no separate pipeline step.

- **D-02:** **Soft fail on score error:** If score generation fails (Zod parse error, Gemini
  quota, or network) but explanation already succeeded, the document still transitions to
  `ready` with `score = null`. The UI shows a graceful "AI Assessment unavailable" state.
  Score is NOT retried on the next cron tick automatically (document is already `ready`).
  Hard fail (status = `failed`) only if BOTH explanation AND score fail.

- **D-03:** **Cache per-document:** If `document_analysis.score` is non-null for the given
  `doc_id`, skip score generation entirely (same pattern as explanation caching, Phase 6 D-09).
  Score is never regenerated unless the row is manually cleared.

### SDK Choice

- **D-04:** Use **`@google/genai` with `responseSchema`** for score generation — same SDK as
  `generate-explanation.ts`. Do NOT introduce Vercel AI SDK `generateObject`. The ROADMAP
  mentions `generateObject` but consistency with existing code takes precedence. Retry logic
  is implemented manually (see D-05).

- **D-05:** **Retry on Zod validation failure: 1 retry (2 total attempts).** If the first
  Gemini response fails Zod parse, call Gemini once more with the same prompt. If the second
  attempt also fails, score is null and the document soft-fails per D-02. No further retries.

### Score UI Placement

- **D-06:** The score widget appears **at the top of the explanation panel**, above the 5
  explanation sections. `ExplanationPanel` is extended to accept a `score` prop; the score
  card renders as a header block before `SECTION_ORDER` iteration. No layout restructuring
  to `DocumentReaderLayout` or `DesktopSplitPane`.

- **D-07:** **Unavailable state handling:**
  - While analysis runs (document not yet `ready`): animated skeleton placeholder in the score
    slot (consistent with `PdfLoadingSkeleton` pattern — Phase 7).
  - If `score` is null after document is `ready`: muted "AI Assessment unavailable" state
    with no number. Explanation sections still render below.

- **D-08:** The **"AI Assessment · not financial advice"** label (SCORE-06) appears **below**
  the score number in smaller muted text. Score number is large and prominent; disclaimer is
  directly beneath it in `text-muted-foreground text-sm` styling.

### Drill-Down Interaction

- **D-09:** Clicking a dimension reveals its snippets via **accordion expand/collapse** — an
  inline block of 2–3 quoted snippets animates open below the dimension row. No modal, no
  sheet, no navigation. User stays in the score card context.

- **D-10:** **One accordion open at a time.** Opening a second dimension automatically
  collapses the currently-open one. The 4 dimensions are managed as a single controlled
  accordion group (standard shadcn Accordion with `type="single"`).

- **D-11:** Cited snippets inside each accordion **reuse `CitationInline`** from Phase 7.
  Each snippet displays quoted text followed by a `[p.N]` inline link that calls `onGoToPage`
  to scroll the PDF viewer. Same UX as the explanation panel — consistent citation behavior
  throughout.

### Claude's Discretion

- Exact `score_breakdown` JSON schema shape (suggested: `{ overall_score: number,
  dimensions: [{ name: string, score: number, reasoning: string, snippets: [{ text: string,
  page: number }] }] }` — planner to finalize and define Zod schema)
- Score number display styling (size, color — follow existing brand tokens from `globals.css`)
- Dimension visual layout (vertical stack vs 2×2 grid for the 4 dimension cards)
- Model ID for score prompt (follow `EXPLANATION_MODEL_ID = "gemini-2.5-flash"` constant pattern)
- Score prompt structure (what criteria each dimension is graded on — planner to draft)
- Error state UI copy for "AI Assessment unavailable"
- Whether to use shadcn `Accordion` component or a lightweight custom expand/collapse

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §SCORE-01–06 — all score requirements; citations, schema validation, disclaimer label

### Roadmap
- `.planning/ROADMAP.md` §Phase 8 — 4 success criteria, requirements list, depends-on (Phase 6)

### Phase 6 context (generation patterns — MUST follow)
- `.planning/phases/06-ai-explanation-generation/06-CONTEXT.md` — D-07 (no pre-translation), D-08 (PSAK glossary injection), D-13 (reuse `gemini_file_resource_name`), D-14 (Vercel 60s timeout), D-15 (no-recommendation guard)

### Existing generation code (mirror these patterns)
- `src/lib/explain/explanation-schema.ts` — Zod schema + `EXPLANATION_RESPONSE_SCHEMA` pattern; create `score-schema.ts` as a sibling
- `src/lib/explain/generate-explanation.ts` — full `@google/genai` generation pattern (upload, waitForFileReady, stream accumulation, Zod parse); mirror for `generate-score.ts`
- `src/lib/ingest/analyze-document-batch.ts` — orchestration pattern (cache gate, soft/hard fail, status machine, upsert); extend this file to call score generation after explanation

### Existing UI (reuse and extend)
- `src/components/doc/explanation-panel.tsx` — score card prepended above `SECTION_ORDER` map; pass `score` prop
- `src/components/doc/citation-inline.tsx` — reuse for snippet citations inside accordion
- `src/components/doc/pdf-loading-skeleton.tsx` — pattern for score skeleton placeholder

### Database schema
- `src/db/database.types.ts` — `document_analysis` table: `score (number | null)`, `score_breakdown (Json | null)`, `score_reasoning (string | null)`, `score_at (string | null)` already exist — NO new migration needed for the column additions

### Internal route (follow pattern)
- `src/app/api/internal/analyze-batch/route.ts` — follow this route pattern exactly (internal secret header, POST only)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generate-explanation.ts` (`generateExplanation()`, `uploadFresh()`, `waitForFileReady()`):
  copy the Files API upload + waitForFileReady + re-upload fallback pattern for `generateScore()`
- `explanation-schema.ts` (`explanationSchema`, `EXPLANATION_RESPONSE_SCHEMA`):
  create a sibling `score-schema.ts` with `scoreSchema` Zod + `SCORE_RESPONSE_SCHEMA` raw JSON Schema
- `CitationInline`: already handles `[p.N]` click → PDF scroll; reuse inside accordion snippets
- `PdfLoadingSkeleton`: skeleton pattern for the score placeholder during analysis
- `globals.css` brand tokens (emerald-600 primary, zinc-100 muted): use for score number color
  and dimension card styling

### Established Patterns
- **`@google/genai` structured output**: `responseMimeType: "application/json"` + `responseSchema` +
  stream accumulation + Zod parse. Implemented in `generate-explanation.ts` — copy exactly.
- **Cache gate in orchestration**: `maybeSingle()` check → null means generate; non-null means skip.
  `analyze-document-batch.ts` lines 96–107 show the pattern; replicate for score cache check.
- **Soft fail vs. hard fail**: `softFailDocumentAnalyze()` vs `failDocumentAnalyze()` pattern in
  `analyze-document-batch.ts` — use the same functions for score soft-fail (D-02).
- **Upsert on `doc_id`**: `supabaseAdmin.from("document_analysis").upsert({...}, { onConflict: "doc_id" })`
  — same upsert for score columns alongside explanation upsert.

### Integration Points
- **Trigger point**: After `generateExplanation()` succeeds and explanation is upserted,
  call `generateScore()` — still inside `runAnalyzeBatch()`, before the `status → ready` transition.
- **Output columns**: Update `document_analysis` with `score`, `score_breakdown`, `score_reasoning`,
  `score_at` via upsert on `doc_id` (same row as explanation).
- **Consumer**: `src/app/doc/[documentId]/page.tsx` — RSC already queries `document_analysis`;
  extend `select()` to include `score, score_breakdown, score_reasoning`. Pass to `DocumentProgressView`.
- **`ExplanationPanel`**: receives `score` prop; score card renders as first child before the 5 sections.
- **`onGoToPage`**: already threaded through `DocumentReaderLayout → ExplanationPanel`; wire into
  score accordion snippets via the same prop.
- **shadcn Accordion**: not yet installed — `npx shadcn add accordion` before building score UI.

</code_context>

<specifics>
## Specific Ideas

- The score card should feel like a "verdict at a glance" — a prominent number (large, emerald-colored),
  then 4 compact dimension rows below. Each row shows the dimension name, a sub-score chip, and a
  one-sentence reasoning. Clicking a row expands the accordion.
- The quoted snippets in the accordion should look like pull-quotes — slightly inset, muted background,
  italic text — followed by the `[p.N]` link. Similar to the citation popover style from Phase 7.
- The `score_breakdown` column already exists as `Json | null` in the DB. The planner should define
  the exact JSON schema (suggested shape is in Claude's Discretion above) and create a Zod validator
  for it so the RSC can safely parse it before passing to the UI.

</specifics>

<deferred>
## Deferred Ideas

- **Vercel AI SDK `generateObject`** — ROADMAP mentioned this SDK for score generation; deferred in
  favor of `@google/genai` consistency. Could be revisited in Phase 11 (Observability) if adopting
  Vercel AI SDK for tracing.
- **Score regeneration UI** — A "Regenerate score" button for the user to request a fresh score.
  Deferred; cache-only in v1.
- **Score history / version tracking** — Showing how the score changes when a new version of the
  document is uploaded. Deferred to v2.
- **Color-coded score** — Red/yellow/green score number based on 1–4 / 5–7 / 8–10 range. Deferred;
  planner uses emerald (brand color) for the number in v1.

</deferred>

---

*Phase: 08-ai-score-drill-down*
*Context gathered: 2026-05-19*
