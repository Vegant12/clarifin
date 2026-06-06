---
phase: 05-indonesian-eval-harness
plan: "01"
subsystem: eval-harness
tags: [eval, fixtures, idx, indonesian, gemini, wave-1]
dependency_graph:
  requires: []
  provides: [wave-1-baseline, eval-harness-verified]
  affects: [phase-06-planning]
tech_stack:
  added: []
  patterns: [eval-fixture-json, pnpm-eval-harness, vitest-offline-scorer]
key_files:
  created: []
  modified:
    - eval/README.md
decisions:
  - Wave-1 fixtures were pre-audited and already correct — no valueIDR or allowedPages corrections were needed
  - BBCA revenue definition confirmed as net interest income + non-interest operating income (pendapatan operasional), consistent with bank-revenue semantic rule
  - All three Wave-1 fixtures score at 100% numeric AND 100% citation — highest possible confidence in the baseline
metrics:
  duration_minutes: 12
  completed_date: "2026-05-14"
  tasks_completed: 3
  tasks_total: 4
  files_modified: 1
---

# Phase 05 Plan 01: Wave 1 Fixture Audit and Baseline Lock — Summary

Wave 1 audit of the three pre-existing `ready` fixtures (BBCA, TLKM, BISI). All three passed the live Gemini 2.5 Flash harness at 100% numeric and 100% citation with zero corrections required. `eval/README.md` now documents the baseline and the Phase 6 unblock path.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify offline scorer unit tests + run live harness | (no file changes) | vitest 3/3, pnpm eval Wave-1 ✓ |
| 2 | Audit-correct failing fixtures (no-op) | (no file changes) | All 3 fixtures were already correct |
| 3 | Document Wave 1 sign-off in eval/README.md | 21fe843 | eval/README.md |

## Per-Document Live Scores (from `/tmp/clarifin-wave1-eval-final.log`)

| Document | Numeric | Citation | Tolerance | Status |
|----------|---------|----------|-----------|--------|
| bbca-ar-bilingual-large-cap-digital | 5/5 (100.0%) | 3/3 (100.0%) | 0.5% | PASS |
| tlkm-ar-id-only-mid-cap-digital | 5/5 (100.0%) | 3/3 (100.0%) | 0.5% | PASS |
| small-cap-scanned-annual | 5/5 (100.0%) | 3/3 (100.0%) | 2.0% | PASS |

Six placeholder documents emitted `not_ready` rows as expected (Wave 2 work).

## Fixture Corrections Made

None. All three Wave-1 fixtures were pre-audited and already correctly reflect the consolidated financial statement figures from their respective PDFs with correct denomination multipliers and citation page windows.

## Offline Scorer Verification

`pnpm vitest run src/lib/eval/score-run.test.ts` — 3/3 tests passed, exit 0.

## Harness Code Integrity

No files under `src/lib/eval/`, `scripts/eval/`, or `eval/manifest.json` were modified. `git diff HEAD -- src/lib/eval/ scripts/eval/ eval/manifest.json` returned empty.

## Phase 6 Unblock Status

**Baseline locked. Aggregate gate still red until Wave 2 closes 6 placeholders.**

The three Wave-1 documents individually green at ≥90% (all at 100%) — the harness wiring is proven end-to-end. The full 9-document corpus `pnpm eval` exits 1 because six placeholders remain:

1. `bbcj-ar-variant-bilingual-large-cap-digital-b`
2. `mid-cap-quarterly-filing-id`
3. `long-form-annual-200p-plus`
4. `mid-cap-annual-manufacturing-id-digital`
5. `goto-class-small-cap-quarterly-pack`
6. `idx-mining-annual-heavy-tables-id`

Wave 2 (plan 05-02) provides PDFs + curated ground truth for these six to flip the aggregate exit code to 0.

## Deviations from Plan

None — plan executed exactly as written. Task 2 was explicitly a no-op per its action block condition ("If Task 1 reported zero failures...this task is a no-op"), which applied since all three Wave-1 documents scored at 100%/100%.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan only appended documentation to `eval/README.md`. The Gemini Files API was called by the existing harness (`scripts/eval/run.ts`) against public IDX PDFs — no PII involved. No new threat surface.

## Self-Check: PASSED

- [x] `eval/README.md` exists and contains `## Wave 1 baseline` heading
- [x] Commit 21fe843 exists in git log
- [x] All three Wave-1 fixture files unchanged and valid JSON
- [x] No harness code modified
- [x] `/tmp/clarifin-wave1-eval-final.log` contains 3 `✓` lines at 100%/100%
