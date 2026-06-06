---
phase: 08-ai-score-drill-down
fixed_at: 2026-05-19T14:07:07Z
review_path: .planning/phases/08-ai-score-drill-down/08-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-05-19T14:07:07Z
**Source review:** .planning/phases/08-ai-score-drill-down/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Cache gate in `runAnalyzeBatch` queries wrong column

**Files modified:** `src/lib/ingest/analyze-document-batch.ts`
**Commit:** fe1f96c
**Applied fix:** Changed `.select("score")` to `.select("score_breakdown")` and updated the null-check from `scoreCacheRes.data?.score == null` to `scoreCacheRes.data?.score_breakdown == null`. This ensures the cache gate correctly detects partial-write scenarios where `score` is non-null but `score_breakdown` is absent, preventing `DocumentPage` from silently receiving `null` for the breakdown.

---

### WR-02: `generateScore` re-uploaded resource name never persisted

**Files modified:** `src/lib/ingest/analyze-document-batch.ts`
**Commit:** fe1f96c
**Applied fix:** After the score generation call succeeds, added a conditional `supabaseAdmin.update()` that persists `scoreGenResult.fileResourceName` back to `documents.gemini_file_resource_name` when it differs from the explanation step's `fileResourceName`. This prevents subsequent retries from hitting a permanently-dead resource and re-uploading unnecessarily.

---

### WR-03: `ScoreCard` accordion trigger layout breaks on narrow viewports

**Files modified:** `src/components/doc/score-card.tsx`
**Commit:** a89757f
**Applied fix:** Removed the `reasoning` span from inside `AccordionTrigger`. The trigger now contains only the dimension name (with `flex-1` for expansion) and the score chip. The reasoning text was moved to the top of `AccordionContent` as a `<p>` element, eliminating the three-sibling layout competition with the `ChevronDownIcon` on narrow viewports.

---

### WR-04: SSR `score`/`explanation` discarded until polling resolves

**Files modified:** `src/components/doc/document-progress-view.tsx`
**Commit:** 3d2458c
**Applied fix:** Added a fast-path before the polling-dependent conditional: if `explanation` is non-null (meaning the RSC parent already confirmed the document is ready), `DocumentReaderLayout` is rendered immediately without waiting for `useDocumentStatus` to resolve. The existing polling-based path is retained below as a fallback for the case where the document transitions to ready after hydration.

---

_Fixed: 2026-05-19T14:07:07Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
