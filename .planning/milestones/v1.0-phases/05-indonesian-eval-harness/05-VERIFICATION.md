---
phase: 05-indonesian-eval-harness
verified: 2026-05-17T00:00:00Z
status: passed
score: 5/5
overrides_applied: 1
overrides:
  - must_have: "Running EVAL_PROMPT_VARIANT=broken pnpm eval exits non-zero with sub-threshold percentages, proving the gate is live and not decorative"
    reason: "Broken-prompt run exited 1 due to quota exhaustion (not scoring failure), but exit 1 is the correct observable — gate non-decorative nature is independently proven by Vitest unit tests covering scoreDocument/withinTolerance with broken-prompt fixture values, and structurally by the run.ts code path which exits 1 on any API error. Scoring failure path verified offline."
    accepted_by: "hovegant"
    accepted_at: "2026-05-17T00:00:00Z"
---

# Phase 5: Indonesian Eval Harness — Verification Report

**Phase Goal:** 9-document eval set, numeric + citation accuracy harness, Phase 6 gate
**Verified:** 2026-05-17
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 9 fixture files in `eval/fixtures/` have `fixtureStatus: "ready"` with non-empty `numericExpectations` and `citationExpectations` | VERIFIED | All 9 JSON files present; each has `fixtureStatus: "ready"`, exactly 5 `numericExpectations`, and exactly 3 `citationExpectations` — confirmed by direct inspection |
| 2 | All 9 PDFs are physically present in `eval/pdfs/` with the exact filenames declared in `eval/manifest.json` | VERIFIED | All 9 PDFs present with exact filenames from manifest; sizes range from 1.4 MB to 51 MB — all non-empty |
| 3 | `pnpm eval` against the full 9-document corpus exits 0 with overall numeric ≥90% AND overall citation ≥90% | VERIFIED | Documented executor run: numeric 97.8% (44/45), citation 92.6% (25/27) — both above 90% threshold; math independently cross-verified from per-document table; run.ts exit logic confirmed in code |
| 4 | `EVAL_PROMPT_VARIANT=broken pnpm eval` exits non-zero, proving the gate is live and not decorative | PASSED (override) | Override: Broken-prompt run exited 1 due to Gemini quota exhaustion after full-corpus run (correct exit code observed); Vitest unit tests in `score-run.test.ts` verify scoreDocument returns 0 hits when broken-prompt values (valueIDR=789, pages=[424242]) are used; run.ts exits 1 on any non-ok row or API error — gate logic is non-decorative by construction — accepted by hovegant on 2026-05-17 |
| 5 | Phase 6 may begin implementation — the eval gate is now operational | VERIFIED | `eval/README.md` contains explicit "Phase 6 gate status: `pnpm eval` exits 0. Phase 6 (AI Explanation Generation) may proceed." statement locked 2026-05-14; 05-02-SUMMARY confirms dependency_graph `provides: [phase-6-cleared]` |

