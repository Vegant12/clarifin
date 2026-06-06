---
phase: 11-observability-reliability
plan: 02
subsystem: infra
tags: [langfuse, observability, tracing, gemini, tdd, instrumentation]

# Dependency graph
requires:
  - phase: 11-observability-reliability
    plan: 01
    provides: Singleton Langfuse v3 client at src/lib/langfuse.ts
provides:
  - Instrumented generate-explanation.ts with Langfuse Pattern A (trace "explanation" + generation "gemini-explanation")
  - Instrumented generate-score.ts with Langfuse Pattern A (trace "score" + generation "gemini-score")
  - 6 new Langfuse-specific unit tests (3 per file) verifying trace/generation/flush contract
affects: [11-03, 11-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Langfuse Pattern A: manual trace/generation/flushAsync for @google/genai direct calls"
    - "try/catch/finally: generation.end(ERROR) in catch, flushAsync() in finally — mandatory serverless flush"
    - "lastChunk.usageMetadata for token counts (Gemini emits cumulative usage on final chunk only)"
    - "modelParameters flattening: thinkingConfig nested object cannot be passed as ApiMapValue — use thinkingBudget:0 scalar instead"

key-files:
  modified:
    - src/lib/explain/generate-explanation.ts
    - src/lib/explain/generate-score.ts
    - src/lib/explain/__tests__/generate-explanation.test.ts
    - src/lib/explain/__tests__/generate-score.test.ts

key-decisions:
  - "Flatten thinkingConfig to thinkingBudget:0 scalar in modelParameters — Langfuse ApiMapValue type (string|number|boolean|string[]) rejects nested objects; the Gemini config.thinkingConfig in the actual LLM call is unchanged"
  - "Compliance guardrail scan kept inside try block so violations close generation with level:ERROR via catch (per plan spec — errors anywhere in processing should be traced)"
  - "pdfBytes is never passed in generation input — only prompt string + docId + isIndonesian + totalPages cross the trace boundary (T-11-05 threat mitigation)"

# Metrics
duration: 6min
completed: 2026-05-24
---

# Phase 11 Plan 02: Langfuse Instrumentation — generate-explanation + generate-score Summary

**Langfuse Pattern A wired into both @google/genai direct call sites: trace "explanation" + generation "gemini-explanation" in generate-explanation.ts, and trace "score" + generation "gemini-score" in generate-score.ts, each with try/catch/finally ensuring flushAsync fires on both success and error paths**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-24T05:34:29Z
- **Completed:** 2026-05-24T05:40:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

### Task 1: generate-explanation.ts instrumented (TDD)

- Added `import { langfuse } from "@/lib/langfuse"` after existing prompt imports
- Opens `langfuse.trace({ name: "explanation", metadata: { doc_id, commit, step } })` before the LLM call
- Opens `trace.generation({ name: "gemini-explanation", model: EXPLANATION_MODEL_ID, input: { prompt, docId, isIndonesian, totalPages } })` — no pdfBytes
- Captures `lastChunk.usageMetadata` during the for-await loop to get token counts from the final chunk
- `generation.end({ output: result, usageDetails: { input: promptTokenCount, output: candidatesTokenCount } })` on success
- `trace.update({ output: { status: "success", sections: Object.keys(result) } })` on success
- `generation.end({ output: { error }, level: "ERROR", statusMessage })` in catch
- `await langfuse.flushAsync()` in finally (mandatory before serverless exit)
- 3 new Langfuse tests added: trace/generation names verified, flushAsync called once on success and once on failure, ERROR level asserted on Gemini throw

### Task 2: generate-score.ts instrumented (TDD)

- Identical Pattern A structure, with field overrides:
  - `trace.name: "score"`, `generation.name: "gemini-score"`, `generation.model: SCORE_MODEL_ID`
  - `modelParameters: { responseMimeType: "application/json", thinkingBudget: 0 }` (flattened — see Decisions)
  - `trace.update({ output: { status: "success", overall_score: result.overall_score } })`
- Compliance guardrail scan (`scanForInvestmentAdvice`) moved inside the try block — guardrail violations now also close the generation with `level: "ERROR"` via the catch clause
- 3 new Langfuse tests mirroring Task 1 but asserting `"score"` and `"gemini-score"` names
- All 8 pre-existing compliance and streaming tests continue to pass

## Trace Naming Convention (now in production)

| Pipeline step | Trace name | Generation name | Model constant |
|---|---|---|---|
| Explanation | `"explanation"` | `"gemini-explanation"` | `EXPLANATION_MODEL_ID` |
| Score | `"score"` | `"gemini-score"` | `SCORE_MODEL_ID` |

Plan 03 adds: `"chat"` / `"gemini-chat"` and `"starter-questions"` / `"gemini-starter-questions"`.

## Note for Plan 04 (Concurrency Cap)

The concurrency cap in `analyze-document-batch.ts` runs **before** either of these functions is called. A cap rejection (`{ done: false }` return) produces **no Langfuse trace** — which is correct, because no LLM call fires. Langfuse traces only appear when the LLM call actually executes.

## Task Commits

Each task was committed atomically using TDD (RED → GREEN):

1. **RED: generate-explanation tests** — `c19c55a` (test)
2. **GREEN: generate-explanation implementation** — `581be3c` (feat)
3. **RED: generate-score tests** — `2ddcdc8` (test)
4. **GREEN: generate-score implementation** — `5adc2c5` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Flattened thinkingConfig nested object in modelParameters**
- **Found during:** Task 2 TypeScript check
- **Issue:** Langfuse `modelParameters` is typed as `Record<string, ApiMapValue>` where `ApiMapValue = string | number | boolean | string[] | null` — nested objects like `{ thinkingBudget: 0 }` are rejected with TS2353
- **Fix:** Pass `thinkingBudget: 0` as a flat scalar key in `modelParameters` instead of `thinkingConfig: { thinkingBudget: 0 }`. The actual Gemini API call still uses `config.thinkingConfig: { thinkingBudget: 0 }` unchanged — only the Langfuse metadata field was flattened
- **Files modified:** `src/lib/explain/generate-score.ts`
- **Commit:** `5adc2c5`

## Known Stubs

None — both functions are fully wired to the Langfuse singleton from Plan 01.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. pdfBytes confirmed absent from all `input:` blocks (T-11-05 mitigation verified via grep).

## Self-Check: PASSED

All key files exist and all task commits are present in git history:
- `src/lib/explain/generate-explanation.ts` — FOUND
- `src/lib/explain/generate-score.ts` — FOUND
- `src/lib/explain/__tests__/generate-explanation.test.ts` — FOUND
- `src/lib/explain/__tests__/generate-score.test.ts` — FOUND
- `c19c55a` (RED: explanation tests) — FOUND
- `581be3c` (GREEN: explanation implementation) — FOUND
- `2ddcdc8` (RED: score tests) — FOUND
- `5adc2c5` (GREEN: score implementation) — FOUND
