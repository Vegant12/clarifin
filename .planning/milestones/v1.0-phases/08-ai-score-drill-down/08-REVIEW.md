---
phase: 08-ai-score-drill-down
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/app/doc/[documentId]/page.tsx
  - src/components/doc/__tests__/score-card.test.tsx
  - src/components/doc/document-progress-view.tsx
  - src/components/doc/document-reader-layout.tsx
  - src/components/doc/explanation-panel.tsx
  - src/components/doc/mobile-tab-view.tsx
  - src/components/doc/score-card.tsx
  - src/components/doc/score-loading-skeleton.tsx
  - src/components/ui/accordion.tsx
  - src/lib/explain/__tests__/generate-score.test.ts
  - src/lib/explain/__tests__/score-prompts.test.ts
  - src/lib/explain/__tests__/score-schema.test.ts
  - src/lib/explain/generate-score.ts
  - src/lib/explain/score-prompts.ts
  - src/lib/explain/score-schema.ts
  - tests/components/explanation-panel.test.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

This phase delivers the AI score generation backend (`generate-score.ts`, `score-schema.ts`, `score-prompts.ts`), the `ScoreCard` UI component with accordion drill-down, and wiring through `ExplanationPanel`, `DocumentReaderLayout`, and `MobileTabView`. The core logic is well-structured: the Zod schema is tight, the compliance guardrail is correctly placed after parse and before persist, and the soft-fail path in `analyze-document-batch.ts` means a missing score never blocks document delivery.

Four warnings were found — none are crashes in normal operation, but two are silent-failure risks and two are behavioral edge cases that could confuse users. No critical security or data-integrity issues were identified.

---

## Warnings

### WR-01: Cache gate in `runAnalyzeBatch` queries wrong column — always re-generates score

**File:** `src/lib/ingest/analyze-document-batch.ts:183-187`

**Issue:** The score cache check selects the `score` column, but the upsert at line 219 writes both `score` (the integer) and `score_breakdown` (the full JSON). On a retry run where the explanation already exists but `score` is non-null while `score_breakdown` is null (e.g. a partial write, or an earlier schema migration), the gate would skip regeneration even though `score_breakdown` is absent — causing `DocumentPage` at line 27 to silently get `null` for the breakdown and render the "AI Assessment unavailable" fallback despite a score being present.

More practically: because the page at `src/app/doc/[documentId]/page.tsx` fetches `score_breakdown` (not `score`) to populate `ScoreResult`, the cache gate should check `score_breakdown IS NULL`, not `score IS NULL`, to guarantee both columns are populated before skipping.

**Fix:**
```ts
// analyze-document-batch.ts line ~182
const scoreCacheRes = await supabaseAdmin
  .from("document_analysis")
  .select("score_breakdown")    // was: "score"
  .eq("doc_id", docId)
  .maybeSingle();

if (!scoreCacheRes.error && scoreCacheRes.data?.score_breakdown == null) {
  // ... proceed with score generation
}
```

---

### WR-02: `generateScore` silently treats an unresolved `uri` as empty string if `waitForFileReady` returns `undefined`

**File:** `src/lib/explain/generate-score.ts:43-45`

**Issue:** `waitForFileReady` (defined in `generate-explanation.ts`) returns `{ uri: string; mimeType: string }`. The `uri` field is guaranteed non-empty by its own guard at line 41-43 of `generate-explanation.ts`. However, the `generate-score.ts` catch block at lines 57-62 re-uploads when *any* error is thrown — including a `"Gemini file has no URI."` error from `waitForFileReady`. In that scenario `resourceName` is set from `params.fileResourceName` (line 44) but `uri` is never assigned, so TypeScript's control-flow analysis would flag `uri` as potentially uninitialized if strict null checks applied to the variable declaration.

In practice TypeScript accepts this because `uri` is declared `let uri: string` and the three assignment paths (lines 45, 53, 61) fully cover the non-error paths before use at line 72. The real issue is narrower: if `params.fileResourceName` resolves to a file that is permanently `FAILED` (not a transient error), `waitForFileReady` throws, the catch re-uploads using `pdfBytes`, but then the returned `fileResourceName` in `GenerateScoreResult` is the *new* resource name from `uploadFresh` — while `analyze-document-batch.ts` line 151 already persisted the *old* resource name from the explanation step. The score step's new resource name is never persisted back to `documents.gemini_file_resource_name`, so the next retry will again hit the dead resource and re-upload unnecessarily.

**Fix:** In `runAnalyzeBatch`, after the score generation call, persist the score step's `fileResourceName` the same way the explanation step does (lines 151-156):

```ts
// analyze-document-batch.ts, after line 200 (scoreGenResult = await generateScore(...))
if (scoreGenResult && scoreGenResult.fileResourceName !== fileResourceName) {
  await supabaseAdmin
    .from("documents")
    .update({ gemini_file_resource_name: scoreGenResult.fileResourceName })
    .eq("id", docId);
}
```

---

### WR-03: `ScoreCard` accordion trigger layout breaks when `dim.reasoning` is very short or empty (schema allows 1 char)

**File:** `src/components/doc/score-card.tsx:46-55`

**Issue:** The `AccordionTrigger` child `<div>` has three siblings: name (`text-sm font-semibold`), the score chip (`rounded-full bg-primary`), and a `flex-1` reasoning span. The `AccordionTrigger` from `accordion.tsx` renders the children followed by a `<ChevronDownIcon>` appended after them (line 44 of `accordion.tsx`). Because the outer trigger uses `flex` with `items-start justify-between`, the chevron ends up positioned alongside the rightmost child of the inner `<div>` and the `justify-between` on the *inner* `<div>` competes with the trigger's own flex layout, potentially causing the chevron to overlay the reasoning text on narrow viewports.