**Score:** 5/5 truths verified (1 via accepted override)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `eval/fixtures/bbca-ar-bilingual-large-cap-digital.json` | ready, 5 numeric, 3 citation | VERIFIED | Confirmed |
| `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` | ready, 5 numeric, 3 citation | VERIFIED | Confirmed |
| `eval/fixtures/small-cap-scanned-annual.json` | ready, 5 numeric, 3 citation | VERIFIED | Confirmed |
| `eval/fixtures/bbcj-ar-variant-bilingual-large-cap-digital-b.json` | ready, 5 numeric, 3 citation | VERIFIED | Confirmed |
| `eval/fixtures/mid-cap-quarterly-filing-id.json` | ready, 5 numeric, 3 citation | VERIFIED | Confirmed |
| `eval/fixtures/long-form-annual-200p-plus.json` | ready, 5 numeric, 3 citation | VERIFIED | Confirmed |
| `eval/fixtures/mid-cap-annual-manufacturing-id-digital.json` | ready, 5 numeric, 3 citation | VERIFIED | Confirmed |
| `eval/fixtures/goto-class-small-cap-quarterly-pack.json` | ready, 5 numeric, 3 citation | VERIFIED | Confirmed; negative numeric values (net loss, negative OCF) present |
| `eval/fixtures/idx-mining-annual-heavy-tables-id.json` | ready, 5 numeric, 3 citation | VERIFIED | Confirmed |
| `eval/pdfs/bbca-ar-bilingual-large-cap-digital.pdf` | Non-empty PDF | VERIFIED | 4,349,103 bytes |
| `eval/pdfs/tlkm-ar-id-only-mid-cap-digital.pdf` | Non-empty PDF | VERIFIED | 3,045,771 bytes |
| `eval/pdfs/small-cap-scanned-annual.pdf` | Non-empty PDF | VERIFIED | 5,599,529 bytes |
| `eval/pdfs/mid-cap-quarterly-filing-id.pdf` | Non-empty PDF | VERIFIED | 2,012,997 bytes |
| `eval/pdfs/long-form-annual-200p-plus.pdf` | Non-empty PDF | VERIFIED | 12,714,087 bytes |
| `eval/pdfs/bbcj-ar-variant-bilingual-large-cap-digital-b.pdf` | Non-empty PDF | VERIFIED | 6,703,314 bytes |
| `eval/pdfs/mid-cap-annual-manufacturing-id-digital.pdf` | Non-empty PDF | VERIFIED | 2,294,757 bytes |
| `eval/pdfs/goto-class-small-cap-quarterly-pack.pdf` | Non-empty PDF | VERIFIED | 1,389,511 bytes |
| `eval/pdfs/idx-mining-annual-heavy-tables-id.pdf` | Non-empty PDF | VERIFIED | 50,972,362 bytes |
| `eval/manifest.json` | 9 document entries | VERIFIED | Exactly 9 entries, each with id, relativePdf, relativeGroundTruth |
| `eval/README.md` | Wave 2 sign-off + Phase 6 gate | VERIFIED | Contains "Wave 2 gate live" (line 68) and "Phase 6 gate status" (line 103) |
| `src/lib/eval/score-run.ts` | Scoring logic with withinTolerance | VERIFIED | `withinTolerance` uses `Math.abs(expected)` denominator — handles negative values correctly for GOTO |
| `src/lib/eval/score-run.test.ts` | 3 passing Vitest tests | VERIFIED | Tests cover: 100%/100% perfect extraction, 0%/0% broken extraction (value=789, page=424242), weighted aggregate gate at boundary |
| `src/lib/eval/prompts.ts` | PROMPT_EVAL_BROKEN defined | VERIFIED | Broken prompt instructs model to set valueIDR=789 and cite page 424242 — guaranteed to score 0% against real fixtures |
| `scripts/eval/run.ts` | Gate exits 1 on non-ok row or threshold miss | VERIFIED | Three separate `process.exit(1)` paths: placeholder fixture, missing PDF/fixture, and threshold miss |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/eval/run.ts` | `src/lib/eval/score-run.ts` | `aggregateScores`, `scoreDocument` imports | WIRED | Direct import confirmed; both functions called in main() |
| `scripts/eval/run.ts` | `EVAL_PROMPT_VARIANT` env var | `promptVariant` branch at line 38 | WIRED | `process.env.EVAL_PROMPT_VARIANT === "broken"` routes to degraded prompt |
| `scripts/eval/run.ts` | `eval/manifest.json` | `loadManifest(evalRoot)` | WIRED | Reads manifest, iterates all 9 documents |
| `run.ts` exit gate | `aggregateScores` result | `!aggregate.passNumeric || !aggregate.passCitation` | WIRED | exit(1) at line 160 when either threshold not met |
| `PROMPT_EVAL_BROKEN` | scoring failure | values 789 + page 424242 guaranteed mismatch | WIRED | scoreDocument test case confirms 0 hits for these values |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase produces eval infrastructure (scripts, fixtures, PDFs), not UI components rendering dynamic data.

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|---------|--------|
| Full corpus exits 0 at 97.8%/92.6% | Documented executor log; per-document table in 05-02-SUMMARY.md; math cross-verified (44/45 numeric, 25/27 citation) | PASS |
| Broken-prompt exits 1 | Exit code 1 observed (quota-exhaustion error); Vitest tests confirm scoring path produces 0 hits for broken values | PASS (via override) |
| Fixture validation enforces non-empty expectations | `validateReadyFixture()` in run.ts; run.ts exits 1 if numericExpectations or citationExpectations is empty on a ready fixture | PASS |
| Manifest-to-PDF-to-fixture data flow complete | All 9 manifest entries resolve to existing, non-empty PDF and fixture files | PASS |

---

### Requirements Coverage

No formal requirement IDs were declared in the phase plans. The phase goal and success criteria are drawn from ROADMAP.md and are fully satisfied per the truth verification above.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| None | — | — | No stubs, placeholder implementations, or TODO markers found in harness code or fixture files |

All 9 fixture files have `fixtureStatus: "ready"` with fully populated expectations. No fixture retains placeholder values.

---

### Human Verification Required

None. All truths are verifiable from code structure, fixture content, file presence, and documented executor run output. Visual/UX verification is not applicable to an eval harness phase.

---

### Aggregate Score Math (Independent Cross-Check)

The claimed scores of 97.8% numeric and 92.6% citation were independently verified against the per-document table in 05-02-SUMMARY.md:

- Numeric hits: 5+5+5+4+5+5+5+5+5 = 44 out of 45 total (9 docs x 5 expectations) = **97.8%**
- Citation hits: 3+3+3+3+3+3+3+3+1 = 25 out of 27 total (9 docs x 3 expectations) = **92.6%**

Both are above the 90% gate threshold. The aggregate logic in `aggregateScores()` uses weighted sums (not per-document averages), which matches this calculation.

---

### Gaps Summary

No gaps. All 5 must-have truths are satisfied. Truth #4 (broken-prompt gate) is marked PASSED (override) because the correct exit code (1) was observed and the gate logic is demonstrably non-decorative by code inspection and Vitest coverage — the quota-exhaustion failure mode is a different failure path but still the correct observable outcome.

---

_Verified: 2026-05-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
