---
phase: 10-chat-interface
plan: "03"
subsystem: api
tags: [vercel-ai-sdk, streaming, rag, gemini, supabase, zod, next-api-route]

requires:
  - phase: 10-02
    provides: "isInvestmentAdviceQuery guardrail, CHAT_SYSTEM_PROMPT/CHAT_DEFLECTION_MESSAGE/CHAT_EMPTY_RETRIEVAL_MESSAGE/CHAT_MODEL_ID prompts, StarterQuestionsSchema — all imported by the two route handlers"
  - phase: 10-01
    provides: "Supabase chat_messages and document_analysis tables, Vercel AI SDK v4 pinned at ai@4.3.19, test stub files"
  - phase: 4
    provides: "matchDocumentChunks function for RAG retrieval scoped by docId"

provides:
  - "POST /api/chat — Zod-validated, guardrail → retrieve → streamText → persist pipeline with toDataStreamResponse"
  - "POST /api/starter-questions — cache-then-generate pattern using generateObject + StarterQuestionsSchema"

affects: [10-04-ui, 10-05-wiring, 10-06-session-restore]

tech-stack:
  added: []
  patterns:
    - "Guard-before-LLM: isInvestmentAdviceQuery fires BEFORE matchDocumentChunks and streamText — zero quota cost on deflection"
    - "Persist-before-stream: user message written to chat_messages BEFORE streamText begins — prevents lost messages on stream failure"
    - "onFinish-persist: assistant message written inside streamText onFinish callback — fire-and-forget, does not block the streaming response"
    - "cache-then-generate: starter_questions generated once per doc_id, re-validated on cache hit, fallback to generateObject on miss"
    - "Doc-scoped double-key: every chat_messages insert includes BOTH session_id AND doc_id (Pitfall 6 fix)"
    - "v4 API: streamText + toDataStreamResponse (NOT toUIMessageStreamResponse which is v5+)"
    - "Test placement: route test files in __tests__/ subdirs so ../route relative import resolves correctly"

key-files:
  created:
    - src/app/api/chat/route.ts
    - src/app/api/starter-questions/route.ts
    - src/app/api/chat/__tests__/route.test.ts
    - src/app/api/starter-questions/__tests__/route.test.ts
  modified: []

key-decisions:
  - "Import guardrail/prompts/starter-questions-schema from @/lib/* (not @/lib/chat/*) — Plan 02 placed files at src/lib/ root per STATE.md decision"
  - "Move route test files from src/app/api/{route}/route.test.ts to __tests__/ subdirectories — ../route import was broken when co-located with route.ts"
  - "toDataStreamResponse used (NOT toUIMessageStreamResponse) — v4 API as required by ai@4.3.19 pin"

patterns-established:
  - "Route test files: place in __tests__/ subdirectory so ../route resolves to sibling route.ts (mirrors analyze-batch pattern)"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06]

duration: 15min
completed: 2026-05-21
---

# Phase 10 Plan 03: Chat API Routes Summary

**Streaming RAG chat route + cache-then-generate starter questions route — both server-only, Zod-validated, with guardrail + persistence (CHAT-01..06)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-21T16:07:00Z
- **Completed:** 2026-05-21T16:12:00Z
- **Tasks:** 3
- **Files modified:** 4 created, 2 moved (test files)

## Accomplishments

- POST /api/chat: validates → guardrail → retrieve top-5 chunks → streamText with Gemini 2.5 Flash → persist; 4 behavior cases (invalid/guardrail/happy-path/empty-retrieval) all tested and passing
- POST /api/starter-questions: cache-hit returns instantly from document_analysis.starter_questions; cache-miss calls generateObject with StarterQuestionsSchema, persists, returns; 3 cases tested and passing
- Moved misplaced route.test.ts files (had `../route` import) from route directories into `__tests__/` subdirectories where the relative import resolves correctly

## Task Commits

1. **Task 1: POST /api/chat route + test file relocation** - `0623f6a` (feat)
2. **Task 2: POST /api/starter-questions route** - `ed36a20` (feat)
3. **Task 3: Verification only** - no new commit

## Endpoints Delivered

### POST /api/chat

**Request schema:**
```json
{ "messages": [{"role":"user"|"assistant","content":"string(1-4000)"}], "documentId": "uuid", "sessionId": "uuid" }
```

