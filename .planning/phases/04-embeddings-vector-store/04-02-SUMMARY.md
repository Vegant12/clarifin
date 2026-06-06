---
phase: 04-embeddings-vector-store
plan: "02"
subsystem: api
tags: [gemini, embeddings, text-embedding, vector, server-only, vitest, retry, backoff]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: env.ts with GEMINI_API_KEY validation
provides:
  - embedTextBatch(texts: string[]): Promise<number[][]> — batch embedding via gemini-embedding-001
  - embedQueryText(text: string): Promise<number[]> — single-text RAG query helper
  - vectorToPgString(vec: number[]): string — pgvector serialization helper
  - EMBEDDING_DIMENSIONS=768, EMBED_TEXTS_BATCH_SIZE=100 constants
affects:
  - 04-03-embed-document-batch
  - 04-04-vector-store
  - 04-05-rag

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "server-only guard at top of all embedding modules"
    - "exponential backoff: base 200ms, cap 10s, max 4 retries on 429/5xx"
    - "batchEmbedContents REST endpoint for multi-text embedding"
    - "fetch mock via vi.stubGlobal for unit tests — no live API calls in pnpm test"

key-files:
  created:
    - src/lib/embed/gemini-embed.ts
    - src/lib/embed/gemini-embed.test.ts
  modified: []

key-decisions:
  - "Used gemini-embedding-001 (not text-embedding-004) — text-embedding-004 returns 404 on v1beta batchEmbedContents endpoint"
  - "Batch size 100 per request per Google docs limits; loop slices for larger inputs"
  - "No section prefix (D4-02): caller passes chunks.content only, orchestrator handles prefix if ever needed"
  - "outputDimensionality=768 in each request for Matryoshka/MRL compatibility with pgvector(768)"

patterns-established:
  - "server-only-embed: All embedding code starts with import 'server-only' — enforced by Next.js bundler"
  - "retry-on-429: fetchWithBackoff recursion pattern for bounded exponential retry"

requirements-completed:
  - INGEST-06

# Metrics
duration: 4min
completed: "2026-05-12"
---

# Phase 04 Plan 02: Gemini Embedding Helper Summary

**Server-only `embedTextBatch` using `gemini-embedding-001` (768 dims) with batchEmbedContents REST, bounded exponential retry on 429/5xx, and 4 Vitest tests via mocked fetch**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-12T01:49:00Z
- **Completed:** 2026-05-12T01:52:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `embedTextBatch(texts: string[]): Promise<number[][]>` returns exactly 768-d vectors per input, chunked in batches of 100 via `batchEmbedContents` REST endpoint
- Bounded exponential backoff (200ms base, 10s cap, max 4 retries) on 429 and 5xx; throws last error after exhaustion so callers can mark document as failed
- Four deterministic Vitest tests pass with mocked `global.fetch` — no live Gemini API calls during `pnpm test`
- `server-only` guard and `@/lib/env` usage ensure API key never reaches client bundles (T-04-02-a satisfied)

## Task Commits

Each task was committed atomically:

1. **Task 04-02-01: gemini-embed.ts server helper** - `2a39246` (feat)
2. **Task 04-02-02: Vitests — mocked API** - `d4d92f1` (test)

**Plan metadata:** (see final docs commit below)

## Files Created/Modified

- `src/lib/embed/gemini-embed.ts` — Server-only embedding module: `embedTextBatch`, `embedQueryText`, `vectorToPgString`, constants
- `src/lib/embed/gemini-embed.test.ts` — Vitest suite: 4 tests covering empty input, two-vector batch, 429 retry, and single query text

## Decisions Made

- **Model name:** Used `gemini-embedding-001` instead of `text-embedding-004` — the plan named `text-embedding-004` but that model returns 404 on the `v1beta/batchEmbedContents` endpoint per API docs comment in the implementation. Both models produce 768-d output.
- **outputDimensionality:** Always set to 768 on each request for Matryoshka/MRL compatibility — ensures DB `vector(768)` column never needs schema migration.
- **No section prefix:** Caller (Plan 04-03 orchestrator) passes `chunk.content` only; no `RETRIEVAL_DOCUMENT` task type prefix needed for this use case per D4-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Biome formatter violations in both files**
- **Found during:** Task 04-02-01 and 04-02-02 (lint verification)
- **Issue:** Biome reported formatting errors: multi-line function signature and multi-line import needed collapsing per printWidth rules
- **Fix:** Ran `biome format --write` on both files; collapsed `fetchWithBackoff` signature and import statement
- **Files modified:** `src/lib/embed/gemini-embed.ts`, `src/lib/embed/gemini-embed.test.ts`
- **Verification:** `biome check src/lib/embed/` reports "No fixes applied"
- **Committed in:** `2a39246` (Task 1 commit) and `d4d92f1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - formatting)
**Impact on plan:** Formatting fix has no behavior impact. No scope creep.

## Issues Encountered

- `pnpm` not in PATH by default in the agent environment — resolved by using `/Users/hovegant/Library/pnpm/bin/pnpm` and the local `node_modules/.bin/vitest` binary directly.
- `pnpm install` triggered `pnpm-workspace.yaml` changes (approve-builds prompts) — reverted with `git checkout -- pnpm-workspace.yaml` to avoid unintended modifications.

## User Setup Required

None - no external service configuration required for this module. `GEMINI_API_KEY` must be set in `.env.local` (already required by existing `src/lib/env.ts`).

## Next Phase Readiness

- `embedTextBatch` is ready for import in Plan 04-03 (`embed-document-batch.ts`) via `import { embedTextBatch } from "@/lib/embed/gemini-embed"`
- The 768-d contract is enforced at runtime and tested; Plan 04-04 can safely use `vector(768)` pgvector column
- RAG query embedding (`embedQueryText`) is ready for Plan 04-05

## Self-Check: PASSED

- FOUND: src/lib/embed/gemini-embed.ts
- FOUND: src/lib/embed/gemini-embed.test.ts
- FOUND: .planning/phases/04-embeddings-vector-store/04-02-SUMMARY.md
- FOUND: commit 2a39246 (feat: server helper)
- FOUND: commit d4d92f1 (test: vitest suite)
- FOUND: commit 26138c7 (docs: plan summary)
- VERIFIED: 4/4 tests pass, 0 typecheck errors, 0 lint errors

---
*Phase: 04-embeddings-vector-store*
*Completed: 2026-05-12*
