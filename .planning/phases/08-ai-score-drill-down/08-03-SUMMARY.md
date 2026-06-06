---
phase: 08-ai-score-drill-down
plan: "03"
subsystem: score-generation-backend
tags: [gemini-files-api, structured-extraction, compliance-guard, zod-retry, soft-fail, tdd]
dependency_graph:
  requires:
    - 08-01 (waitForFileReady, uploadFresh exports, test stubs)
    - 08-02 (scoreSchema, SCORE_RESPONSE_SCHEMA, SCORE_MODEL_ID, buildScorePrompt, scanForInvestmentAdvice)
  provides:
    - src/lib/explain/generate-score.ts (generateScore, GenerateScoreParams, GenerateScoreResult)
    - runAnalyzeBatch extended with Step 8b: cache gate + score generation + retry + upsert + soft-fail
    - document_analysis.score, score_breakdown, score_at populated after every successful explanation run
  affects:
    - Plan 04 ScoreCard RSC (reads document_analysis.score + score_breakdown from DB)
    - Plan 04 page.tsx (renders ScoreCard component using ScoreResult type)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle for generate-score.ts (mirrors generate-explanation.ts pattern exactly)
    - vi.hoisted mock pattern for @google/genai in Vitest (same structure as generate-explanation.test.ts)
    - D-02 soft-fail: score errors caught inside try/catch loop; document still transitions to ready
    - D-03 cache gate: SELECT score before generating; skip if non-null
    - D-05 ZodError retry: for loop with attempt <= 2; only ZodError triggers retry
key_files:
  created:
    - src/lib/explain/generate-score.ts
  modified:
    - src/lib/explain/__tests__/generate-score.test.ts (replaced 5 it.todo stubs with 8 real tests)
    - src/lib/ingest/analyze-document-batch.ts (added import + Step 8b score block, lines 178-231)
decisions:
  - "generate-score.ts mirrors generate-explanation.ts line-for-line — same try/catch re-upload structure, same streaming accumulation pattern"
  - "pdfBytes was already in scope at insertion point (loaded in step 5); no refactor needed"
  - "fileResourceName is the return value of generateExplanation — reused directly per D-01 (same cron tick)"
  - "Compliance guard throws before return so non-compliant output never reaches document_analysis.score_breakdown"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 8 Plan 03: Score Generation Backend Summary

`generateScore()` implemented as a direct mirror of `generateExplanation()` — same Files API re-upload fallback, same streaming accumulation, adds compliance guard and Zod parse before return. `runAnalyzeBatch` extended with a score block (Step 8b) inserted between the explanation upsert and status→ready transition, honoring D-01 (same cron tick), D-02 (soft-fail), D-03 (cache gate), D-05 (1 ZodError retry).

## Tasks Completed

| Task | Name | Commit (RED) | Commit (GREEN) | Files |
|------|------|-------------|----------------|-------|
| 1 | generate-score.ts + activate tests (TDD) | 51c3d11 | cb6a116 | generate-score.ts, generate-score.test.ts |
| 2 | Wire generateScore into runAnalyzeBatch | — | 1887d6f | analyze-document-batch.ts |

## generate-score.ts Function Signature

```typescript
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

export async function generateScore(params: GenerateScoreParams): Promise<GenerateScoreResult>;
```

## Exact Insertion Location in analyze-document-batch.ts

- **Before insertion:** Line 159 — `// 8. Upsert explanation` block ends at line 176 (upsert error check returns `{ done: false }`)
- **Inserted block:** Lines 178–231 — Step 8b score generation block
- **After insertion:** Line 234 — `// 9. Transition to ready`

Score block is between explanation upsert (step 8) and status→ready (step 9) — confirmed by `grep` output showing `score_breakdown` at line 220 and `status: "ready"` transition at line 236.

## pdfBytes Scope

`pdfBytes` was **already in scope** at the insertion point — it is downloaded in step 5 (line 131: `const pdfBytes = new Uint8Array(await dl.data.arrayBuffer())`). No refactoring was needed. `fileResourceName` is the return value of `generateExplanation` (destructured at line 137), also already in scope.

## Test Count for generate-score.test.ts

