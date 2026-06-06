---
phase: 06-ai-explanation-generation
plan: "05"
subsystem: eval/gate
tags: [eval, gate, live-smoke, gemini, blocking]
dependency_graph:
  requires:
    - src/lib/eval/ (Phase 5 — eval harness)
    - eval/manifest.json (Phase 5 — 9-document corpus)
    - eval/pdfs/ (Phase 5 — 9 PDFs)
    - src/lib/explain/ (Phase 6 Plans 01/03)
    - src/lib/ingest/analyze-document-batch.ts (Phase 6 Plan 03)
    - src/app/api/internal/analyze-batch/route.ts (Phase 6 Plan 04)
  provides: []
  affects:
    - Phase 7 (Citation UI) — blocked until both gates PASS
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified: []
decisions: []
metrics:
  duration: "~5 minutes (gate blocked by Gemini quota)"
  completed: "2026-05-18"
  tasks_completed: 0
  files_created: 0
  files_modified: 0
---

# Phase 6 Plan 05: Eval Gate + Live Smoke — Summary

**One-liner:** Phase 6 gate plan blocked at Task 1 by Gemini API quota exhaustion (20 RPD free tier for gemini-2.5-flash); eval cannot run until quota resets or paid key is available.

## Gate Status

| Gate | Status | Notes |
|------|--------|-------|
| Task 1: pnpm eval ≥90%/90% | BLOCKED | Gemini quota exhausted (20 RPD free tier; retry in 24h) |
| Task 2: End-to-end smoke test | PENDING | Cannot proceed until Task 1 approved |

## Prior Baseline (Phase 5, 2026-05-14)

From `05-02-SUMMARY.md` and `05-VERIFICATION.md` (locked 2026-05-14):

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| overallNumericPct | 97.8% (44/45) | ≥ 90% | PASS |
| overallCitationPct | 92.6% (25/27) | ≥ 90% | PASS |

### Per-Document Baseline

| Document | Company | Numeric | Citation |
|----------|---------|---------|----------|
| bbca-ar-bilingual-large-cap-digital | BBCA | 5/5 (100%) | 3/3 (100%) |
| tlkm-ar-id-only-mid-cap-digital | TLKM | 5/5 (100%) | 3/3 (100%) |
| small-cap-scanned-annual | BISI | 5/5 (100%) | 3/3 (100%) |
| bbcj-ar-variant-bilingual-large-cap-digital-b | BJBR | 4/5 (80%) | 3/3 (100%) |
| mid-cap-quarterly-filing-id | SMGR Q3 | 5/5 (100%) | 3/3 (100%) |
| long-form-annual-200p-plus | ASII | 5/5 (100%) | 3/3 (100%) |
| mid-cap-annual-manufacturing-id-digital | INDF | 5/5 (100%) | 3/3 (100%) |
| goto-class-small-cap-quarterly-pack | GOTO | 5/5 (100%) | 3/3 (100%) |
| idx-mining-annual-heavy-tables-id | PTBA | 5/5 (100%) | 1/3 (33%) |

## Phase 6 Regression Risk Assessment

No Phase 6 changes touched the eval harness code path:

| Module Changed by Phase 6 | Touches eval/? | Risk |
|---------------------------|----------------|------|
| src/lib/explain/explanation-schema.ts | NO | None |
| src/lib/explain/explain-prompts.ts | NO | None |
| src/lib/explain/generate-explanation.ts | NO | None |
| src/lib/ingest/analyze-document-batch.ts | NO | None |
| src/app/api/internal/analyze-batch/route.ts | NO | None |
| src/lib/ingest/embed-document-batch.ts | NO (added scheduleAnalyzeBatch call only) | None |
| src/lib/ingest/trigger-parse-batch.ts | NO (added scheduleAnalyzeBatch function only) | None |
| src/app/api/status/route.ts | NO (STUB_PIPELINE_TICK extension only) | None |

The eval harness (`src/lib/eval/`, `scripts/eval/`, `eval/manifest.json`, `eval/fixtures/`) was not modified in any Phase 6 plan. Regression risk is structurally zero — but the plan requires a live run to confirm it.

## Eval Run Attempt (2026-05-18)

