---
phase: 08-ai-score-drill-down
plan: "02"
subsystem: score-schema-and-prompts
tags: [zod, json-schema, score, prompt-engineering, compliance-guardrail, tdd]
dependency_graph:
  requires:
    - 08-01 (test stubs, langfuse, accordion)
  provides:
    - src/lib/explain/score-schema.ts (scoreSchema, ScoreResult, SCORE_RESPONSE_SCHEMA)
    - src/lib/explain/score-prompts.ts (SCORE_MODEL_ID, buildScorePrompt, scanForInvestmentAdvice)
    - 27 passing tests across score-schema.test.ts and score-prompts.test.ts
  affects:
    - Plan 03 generate-score.ts (imports all 5 exports)
    - Plan 04 ScoreCard / page.tsx (imports ScoreResult type)
tech_stack:
  added: []
  patterns:
    - Dual Zod + raw JSON Schema co-located in one file (mirrors explanation-schema.ts pattern)
    - Word-boundary regex (\b) for OJK compliance blocklist scan
    - TDD RED/GREEN cycle with per-phase commits
key_files:
  created:
    - src/lib/explain/score-schema.ts
    - src/lib/explain/score-prompts.ts
  modified:
    - src/lib/explain/__tests__/score-schema.test.ts (replaced 10 it.todo stubs + removed scanForInvestmentAdvice block)
    - src/lib/explain/__tests__/score-prompts.test.ts (replaced 5 it.todo stubs + added scanForInvestmentAdvice tests)
decisions:
  - "SCORE_MODEL_ID is 'gemini-2.5-flash' — intentionally NOT inherited from EXPLANATION_MODEL_ID ('gemini-2.0-flash'); per AI-SPEC §4"
  - "scanForInvestmentAdvice moved to score-prompts.ts (not score-schema.ts) — function is about prompt compliance, not schema validation"
  - "Word-boundary regex \\b ensures 'buyer' / 'seller' do not trigger compliance block"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 8 Plan 02: Score Schema and Prompts Summary

Zod schema, raw JSON Schema, model ID constant, prompt builder, and OJK compliance guardrail function — pure modules with no external dependencies beyond `zod`. All 25 it.todo stubs from Plan 01's test files are now real assertions; 27 tests pass.

## Tasks Completed

| Task | Name | Commit (RED) | Commit (GREEN) | Files |
|------|------|-------------|----------------|-------|
| 1 | score-schema.ts + activate schema tests | 1a8d48e | bfda812 | score-schema.ts, score-schema.test.ts |
| 2 | score-prompts.ts + activate prompts tests | 86e901e | 8e1de19 | score-prompts.ts, score-prompts.test.ts, score-schema.test.ts |

## scoreSchema Field Structure

```typescript
export const scoreSchema = z.object({
  overall_score: z.number().int().min(1).max(10),
  dimensions: z.array(dimensionSchema).length(4),
});

// where dimensionSchema:
const dimensionSchema = z.object({
  name: z.string().min(1),
  score: z.number().int().min(1).max(10),
  reasoning: z.string().min(1),
  snippets: z.array(snippetSchema).min(1).max(3),
});

// where snippetSchema:
const snippetSchema = z.object({
  text: z.string().min(1),
  page: z.number().int().positive(),
});
```

## SCORE_MODEL_ID Value

```typescript
export const SCORE_MODEL_ID = "gemini-2.5-flash" as const;
```

Intentionally NOT `"gemini-2.0-flash"` (which is `EXPLANATION_MODEL_ID` from Phase 6). Per AI-SPEC §4, score generation requires Gemini 2.5 Flash for structured extraction with `thinkingBudget: 0`.

## Compliance Regex Pattern

```typescript
const BLOCKED_TERMS = /\b(buy|sell|invest|recommend|accumulate|avoid|underweight|overweight)\b/i;
```

Word boundaries (`\b`) ensure "buyer" and "seller" do not trigger false positives. Returns original casing of matched term (e.g., "SELL" from "You should SELL") or `null` if clean.

## Test Counts

| File | Tests | Coverage |
|------|-------|----------|
| `score-schema.test.ts` | 13 passing | scoreSchema (10 cases), SCORE_RESPONSE_SCHEMA (3 cases), ScoreResult type |
| `score-prompts.test.ts` | 14 passing | SCORE_MODEL_ID (1), buildScorePrompt (6), scanForInvestmentAdvice (7) |
| **Total** | **27 passing** | All SCORE-01 through SCORE-05 requirements covered |

## Deviations from Plan

### Test organization: scanForInvestmentAdvice describe block

**Found during:** Task 2

**Issue:** Plan 01 placed a `scanForInvestmentAdvice` describe block inside `score-schema.test.ts` as a stub. However, `scanForInvestmentAdvice` is exported from `score-prompts.ts`, not `score-schema.ts`. Placing its tests in the schema test file would create a cross-module dependency that violates test isolation.

**Fix:** Removed the `scanForInvestmentAdvice` describe block from `score-schema.test.ts` and placed comprehensive tests in `score-prompts.test.ts` (7 test cases vs. 2 original stubs). Added a comment in score-schema.test.ts noting where the tests live.

**Files modified:** `score-schema.test.ts` (comment added), `score-prompts.test.ts` (tests added)

**Commit:** 86e901e

### Word-boundary edge case extended coverage

**Found during:** Task 2, `<behavior>` review

**Fix:** Added `"seller" does not match "sell"` test case in addition to the required `"buyer" does not match "buy"` case. Defence in depth for the regex symmetry.

**Impact:** +1 test, no implementation change.

## Known Stubs

None. All exported functions and types are fully implemented.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. `score-schema.ts` and `score-prompts.ts` are pure in-process modules with no I/O.

The threat mitigations from the plan's threat model are fully implemented:
- T-08-02-01: `scoreSchema.parse()` enforces all field bounds — verified by 13 tests
- T-08-02-02: `scanForInvestmentAdvice` with `\b` word boundaries — verified by 7 tests including the "buyer" edge case
- T-08-02-03: `snippet.page` constrained to positive integer by both Zod and SCORE_RESPONSE_SCHEMA

## Deferred Items

One pre-existing failing test discovered (out of scope):

- `src/lib/explain/__tests__/explain-prompts.test.ts` line 11: asserts `EXPLANATION_MODEL_ID === "gemini-2.5-flash"` but source exports `"gemini-2.0-flash"` (correct Phase 6 value). Test assertion appears to be a copy-paste error from Plan 02 scope review. Documented in `deferred-items.md`.

## Self-Check: PASSED

- `src/lib/explain/score-schema.ts` — EXISTS
- `src/lib/explain/score-prompts.ts` — EXISTS
- `src/lib/explain/__tests__/score-schema.test.ts` — EXISTS, 0 it.todo
- `src/lib/explain/__tests__/score-prompts.test.ts` — EXISTS, 0 it.todo
- Commit `1a8d48e` — EXISTS (test(08-02): RED score-schema)
- Commit `bfda812` — EXISTS (feat(08-02): GREEN score-schema)
- Commit `86e901e` — EXISTS (test(08-02): RED score-prompts)
- Commit `8e1de19` — EXISTS (feat(08-02): GREEN score-prompts)
- `npx vitest run score-schema.test.ts score-prompts.test.ts` — 27 PASSED
- `npx tsc --noEmit` — 0 errors
