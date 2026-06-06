---
phase: 11-observability-reliability
plan: 03
subsystem: observability
tags: [langfuse, chat, starter-questions, onFinish, try-finally, tdd, vercel-ai-sdk]

# Dependency graph
requires:
  - phase: 11-observability-reliability
    plan: 01
    provides: Singleton Langfuse client at src/lib/langfuse.ts
provides:
  - Instrumented streaming chat route (Pattern B — onFinish closure)
  - Instrumented starter-questions route (Pattern B variant — try/finally)
affects: [11-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern B (streaming): langfuse.trace() + trace.generation() BEFORE streamText; generation.end() + flushAsync() INSIDE onFinish callback"
    - "Pattern B variant (non-streaming): trace + generation BEFORE generateObject; generation.end() in try/catch; flushAsync() in finally"
    - "flushAsync() placement: onFinish for streaming (never after return); finally for non-streaming"
    - "generateObject gains explicit maxTokens: 512, maxRetries: 2 (AI-SPEC §4b.3)"

key-files:
  modified:
    - src/app/api/chat/route.ts
    - src/app/api/chat/__tests__/route.test.ts
    - src/app/api/starter-questions/route.ts
    - src/app/api/starter-questions/__tests__/route.test.ts

key-decisions:
  - "flushAsync() placed INSIDE onFinish for streaming route — after return is unreachable in Vercel serverless (AI-SPEC §3 pitfall 1)"
  - "Guardrail short-circuit and empty-retrieval paths do NOT open traces — only actual LLM calls are traced (D-02/D-03)"
  - "Cache-hit path in starter-questions does NOT open a trace — trace-free by design"
  - "generation.end() called in BOTH success and catch paths — prevents orphaned observations (AI-SPEC pitfall 4)"
  - "maxTokens: 512 + maxRetries: 2 added to generateObject per AI-SPEC §4b.3 discipline"

# Metrics
duration: 10min
completed: 2026-05-24T05:38:20Z
---

# Phase 11 Plan 03: Chat + Starter-Questions Langfuse Instrumentation Summary

**Langfuse Pattern B (onFinish closure) wired into chat/route.ts and Pattern B variant (try/finally) wired into starter-questions/route.ts — completing trace coverage of all four LLM call sites with flushAsync placement verified by TDD test cases**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-24T05:28:00Z
- **Completed:** 2026-05-24T05:38:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

### Task 1: chat/route.ts — Pattern B (onFinish closure)

- Added `import { langfuse } from "@/lib/langfuse"` to `src/app/api/chat/route.ts`
- Opens `trace("chat")` with `{ doc_id, session_id, commit }` metadata BEFORE `streamText`
- Opens `generation("gemini-chat")` with full messages array as input and `{ maxTokens: 1500, temperature: 0.3 }` modelParameters
- `generation.end()` + `await langfuse.flushAsync()` placed INSIDE `onFinish` callback — fires while Response is still being drained, before Vercel serverless function tears down
- `onFinish` signature updated from `({ text })` to `({ text, usage })` to capture token counts
- Existing `persistMessages` try/catch preserved unchanged AFTER the Langfuse close
- Guardrail short-circuit path (`isInvestmentAdviceQuery`) and empty-retrieval path remain completely trace-free
- 4 new Langfuse test cases verify: trace opens on LLM path, no trace on guardrail short-circuit, no trace on empty retrieval, generation.end + flushAsync only fire when onFinish fires (not at call site)

### Task 2: starter-questions/route.ts — Pattern B variant (try/finally)

- Added `import { langfuse } from "@/lib/langfuse"`
- Opens `trace("starter-questions")` + `generation("gemini-starter-questions")` on cache miss BEFORE `generateObject`
- `generateObject` destructure expanded from `const { object }` to `const { object, usage }` for token count capture
- `generateObject` gains explicit `maxTokens: 512, maxRetries: 2` per AI-SPEC §4b.3
- `generation.end()` called with `usageDetails` on success path; called with `level: "ERROR"` on catch path
- `await langfuse.flushAsync()` in `finally` block — runs on both success and error paths
- Cache-hit path returns early before any trace is opened — trace-free by design
- Existing best-effort cache write to `document_analysis.starter_questions` preserved unchanged
- Placeholder comment `// Plan 11 will trace this via Langfuse` removed — now actually implemented
- 3 new Langfuse test cases verify: trace on cache miss success, no trace on cache hit, ERROR generation + flush when generateObject throws

## All Four Call Sites Now Instrumented

| Call Site | File | Pattern | flushAsync Location |
|-----------|------|---------|---------------------|
| explanation | src/lib/explain/generate-explanation.ts | A (direct @google/genai) | finally |
| score | src/lib/explain/generate-score.ts | A (direct @google/genai) | finally |
| chat | src/app/api/chat/route.ts | B (Vercel AI SDK streaming) | onFinish |
| starter-questions | src/app/api/starter-questions/route.ts | B variant (Vercel AI SDK non-streaming) | finally |

## flushAsync Placement Confirmation

| Call Site | Pattern | flushAsync Location | Correctness |
|-----------|---------|---------------------|-------------|
| generate-explanation.ts | A | `finally` block | Correct — batch call, function awaits before return |
| generate-score.ts | A | `finally` block | Correct — batch call, function awaits before return |
| chat/route.ts | B | `onFinish` callback | Correct — streaming, function exits at `return result.toDataStreamResponse()`; onFinish fires before teardown |
| starter-questions/route.ts | B variant | `finally` block | Correct — awaited call, try/finally pattern |

## maxTokens/maxRetries Compliance (AI-SPEC §4b.3)

- `generateObject` in starter-questions/route.ts now has `maxTokens: 512, maxRetries: 2` explicit
- chat/route.ts already had `maxTokens: 1500, temperature: 0.3` — unchanged
- Both generate-explanation.ts and generate-score.ts covered by Plan 02

## TDD Gate Compliance

Both tasks followed RED/GREEN/REFACTOR:

- **Task 1 RED:** `test(11-03): add failing Langfuse instrumentation tests for chat/route.ts` — `cbd2d80`
- **Task 1 GREEN:** `feat(11-03): instrument chat/route.ts with Langfuse Pattern B (onFinish closure)` — `2d594be`
- **Task 2 RED:** `test(11-03): add failing Langfuse instrumentation tests for starter-questions/route.ts` — `ca0b800`
- **Task 2 GREEN:** `feat(11-03): instrument starter-questions/route.ts with Langfuse Pattern B variant (try/finally)` — `cbb59af`

## Test Results

```
src/app/api/chat/__tests__/route.test.ts           8 tests — 8 passed
src/app/api/starter-questions/__tests__/route.test.ts  6 tests — 6 passed
Total: 14 tests — 14 passed
```

## Plan 04 Prerequisite Check

Both routes continue to function correctly:
- `chat/route.ts` returns streaming response via `result.toDataStreamResponse()` — unchanged
- `starter-questions/route.ts` returns `NextResponse.json({ questions })` — unchanged
- Langfuse instrumentation is observer-only — does not block, delay, or alter response content
- Existing tests (CHAT-01, CHAT-02, CHAT-06, CHAT-05) all still pass

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| 1 RED | test | cbd2d80 | Failing Langfuse tests for chat/route.ts |
| 1 GREEN | feat | 2d594be | Instrument chat/route.ts Pattern B |
| 2 RED | test | ca0b800 | Failing Langfuse tests for starter-questions/route.ts |
| 2 GREEN | feat | cbb59af | Instrument starter-questions/route.ts Pattern B variant |

## Files Created/Modified

- `src/app/api/chat/route.ts` — Instrumented with Pattern B; langfuse import + trace/generation open + onFinish close
- `src/app/api/chat/__tests__/route.test.ts` — 4 new Langfuse test cases + vi.hoisted mock
- `src/app/api/starter-questions/route.ts` — Instrumented with Pattern B variant; langfuse import + try/finally
- `src/app/api/starter-questions/__tests__/route.test.ts` — 3 new Langfuse test cases + vi.hoisted mock

## Deviations from Plan

None — plan executed exactly as written. The exact code from AI-SPEC §4 Pattern B and Pattern B variant was applied verbatim with only variable name adjustments to match the existing files.

## Known Stubs

None — all instrumentation is fully wired. Trace data flows to Langfuse Cloud when `LANGFUSE_SECRET_KEY` and `LANGFUSE_PUBLIC_KEY` are set.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. Langfuse instrumentation is observer-only. Threat register T-11-10 through T-11-15 addressed as specified in plan.

## Self-Check: PASSED

- src/app/api/chat/route.ts — FOUND
- src/app/api/starter-questions/route.ts — FOUND
- .planning/phases/11-observability-reliability/11-03-SUMMARY.md — FOUND
- Commit cbd2d80 (test RED chat) — FOUND
- Commit 2d594be (feat GREEN chat) — FOUND
- Commit ca0b800 (test RED starter-questions) — FOUND
- Commit cbb59af (feat GREEN starter-questions) — FOUND

---

*Phase: 11-observability-reliability*
*Completed: 2026-05-24*