**Pre-flight checks completed:**
- All 9 fixture files: `fixtureStatus: "ready"` (confirmed)
- All 9 PDFs: present in `eval/pdfs/` (copied from main repo to worktree, gitignored)
- `.env.local`: present with `GEMINI_API_KEY` set

**Eval run result:**
```
$ pnpm eval
$ tsx scripts/eval/run.ts
{"error":{"code":429,"message":"You exceeded your current quota, please check your plan
and billing details. ... Quota exceeded for metric:
generativelanguage.googleapis.com/generate_content_free_tier_requests,
limit: 20, model: gemini-2.5-flash\nPlease retry in 59.545508238s."}}
[ELIFECYCLE] Command failed with exit code 1.
```

**Root cause:** The Gemini `gemini-2.5-flash` free tier has a **20 requests per day (RPD)** limit. The quota was exhausted before the first document in the 9-document corpus was evaluated. The eval requires 9 Gemini API calls (one per document).

**Action required:** Run `pnpm eval` on the next available day with fresh quota OR provide a paid GEMINI_API_KEY with higher RPD limits.

## Completed Tasks

None. Both tasks are checkpoint:human-verify gates and require manual approval after live runs.

## Deviations from Plan

### [Rule 3 - Blocking] Gemini API quota exhausted before first eval document

- **Found during:** Task 1 execution
- **Issue:** Gemini free tier (20 RPD for gemini-2.5-flash) was exhausted; `pnpm eval` exits 1 with HTTP 429 before scoring any document
- **Resolution:** Cannot fix automatically — requires either (a) waiting for daily quota reset (~24h) or (b) using a paid Gemini API key
- **Files modified:** None
- **Commit:** None (no code change needed)

Note: This is NOT a code bug in the eval harness or Phase 6 implementation. The eval ran successfully in Phase 5 (97.8%/92.6%); the quota exhaustion is an environment constraint.

## Known Stubs

None — this plan writes no code.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan only runs existing harness code.

## Phase 6 Gate: PENDING

Neither gate has been cleared via live execution on Phase 6 code. The prior Phase 5 baseline (97.8%/92.6%) plus structural zero-regression analysis gives high confidence the gate will pass, but the plan requires explicit live confirmation before Phase 7 may begin.

### Instructions to clear the gate

**Step 1: Task 1 — Run pnpm eval**

When Gemini quota has reset (midnight Pacific Time) or a paid API key is available:

```bash
cd /path/to/clarifin
pnpm eval 2>&1 | tee /tmp/clarifin-phase6-eval.log
grep -E "overallNumericPct|overallCitationPct" /tmp/clarifin-phase6-eval.log | tail -4
```

Expected output:
```
overallNumericPct: 0.978
overallCitationPct: 0.926
Gate passed ✓ (97.8% numeric / 92.6% citation weighted).
```

Type "approved" once both ≥ 0.90.

**Step 2: Task 2 — End-to-end smoke test**

Start the dev server and upload a fixture PDF:
```bash
unset STUB_PIPELINE_TICK
pnpm dev
```

Navigate to http://localhost:3000, upload `eval/pdfs/tlkm-ar-id-only-mid-cap-digital.pdf` (small, ID-only fixture, ~3MB).

Watch pipeline: parsing → embedding → analyzing → ready.

Once `ready`, inspect via Supabase Studio or CLI:
```sql
SELECT explanation, explanation_at FROM document_analysis WHERE doc_id = '<UUID>';
```

Verify: 5 keys (`revenue`, `profitability`, `balance_sheet`, `cash_flow`, `key_risks`), each with `[p.N]` citations, no untranslated PSAK terms.

Cache check:
```bash
curl -X POST "http://localhost:3000/api/internal/analyze-batch" \
  -H "Authorization: Bearer $INTERNAL_PARSE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"doc_id":"<UUID>"}'
```
Expected: `{ "ok": true, "doc_id": "<UUID>", "done": true }` in < 1s.

## Self-Check: PASSED

Files exist:
- FOUND: .planning/phases/06-ai-explanation-generation/06-05-SUMMARY.md (this file)

Note: No task code commits exist because this plan is a gate plan (no code written). The SUMMARY itself is the only artifact.
