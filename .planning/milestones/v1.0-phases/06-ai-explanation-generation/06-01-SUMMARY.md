---
phase: 06-ai-explanation-generation
plan: "01"
subsystem: ai/explain
tags: [ai, prompts, schema, gemini, indonesian, zod, tdd]
dependency_graph:
  requires: []
  provides:
    - src/lib/explain/explanation-schema.ts (explanationSchema, EXPLANATION_RESPONSE_SCHEMA, ExplanationResult)
    - src/lib/explain/explain-prompts.ts (EXPLANATION_MODEL_ID, PSAK_GLOSSARY, EXPLAIN_SYSTEM_PROMPT, buildExplanationPrompt)
  affects:
    - Plan 03 (generate-explanation.ts imports EXPLANATION_MODEL_ID + buildExplanationPrompt + EXPLANATION_RESPONSE_SCHEMA)
    - Plan 04 (analyze-batch route imports from Plan 03 which depends on these)
tech_stack:
  added: []
  patterns:
    - TDD Wave 0: test stubs created before implementation (RED then GREEN)
    - Zod schema mirrors raw JSON Schema shape for Gemini responseSchema config
    - Static prompt constants exported for grep-ability in tests
    - No server-only guard on pure schema/prompt modules
key_files:
  created:
    - src/lib/explain/explanation-schema.ts
    - src/lib/explain/explain-prompts.ts
    - src/lib/explain/__tests__/explanation-schema.test.ts
    - src/lib/explain/__tests__/explain-prompts.test.ts
  modified: []
decisions:
  - "DISCLAIM-02 hard-coded in both EXPLAIN_SYSTEM_PROMPT and buildExplanationPrompt return value — not a post-filter"
  - "PSAK_GLOSSARY ships 30 terms (RESEARCH.md canonical list); sufficient for eval harness gate; expand if eval scores degrade"
  - "EXPLAIN_SYSTEM_PROMPT exported as standalone constant so other agents can grep the no-recommendation clause without importing the builder"
  - "No server-only import on schema/prompts modules — pure functions must be importable in Vitest without mock"
metrics:
  duration: "3 minutes"
  completed: "2026-05-18"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
  tests_added: 16
---

# Phase 6 Plan 01: Schema and Prompt Foundations Summary

**One-liner:** Five-section Zod schema + raw JSON Schema + PSAK/IFRS 30-term glossary + citation-bound prompt builder with hard-coded DISCLAIM-02 no-recommendation clause.

## What Was Built

Two source files and two Vitest test files in `src/lib/explain/` implementing the Wave 0 contract for Phase 6 AI explanation generation.

### explanation-schema.ts

- `explanationSchema`: Zod object with 5 required string keys (`revenue`, `profitability`, `balance_sheet`, `cash_flow`, `key_risks`), each `.min(1)` — locks EXPLAIN-01
- `ExplanationResult`: TypeScript type alias via `z.infer`
- `EXPLANATION_RESPONSE_SCHEMA`: plain JSON Schema object for Gemini's `responseSchema` config (mirrors Zod shape exactly — both must stay in sync)

### explain-prompts.ts

- `EXPLANATION_MODEL_ID = "gemini-2.5-flash"`: model constant (mirrors `EVAL_MODEL_ID` from eval harness)
- `PSAK_GLOSSARY`: 30-term Bahasa Indonesia → English PSAK/IFRS vocabulary string, covering high-risk terms from the eval harness (`laba bersih`, `pendapatan komprehensif lain`, `beban pokok penjualan`, etc.) — implements TRANSLATE-02
- `EXPLAIN_SYSTEM_PROMPT`: static system header with DISCLAIM-02 no-recommendation clause and grade-9 reading instruction — hard-coded before any PDF content (T-6-01 mitigation: PDF is a binary file part, cannot override this)
- `buildExplanationPrompt(totalPages, isIndonesian)`: interpolates `totalPages` into citation upper-bound rule (Pitfall 3 / EXPLAIN-02), conditionally injects `PSAK_GLOSSARY` when `isIndonesian === true`

## Tasks Completed

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Wave 0 test stubs | test (RED) | 7695ea8 | explanation-schema.test.ts, explain-prompts.test.ts |
| 2 | explanation-schema.ts | feat (GREEN) | b6c597e | explanation-schema.ts |
| 3 | explain-prompts.ts | feat (GREEN) | e80cbcc | explain-prompts.ts |

## Test Results

```
Tests  16 passed (16)
  - explanation-schema.test.ts: 5 tests (Zod parse/reject + EXPLANATION_RESPONSE_SCHEMA shape)
  - explain-prompts.test.ts: 11 tests (EXPLANATION_MODEL_ID, PSAK_GLOSSARY terms, prompt builder assertions)
```

All Wave 0 tests transitioned RED → GREEN as expected by TDD flow.

## Verification Results

- `pnpm vitest run src/lib/explain/__tests__/` — 16/16 tests pass
- `pnpm tsc --noEmit` — 0 TypeScript errors
- `grep "Do NOT make buy/sell" src/lib/explain/explain-prompts.ts` — 2 occurrences (DISCLAIM-02 in both `EXPLAIN_SYSTEM_PROMPT` and `buildExplanationPrompt`)
- `grep "laba bersih" src/lib/explain/explain-prompts.ts` — 1 occurrence (PSAK glossary present)

## Requirements Covered

| Req ID | Status | How |
|--------|--------|-----|
| EXPLAIN-01 | Locked | 5-key Zod schema + raw JSON Schema, both required `explanationSchema` validation |
| EXPLAIN-02 | Declared | `[p.N]` citation format in prompt with `totalPages` upper bound |
| EXPLAIN-03 | Hard-coded | "grade 9 reading level" in `EXPLAIN_SYSTEM_PROMPT` and `buildExplanationPrompt` |
| TRANSLATE-02 | Shipped (30 terms) | `PSAK_GLOSSARY` constant with canonical PSAK/IFRS term list |
| DISCLAIM-02 | Hard-coded | "Do NOT make buy/sell recommendations" in both prompt constants |

## Deviations from Plan

None — plan executed exactly as written. TDD flow followed: RED (Task 1) → GREEN (Tasks 2-3).

## Known Stubs

None. This plan ships schema and prompt constants only — no UI rendering, no data source wiring. The constants are complete and ready for import by Plans 03 and 04.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. The DISCLAIM-02 clause mitigates T-6-01 as designed.

## Self-Check: PASSED

Files exist:
- FOUND: src/lib/explain/explanation-schema.ts
- FOUND: src/lib/explain/explain-prompts.ts
- FOUND: src/lib/explain/__tests__/explanation-schema.test.ts
- FOUND: src/lib/explain/__tests__/explain-prompts.test.ts

Commits exist:
- FOUND: 7695ea8 (Task 1 - RED test stubs)
- FOUND: b6c597e (Task 2 - explanation-schema.ts GREEN)
- FOUND: e80cbcc (Task 3 - explain-prompts.ts GREEN)