| Test | Requirement |
|------|-------------|
| SCORE-01: calls @google/genai with SCORE_MODEL_ID and SCORE_RESPONSE_SCHEMA | SCORE-01 |
| SCORE-01: sets thinkingConfig.thinkingBudget = 0 in config | SCORE-01 |
| SCORE-01: returns parsed ScoreResult on happy path | SCORE-01 |
| SCORE-01: strips \`\`\`json fences before parse | SCORE-01 |
| SCORE-01: throws on empty stream | SCORE-01 |
| SCORE-05: throws on compliance violation in reasoning before returning | SCORE-05 |
| SCORE-05: throws on compliance violation in snippet text | SCORE-05 |
| SCORE-01: re-uploads PDF when fileResourceName resolution fails | SCORE-01 |

**Total: 8 passing tests.** All exit 0. `npx tsc --noEmit` exits 0.

## Deviations from Plan

### Auto-fix: Optional chaining in test mock.calls access (Rule 1 — TypeScript)

**Found during:** Task 1, post-implementation `tsc --noEmit` check

**Issue:** `generateContentStream.mock.calls[0][0]` produced `TS2532: Object is possibly 'undefined'` in two test assertions. The plan's concrete test body used direct array indexing.

**Fix:** Changed to `generateContentStream.mock.calls[0]?.[0]` with optional chaining in both affected assertions. Added `expect(call).toBeDefined()` guard before property access. No behavior change — tests still pass and verify the same contracts.

**Files modified:** `src/lib/explain/__tests__/generate-score.test.ts`

**Commit:** cb6a116

### No other deviations from AI-SPEC §3/§4

The plan's concrete implementation code was followed exactly. The score block insertion point and variable scope matched the plan's assumptions — `pdfBytes` and `fileResourceName` were both in scope without refactoring.

## Verification Results

- `npx vitest run generate-score.test.ts` — 8 PASSED
- `npx vitest run` (full suite) — 151 passed, 1 pre-existing failure in `explain-prompts.test.ts` (documented in Plan 02 deferred items, not introduced by this plan)
- `npx tsc --noEmit` — 0 errors
- `score_breakdown:` present in analyze-document-batch.ts — YES (line 220)
- `for (let attempt = 1; attempt <= 2; attempt` — YES (ZodError retry loop)
- `onConflict: "doc_id"` count — 2 (one for explanation upsert, one for score upsert)
- `ZodError` check — YES
- Score block before status→ready in source order — YES (lines 178–231 before line 236)
- `failDocumentAnalyze` NOT called for score failures — YES (score errors only console.error + break)

## Known Stubs

None. `generateScore` is fully implemented. The score block in `runAnalyzeBatch` writes real values to `document_analysis.score`, `score_breakdown`, and `score_at`.

## Threat Flags

None. No new network endpoints introduced. The trust boundaries from the plan's threat model are fully mitigated:

- T-08-03-01 (Tampering — LLM JSON output): `scoreSchema.parse()` runs inside `generateScore` before return; only validated `ScoreResult` is upserted.
- T-08-03-02 (Repudiation — OJK compliance): `scanForInvestmentAdvice` runs on every `dimension.reasoning` and every `snippet.text` before return. Compliance violation throws → caught by retry loop → after exhaustion, score stays null (D-02). Non-compliant output never reaches `document_analysis.score_breakdown`.
- T-08-03-03 (Hallucinated page values): `responseSchema` + Zod constrain `page` to `integer minimum: 1`.
- T-08-03-04 (DoS quota exhaustion): Caught by retry loop → soft-fail per D-02.
- T-08-03-05 (Upsert race): `onConflict: "doc_id"` enforced; cache gate prevents duplicate generation.

## Self-Check: PASSED

- `src/lib/explain/generate-score.ts` — EXISTS
- `src/lib/explain/__tests__/generate-score.test.ts` — EXISTS, 0 it.todo
- `src/lib/ingest/analyze-document-batch.ts` — MODIFIED with Step 8b block
- Commit `51c3d11` — EXISTS (test(08-03): RED generate-score)
- Commit `cb6a116` — EXISTS (feat(08-03): GREEN generate-score)
- Commit `1887d6f` — EXISTS (feat(08-03): wire generateScore into runAnalyzeBatch)
- `npx vitest run generate-score.test.ts` — 8 PASSED
- `npx tsc --noEmit` — 0 errors
