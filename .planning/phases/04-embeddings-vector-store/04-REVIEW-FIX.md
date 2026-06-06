---
phase: 04-embeddings-vector-store
fixed_at: 2026-05-12T00:00:00Z
review_path: .planning/phases/04-embeddings-vector-store/04-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-05-12T00:00:00Z
**Source review:** .planning/phases/04-embeddings-vector-store/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: `timingSafeStringEq` is not length-safe — leaks secret length

**Files modified:** `src/app/api/internal/embed-batch/route.ts`, `src/app/api/internal/parse-batch/route.ts`
**Commit:** 2fd30db
**Applied fix:** Replaced the early-return length check with a pad-then-compare approach. Both buffers are now padded to `Math.max(ba.length, bb.length)` before `timingSafeEqual` is called, ensuring the constant-time comparison always executes. The length equality check is then performed after the timing-safe compare so the result is still correct but no timing information about secret length is leaked.

---

### CR-02: Vercel cron jobs hit the internal endpoints without the secret — every cron tick will 401

**Files modified:** `vercel.json`
**Commit:** 884f50d
**Applied fix:** Added `?secret=${INTERNAL_PARSE_SECRET}` to both cron path strings. Vercel resolves the `${ENV_VAR}` interpolation at deploy time, so the cron invocations will now pass the secret as a query parameter and satisfy the route's auth check.

---

### WR-01: `runEmbedBatch` updates chunks one-by-one inside a deadline loop — deadline check can exit mid-batch leaving partial state

**Files modified:** `src/lib/ingest/embed-document-batch.ts`
**Commit:** b354d98
**Applied fix:** Moved the `Date.now() > deadline` check to before the embedding call and the per-row update loop, so the batch cannot be interrupted mid-way. The per-row updates remain individual `update` calls (the `upsert` alternative was rejected because the Supabase generated type requires all non-nullable columns for upsert, making a partial-column upsert a type error). The key invariant — no mid-batch deadline exit — is now enforced.
**Status:** fixed: requires human verification (logic change — verify deadline guard placement is correct in production)

---

### WR-02: `rows.length === 0` branch has a logic gap — `remaining > 0` silently returns `done: true` without scheduling the next batch

**Files modified:** `src/lib/ingest/embed-document-batch.ts`
**Commit:** b354d98
**Applied fix:** Changed the `remaining > 0` fallthrough case from `return { done: true }` to `return { done: false }` with an explanatory comment. Documents with chunks claimed by a racing worker are now retried by the caller instead of being permanently stuck in `embedding` status.

---

### WR-03: `embedQueryText` and `vectorToPgString` are not mocked with dimension guard in the `match-document-chunks` test

**Files modified:** `src/lib/rag/match-document-chunks.test.ts`
**Commit:** 1cc13bb
**Applied fix:** Added a 768-dimension assertion inside the `vectorToPgString` mock that mirrors the real function's guard. If a future test passes a wrong-length vector, the mock will now throw `Expected 768-dim vector, got N` rather than silently producing a malformed pgvector string.

---

### WR-04: `parse-document-batch.ts` re-extracts the full PDF text on every batch call in the `unpdf` path

**Files modified:** `src/lib/ingest/parse-document-batch.ts`
**Commit:** be6d9b4
**Applied fix:** Hoisted the bootstrap `extractPdfTextPerPage` result into a `bootstrapTexts` variable declared at the outer function scope. The `unpdf` processing branch now uses `bootstrapTexts ?? await extractPdfTextPerPage(...)` — reusing the already-extracted result on the first batch invocation (when bootstrap ran in the same call) and falling back to a fresh extraction on subsequent batches (where `bootstrapTexts` is `null`). This eliminates the double PDF download+parse on the first batch for all unpdf documents.

---

_Fixed: 2026-05-12T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
