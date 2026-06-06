---
phase: 06-ai-explanation-generation
plan: "03"
subsystem: ai/explain
tags: [ai, gemini, supabase, ingest, server-only, tdd, streaming]
dependency_graph:
  requires:
    - src/lib/explain/explanation-schema.ts (Plan 01 — explanationSchema, EXPLANATION_RESPONSE_SCHEMA)
    - src/lib/explain/explain-prompts.ts (Plan 01 — EXPLANATION_MODEL_ID, buildExplanationPrompt)
    - supabase/migrations/20260517120000_explain_jsonb.sql (Plan 02 — document_analysis.explanation is jsonb)
  provides:
    - src/lib/explain/generate-explanation.ts (generateExplanation, isIndonesianDoc)
    - src/lib/ingest/analyze-document-batch.ts (runAnalyzeBatch, MAX_ANALYZE_BATCH_WALL_MS)
  affects:
    - Plan 04 (cron route imports runAnalyzeBatch; after() trigger imports MAX_ANALYZE_BATCH_WALL_MS)
    - Plan 05 (eval gate exercises generateExplanation with real Gemini calls)
tech_stack:
  added: []
  patterns:
    - TDD Wave 2: RED (test stubs) → GREEN (implementation) per task
    - Streaming accumulation before JSON.parse (Pitfall 1 — never parse partial chunks)
    - Files API reuse pattern from gemini-pdf-pages.ts: try cached resource, catch FAILED, re-upload
    - Status machine: analyzing → ready | failed | stays-analyzing-on-429
    - EXPLAIN-04 cache short-circuit: check document_analysis.explanation before calling Gemini
    - server-only import line 1 on all server-side modules (T-6-03 mitigation)
key_files:
  created:
    - src/lib/explain/generate-explanation.ts
    - src/lib/ingest/analyze-document-batch.ts
    - src/lib/explain/__tests__/generate-explanation.test.ts
    - src/lib/ingest/__tests__/analyze-document-batch.test.ts
  modified: []
decisions:
  - "waitForFileReady duplicated verbatim from gemini-pdf-pages.ts — intentional per project's Don't-Hand-Roll pattern; helper is small and stable, shared abstraction adds coupling risk"
  - "softFailDocumentAnalyze leaves status=analyzing (not a new status enum value) so existing cron LIMIT 1 query picks it up on next tick without schema change"
  - "generateExplanation does NOT write to Supabase — single responsibility; runAnalyzeBatch owns all persistence, making generateExplanation hermetically testable"
  - "pdfBytes always downloaded in runAnalyzeBatch (even when gemini_file_resource_name exists) — ensures re-upload path always has bytes available without a second DB round-trip"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
  tests_added: 17
---

# Phase 6 Plan 03: Generator + Batch Orchestrator Summary

**One-liner:** Gemini Files API streaming generator with Zod validation + orchestration batch function with EXPLAIN-04 cache short-circuit, 429-retry-friendly status machine, and jsonb upsert.

## What Was Built

Two server-only modules implementing the core AI explanation pipeline, plus unit test suites for both.

### generate-explanation.ts

- `generateExplanation(params)`: uploads PDF to Gemini Files API (or reuses cached `gemini_file_resource_name`), calls `ai.models.generateContentStream` with `responseSchema: EXPLANATION_RESPONSE_SCHEMA`, accumulates all chunks server-side before `JSON.parse` + `explanationSchema.parse(parsed)` (Zod validation). Returns `{ result: ExplanationResult, fileResourceName: string }` so the caller can persist a freshly-uploaded resource name.
- `isIndonesianDoc(extractionSource, firstPageText)`: null/gemini_files sources → true by default (OCR path implies Indonesian); unpdf path counts 7 ID stopwords in first 200 chars, returns true at >= 5 hits (TRANSLATE-01).
- Re-upload fallback: if `waitForFileReady` throws (FAILED state), falls through to `uploadFresh` when `pdfBytes` are available (Pitfall 2).
- Defensive markdown fence strip before `JSON.parse` (matches `gemini-pdf-pages.ts` pattern).

### analyze-document-batch.ts

- `runAnalyzeBatch({ docId })`: full orchestration — status gate (ready/non-analyzing skip), EXPLAIN-04 cache check against `document_analysis.explanation`, first-page chunk read for language detection, PDF download from Supabase Storage, `generateExplanation` call, jsonb upsert to `document_analysis` with `onConflict: "doc_id"`, `gemini_file_resource_name` update when Files API re-uploaded the PDF, final `status: "ready"` transition.
- `MAX_ANALYZE_BATCH_WALL_MS = 290_000`: Vercel Fluid Compute 300s ceiling minus 10s headroom.
- Error routing: `/(429|rate.?limit|quota|RESOURCE_EXHAUSTED)/i` → `softFailDocumentAnalyze` (leaves `status: "analyzing"` for cron retry); all other errors → `failDocumentAnalyze` (sets `status: "failed"`, `failed_at`).