Additionally, `dim.reasoning` is typed `z.string().min(1)` — so it is at minimum 1 character. Under the `line-clamp-2` class the reasoning text will overflow-hide correctly; however, the `flex-1 ... ml-2` span sits between the chip and the chevron icon, so at very narrow widths (< 360 px mobile) the layout will compress the chip into the score number.

This is not a crash but is a layout defect visible in production on low-end Android phones common in the Indonesian market.

**Fix:** Move the `reasoning` text out of the trigger row and into the `AccordionContent` block, or constrain the trigger row to just name + chip + chevron:

```tsx
// score-card.tsx AccordionTrigger child — simplified trigger row
<AccordionTrigger aria-label={`Expand ${dim.name} details`}>
  <div className="flex w-full items-center gap-2 pr-2">
    <span className="text-sm font-semibold text-foreground flex-1">{dim.name}</span>
    <span className="rounded-full bg-primary px-2 py-1 text-primary-foreground text-xs font-semibold">
      {`[${dim.score}/10]`}
    </span>
  </div>
</AccordionTrigger>
<AccordionContent>
  <p className="text-sm text-foreground mb-2">{dim.reasoning}</p>
  {/* snippets below */}
</AccordionContent>
```

---

### WR-04: `DocumentProgressView` renders `DocumentReaderLayout` only when `data?.status === "ready"` — pre-loaded SSR `score` is discarded if polling hasn't resolved yet

**File:** `src/components/doc/document-progress-view.tsx:47-51`

**Issue:** The RSC parent (`page.tsx`) fetches `score` from Supabase and passes it as a prop. `DocumentProgressView` passes it straight through to `DocumentReaderLayout` (line 49), but `DocumentReaderLayout` is only rendered once `data?.status === "ready"` from the polling hook. If the document is already `ready` in Supabase at SSR time but the initial `useDocumentStatus` poll has not yet resolved (i.e., `data` is still `undefined`), the page renders the progress skeleton instead of the reader for the first render cycle, then switches immediately once the first poll returns. This causes a brief flash of the loading state on a document that is already complete.

More importantly: if `sessionToken` is null on the first render (before `useEffect` fires, line 34), `useDocumentStatus` is disabled (`enabled: mounted && hasToken && ...`). So on hydration the page always shows the skeleton, even with SSR-fetched score data already in hand. The SSR data cannot be displayed until polling confirms status.

This is an existing structural pattern (not introduced in phase 08), but the phase 08 addition of `score` data makes the regression more visible: a returning user navigating directly to a finished document's URL will see "Processing your document" briefly before the reader loads.

**Fix:** Add a fast-path: if the SSR-provided `explanation` is non-null, render `DocumentReaderLayout` immediately without waiting for polling, and let polling run in the background to handle the edge case where the page was served stale:

```tsx
// document-progress-view.tsx — add before the polling-based early return
if (explanation) {
  return (
    <DocumentReaderLayout documentId={documentId} explanation={explanation} pdfUrl={pdfUrl} score={score} />
  );
}
```

---

## Info

### IN-01: `contents` array in `generateScore` wraps items as mixed types — inconsistent with SDK contract

**File:** `src/lib/explain/generate-score.ts:72`

**Issue:** `createPartFromUri(uri, mimeType)` returns a `Part` object. The second element `{ text: prompt }` is an inline object literal, not a `Part`. The `generate-explanation.ts` file uses the same pattern (line 174), so this is consistent within the codebase, but if the `@google/genai` SDK tightens its `contents` typing in a future minor version this could produce a type error. Prefer wrapping both items as `Part` objects or using a `Content` wrapper for clarity.

---

### IN-02: `ScoreLoadingSkeleton` is imported in `explanation-panel.tsx`? — component is defined but usage is not visible in the reviewed files

**File:** `src/components/doc/score-loading-skeleton.tsx`

**Issue:** `ScoreLoadingSkeleton` is defined but its import site is not visible in the reviewed files. `ExplanationPanel` renders either `<ScoreCard>` or a static "AI Assessment unavailable" message — there is no loading state shown while score data is pending. If the score is expected to load asynchronously after the explanation is displayed, the skeleton would need to be used. If the design intent is that the score is always available by the time the reader renders (because it is fetched server-side in `page.tsx`), the skeleton is dead code and can be removed.

---

### IN-03: Hardcoded dimension names in `ScoreCard` are not validated against the schema's `name` field

**File:** `src/components/doc/score-card.tsx:44`

**Issue:** `ScoreCard` renders `dim.name` from `ScoreResult.dimensions[*].name` which is typed as `string` (not a union of the four expected values). The schema in `score-schema.ts` only enforces `z.string().min(1)` — the Gemini response could return a dimension with a different name (e.g. "Liquidity" instead of "Balance Sheet") and `ScoreCard` would render it without error. This is not a crash but means the UI could display unexpected names.

If the four dimension names are canonical (as stated in the `SCORE_RESPONSE_SCHEMA` description field and test fixtures), consider adding a Zod `.refine()` on dimension names or a `z.enum(...)` to enforce them.

---

### IN-04: Commented-out TODO left in production server component

**File:** `src/app/doc/[documentId]/page.tsx:35`

**Issue:** `// TODO(phase-12): validate session ownership server-side in RSC before exposing explanation + signed URL.` — this is a tracked deferred security task. The TODO is already well-scoped but is worth flagging so it appears in the review record. Without this check, any user who guesses or obtains a valid `documentId` UUID can retrieve the explanation and a 1-hour signed S3 URL for the original PDF. At v1 with no auth this is acceptable, but the risk surface grows once session tokens are enforced.

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
