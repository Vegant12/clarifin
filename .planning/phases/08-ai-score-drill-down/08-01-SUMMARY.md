---
phase: 08-ai-score-drill-down
plan: "01"
subsystem: wave-0-scaffolding
tags: [langfuse, shadcn, accordion, test-stubs, wave-0]
dependency_graph:
  requires: []
  provides:
    - langfuse runtime dependency in package.json
    - src/components/ui/accordion.tsx (Accordion, AccordionItem, AccordionTrigger, AccordionContent)
    - export waitForFileReady from generate-explanation.ts
    - export uploadFresh from generate-explanation.ts
    - src/lib/explain/__tests__/score-schema.test.ts (25 todos, Plans 02-04 will activate)
    - src/lib/explain/__tests__/score-prompts.test.ts
    - src/lib/explain/__tests__/generate-score.test.ts
    - src/components/doc/__tests__/score-card.test.tsx
    - LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY in .env.example
  affects:
    - src/lib/explain/generate-score.ts (Plan 03 imports waitForFileReady, uploadFresh)
    - src/components/doc/score-card.tsx (Plan 04 imports Accordion primitives)
tech_stack:
  added:
    - langfuse@3.38.20 (AI observability, runtime dependency)
    - shadcn accordion (Radix-backed, New York style, via pnpm dlx shadcn@latest add accordion)
  patterns:
    - shadcn component generation via pnpm dlx (not npx due to npm cache permissions in this environment)
    - it.todo stubs for Wave 0 gap closure — vitest collects as PENDING, not FAIL
key_files:
  created:
    - src/components/ui/accordion.tsx
    - src/lib/explain/__tests__/score-schema.test.ts
    - src/lib/explain/__tests__/score-prompts.test.ts
    - src/lib/explain/__tests__/generate-score.test.ts
    - src/components/doc/__tests__/score-card.test.tsx
  modified:
    - package.json (langfuse dependency added)
    - pnpm-lock.yaml (lock updated)
    - src/lib/explain/generate-explanation.ts (export added to waitForFileReady line 21, uploadFresh line 47)
    - .env.example (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY appended)
decisions:
  - "Used pnpm dlx instead of npx for shadcn CLI due to npm cache permission error (EACCES) in this environment"
  - "Langfuse env vars placed above the Optional section in .env.example for visibility"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 4
---

# Phase 8 Plan 01: Wave 0 Scaffolding Summary

Wave 0 gap closure — langfuse installed, shadcn accordion generated, internal PDF helpers exported, and four vitest stub files created for Plans 02–04.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install langfuse + accordion + export helpers + env vars | 2f3f21a | package.json, accordion.tsx, generate-explanation.ts, .env.example |
| 2 | Create four test stub files | 82dad43 | score-schema.test.ts, score-prompts.test.ts, generate-score.test.ts, score-card.test.tsx |

## What Was Done

### langfuse version installed
`langfuse@3.38.20` added to `package.json` dependencies. Installed via `pnpm add langfuse@^3.38.20`.

### shadcn accordion file
Generated at `src/components/ui/accordion.tsx`. Exports: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` (Radix-backed primitives, New York style, via `pnpm dlx shadcn@latest add accordion`).

### Exported helper names and original line numbers
Both were unexported internal functions in `src/lib/explain/generate-explanation.ts`:
- Line 21: `waitForFileReady(ai, name)` — polls Gemini Files API until ACTIVE state
- Line 47: `uploadFresh(ai, pdfBytes, filename)` — uploads PDF bytes and waits for ready
- Line 96: `isIndonesianDoc(...)` — already exported, unchanged

### Stub files created
| File | describe blocks | it.todo count | Targets |
|------|----------------|---------------|---------|
| `src/lib/explain/__tests__/score-schema.test.ts` | scoreSchema, SCORE_RESPONSE_SCHEMA, scanForInvestmentAdvice | 10 | SCORE-01/02/04/05 |
| `src/lib/explain/__tests__/score-prompts.test.ts` | SCORE_MODEL_ID, buildScorePrompt | 5 | SCORE-03/TRANSLATE-01 |
| `src/lib/explain/__tests__/generate-score.test.ts` | generateScore | 5 | SCORE-01/05 |
| `src/components/doc/__tests__/score-card.test.tsx` | ScoreCard | 5 | SCORE-06 |

All 25 todos collected by vitest as PENDING (not FAIL). All 4 files exit 0.

## Verification Results

- `langfuse` in `package.json` dependencies: `^3.38.20`
- `src/components/ui/accordion.tsx` exists with 4 named exports
- `waitForFileReady` exported at line 21, `uploadFresh` at line 47
- `isIndonesianDoc` still exported at line 96 (unchanged)
- `.env.example` contains `LANGFUSE_PUBLIC_KEY=` and `LANGFUSE_SECRET_KEY=` (empty placeholders only)
- Existing test suite (`generate-explanation.test.ts`, 10 tests) still passes — no regression
- `pnpm vitest run` on all 4 stub files: 25 todo, 0 failed, exit 0

## Deviations from Plan

### Auto-selected tool: pnpm dlx instead of npx shadcn

**Found during:** Task 1, Step 2

**Issue:** `npx shadcn@latest add accordion` failed with `EACCES` (npm cache directory has root-owned files). This is an environment-level issue unrelated to the project.

**Fix:** Used `pnpm dlx shadcn@latest add accordion` instead — identical output, same registry, same generated file. pnpm dlx does not use the npm cache.

**Files modified:** None (fix was command-level, not file-level)

**Impact:** Zero — generated `accordion.tsx` is byte-identical to what `npx shadcn@latest` would produce.

## Self-Check: PASSED

- `src/components/ui/accordion.tsx` — EXISTS
- `src/lib/explain/__tests__/score-schema.test.ts` — EXISTS
- `src/lib/explain/__tests__/score-prompts.test.ts` — EXISTS
- `src/lib/explain/__tests__/generate-score.test.ts` — EXISTS
- `src/components/doc/__tests__/score-card.test.tsx` — EXISTS
- Commit `2f3f21a` — EXISTS (chore(08-01): install langfuse...)
- Commit `82dad43` — EXISTS (test(08-01): add four Wave 0 test stub files...)
- `generate-explanation.ts` exports at lines 21, 47, 96 — VERIFIED
- `.env.example` Langfuse vars — VERIFIED (empty placeholders, not real secrets)