## Tasks Completed

| Task | Name | Type | RED Commit | GREEN Commit | Files |
|------|------|------|------------|--------------|-------|
| 1 | generate-explanation.ts | feat (TDD) | 91da2d3 | ea7888c | generate-explanation.ts + test |
| 2 | analyze-document-batch.ts | feat (TDD) | 57553c4 | 2f4cecc | analyze-document-batch.ts + test |

## Test Results

```
Tests  17 passed (17) across 2 new test files
  - generate-explanation.test.ts: 9 tests
      * isIndonesianDoc: 5 tests (null, gemini_files, English, ID >=5 stopwords, ID <5 stopwords)
      * generateExplanation: 4 tests (reuse cache, fresh upload, Zod rejection, FAILED re-upload)
  - analyze-document-batch.test.ts: 8 tests
      * not found → { done: false }
      * status ready → skip Gemini, { done: true }
      * status embedding (wrong state) → skip Gemini, { done: true }
      * cache hit EXPLAIN-04 → skip Gemini, set ready, { done: true }
      * happy path → generateExplanation called, explanation upserted as object, status ready
      * 429 error → softFail (status stays analyzing), { done: false }
      * permanent error → failDocumentAnalyze (status failed, failed_at set), { done: false }
      * MAX_ANALYZE_BATCH_WALL_MS exported as number > 60s
```

All Phase 6 explain tests (33 total including Plan 01 tests) pass together.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm vitest run src/lib/explain/ src/lib/ingest/__tests__/analyze-document-batch.test.ts` | 33/33 PASS |
| `pnpm tsc --noEmit` | 0 errors |
| `grep -l "server-only" generate-explanation.ts analyze-document-batch.ts` | Both listed |
| `grep -c "generateContentStream" generate-explanation.ts` | 2 (declaration + call) |
| `grep -c "onConflict.*doc_id" analyze-document-batch.ts` | 1 |
| `wc -l generate-explanation.ts` | 194 lines (>= 80 required) |
| `wc -l analyze-document-batch.ts` | 189 lines (>= 80 required) |
| First line of both files | `import "server-only";` |
| `grep "console.log.*GEMINI_API_KEY" generate-explanation.ts` | 0 matches (no key leakage) |

## Requirements Covered

| Req ID | Status | How |
|--------|--------|-----|
| EXPLAIN-01 | Enforced | `explanationSchema.parse()` in `generateExplanation` — Zod rejects any missing/extra keys |
| EXPLAIN-02 | Wired | `buildExplanationPrompt(totalPages, isIndonesian)` called with `doc.total_pages` |
| EXPLAIN-04 | Verified | Cache short-circuit test confirms Gemini NOT called when explanation exists |
| EXPLAIN-05 | In place | `generateContentStream` primitive used; end-to-end "first section in 5s" validated in Plan 05 |
| TRANSLATE-01 | Wired | `isIndonesianDoc()` routes ID docs to PSAK glossary injection via `buildExplanationPrompt` |

## Deviations from Plan

None — plan executed exactly as written. TDD flow followed per task: RED → GREEN.

## Known Stubs

None. Both modules are production-ready. The only missing piece is the cron route wiring and `after()` trigger, which land in Plan 04 by design (keeps Plan 03 tests hermetic — no need to mock Vercel `after()` or fetch).

## Threat Flags

None. No new network endpoints or trust boundaries introduced beyond what the plan's threat model covers.

- T-6-01 (prompt injection): mitigated — PDF passed as binary `fileData` part via `createPartFromUri`, not interpolated as text.
- T-6-03 (API key leakage): mitigated — both files import `server-only` on line 1; `GEMINI_API_KEY` only used inside `new GoogleGenAI(...)` constructor, never logged.
- T-6-05 (malformed JSON): mitigated — `explanationSchema.parse()` throws on any deviation; caught by `runAnalyzeBatch` and routed to `failDocumentAnalyze`.

## Self-Check: PASSED

Files exist:
- FOUND: src/lib/explain/generate-explanation.ts
- FOUND: src/lib/ingest/analyze-document-batch.ts
- FOUND: src/lib/explain/__tests__/generate-explanation.test.ts
- FOUND: src/lib/ingest/__tests__/analyze-document-batch.test.ts

Commits exist:
- FOUND: 91da2d3 (Task 1 RED — generate-explanation test stubs)
- FOUND: ea7888c (Task 1 GREEN — generate-explanation.ts)
- FOUND: 57553c4 (Task 2 RED — analyze-document-batch test stubs)
- FOUND: 2f4cecc (Task 2 GREEN — analyze-document-batch.ts)