**Response shapes:**
- `400 JSON { error }` — invalid body (missing fields, bad UUID, empty messages)
- `200 JSON { role: "assistant", content: CHAT_DEFLECTION_MESSAGE }` — guardrail fires (no LLM call)
- `200 JSON { role: "assistant", content: CHAT_EMPTY_RETRIEVAL_MESSAGE }` — 0 RAG chunks returned (no LLM call)
- `200 DataStream` — `result.toDataStreamResponse()` — happy path streaming

**Streaming implementation:** `streamText` (v4 API), NOT `generateText` or `toUIMessageStreamResponse` (v5+)

### POST /api/starter-questions

**Request schema:**
```json
{ "documentId": "uuid" }
```

**Response shapes:**
- `400 JSON { error }` — missing/invalid documentId
- `500 JSON { error }` — Supabase read error
- `409 JSON { error: "Explanation not ready..." }` — explanation not yet generated
- `200 JSON { questions: string[5] }` — from cache or freshly generated

## Test Results

```
src/app/api/chat/__tests__/route.test.ts      4 tests PASS
src/app/api/starter-questions/__tests__/route.test.ts  3 tests PASS
src/lib/chat/guardrail.test.ts               12 tests PASS
src/lib/chat/prompts.test.ts                  5 tests PASS
src/lib/chat/starter-questions-schema.test.ts 4 tests PASS
Total Phase 10: 5 test files, 28 tests — all PASS
```

Full project test run: 35 passed / 3 failed (all pre-existing failures — session-restore deferred, fetch-stock-data constructor issue, explain-prompts model ID mismatch — none introduced by this plan).

## Files Created/Modified

- `src/app/api/chat/route.ts` — POST handler: guardrail → matchDocumentChunks → streamText → onFinish persist; `import "server-only"`
- `src/app/api/starter-questions/route.ts` — POST handler: cache-then-generate starter questions; `import "server-only"`
- `src/app/api/chat/__tests__/route.test.ts` — moved from parent dir; 4 test cases
- `src/app/api/starter-questions/__tests__/route.test.ts` — moved from parent dir; 3 test cases

## Decisions Made

- Imported from `@/lib/guardrail`, `@/lib/prompts`, `@/lib/starter-questions-schema` (not `@/lib/chat/...`) because Plan 02 placed files at `src/lib/` root per STATE.md decision about relative test imports
- Used `toDataStreamResponse()` (Vercel AI SDK v4), explicitly NOT `toUIMessageStreamResponse` (v5+ API that would break the v4 stream)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route test files had misplaced `../route` relative import**
- **Found during:** Task 1 (running route.test.ts)
- **Issue:** Test files at `src/app/api/chat/route.test.ts` imported `from "../route"` which resolves to `src/app/api/route.ts` (one level up), not `src/app/api/chat/route.ts` (same dir). Files were created in Plan 01 with wrong placement.
- **Fix:** Moved test files to `__tests__/` subdirectories (`src/app/api/chat/__tests__/route.test.ts`), matching the `analyze-batch/__tests__/route.test.ts` pattern already in the codebase. `../route` from `__tests__/` correctly resolves to sibling `route.ts`.
- **Files modified:** Deleted `src/app/api/chat/route.test.ts`, `src/app/api/starter-questions/route.test.ts`; created `src/app/api/chat/__tests__/route.test.ts`, `src/app/api/starter-questions/__tests__/route.test.ts`
- **Verification:** All 7 tests in both files pass with `node_modules/.bin/vitest run`
- **Committed in:** `0623f6a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary for tests to run. No logic changes; test content identical to Plan 01 stubs.

## Issues Encountered

- Tests must be run from the worktree directory using `node_modules/.bin/vitest run` (not `cd /main-project && pnpm test`) because the worktree's `node_modules` symlinks point to the pnpm store correctly but `pnpm test` from the main project runs against main project's `src/`, not the worktree's

## Next Phase Readiness

- POST /api/chat and POST /api/starter-questions are fully implemented and tested
- Plan 04 (UI components) can build StarterQuestions component that calls `/api/starter-questions`
- Plan 05 (wiring) can connect the ChatPanel to `/api/chat` with useChat hook
- Plan 06 (session-restore) remains deferred — `session-restore.ts` module needed for `src/lib/chat/session-restore.test.ts` to pass

---
*Phase: 10-chat-interface*
*Completed: 2026-05-21*
