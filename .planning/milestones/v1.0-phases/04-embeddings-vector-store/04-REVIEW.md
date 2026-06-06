---
phase: 04-embeddings-vector-store
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - supabase/migrations/20260508120000_phase4_hnsw_match_document_chunks.sql
  - src/db/database.types.ts
  - src/lib/embed/gemini-embed.ts
  - src/lib/embed/gemini-embed.test.ts
  - src/lib/ingest/embed-document-batch.ts
  - src/lib/ingest/embed-document-batch.test.ts
  - src/app/api/internal/embed-batch/route.ts
  - src/app/api/internal/embed-batch/embed-batch.test.ts
  - src/lib/ingest/trigger-parse-batch.ts
  - src/lib/ingest/parse-document-batch.ts
  - vercel.json
  - .env.example
  - src/lib/rag/match-document-chunks.ts
  - src/lib/rag/match-document-chunks.test.ts
  - scripts/smoke-vector-perf.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 4 implements the embeddings pipeline and vector store retrieval layer: Gemini batch embedding, a chunked embed worker that chains itself within Vercel's 60-second function limit, an HNSW index + RPC function in Supabase, and a RAG query helper. The architecture is sound and the individual pieces are well-structured. Two critical issues require attention before this code handles real traffic: the secret comparison in the embed-batch route is bypassable via a length side-channel that leaks how many prefix bytes match, and the Vercel cron job URLs are not configured with the required secret, meaning the cron will return 401 on every tick and the embed worker will silently never fire automatically. Four warnings cover logic correctness and robustness; three info items are style/maintenance notes.

## Critical Issues

### CR-01: `timingSafeStringEq` is not length-safe — leaks secret length

**File:** `src/app/api/internal/embed-batch/route.ts:19-21`

**Issue:** The function returns `false` immediately when `ba.length !== bb.length`, before calling `timingSafeEqual`. This means an attacker can enumerate the exact byte-length of `INTERNAL_PARSE_SECRET` via response timing: send candidates of increasing length until the route no longer returns immediately and instead takes the constant-time comparison path. Once the length is known the search space collapses from arbitrary to brute-force over characters of the known length. The same pattern exists in the parse-batch route (not in this diff, but the fix should be applied consistently there too).

**Fix:**
```typescript
function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Pad both to the same length so the timingSafeEqual call always runs.
  const len = Math.max(ba.length, bb.length);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  ba.copy(padA);
  bb.copy(padB);
  // Still do explicit length check, but only AFTER constant-time compare.
  return timingSafeEqual(padA, padB) && ba.length === bb.length;
}
```

---

### CR-02: Vercel cron jobs hit the internal endpoints without the secret — every cron tick will 401

**File:** `vercel.json:1-12`

**Issue:** The cron configuration sends bare GET requests to `/api/internal/parse-batch` and `/api/internal/embed-batch` with no query parameter or header. The route handler requires `Authorization: Bearer <INTERNAL_PARSE_SECRET>` or `?secret=<INTERNAL_PARSE_SECRET>`. Every cron invocation will hit the `401 Unauthorized` branch and the background embedding worker will never fire automatically. Documents will get stuck in `embedding` status indefinitely. The `.env.example` comment explicitly says to add `?secret=<INTERNAL_PARSE_SECRET>` to the cron URLs, but `vercel.json` does not do this.

**Fix:**
```json
{
  "crons": [
    {
      "path": "/api/internal/parse-batch?secret=${INTERNAL_PARSE_SECRET}",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/internal/embed-batch?secret=${INTERNAL_PARSE_SECRET}",
      "schedule": "* * * * *"
    }
  ]
}
```

Note: Vercel resolves environment variables in `vercel.json` cron path strings at deploy time. If this interpolation syntax is not supported by your Vercel version, set the secret as a fixed value or route through a thin wrapper endpoint that reads the env var internally and calls the worker.

## Warnings

### WR-01: `runEmbedBatch` updates chunks one-by-one inside a deadline loop — deadline check can exit mid-batch leaving partial state

**File:** `src/lib/ingest/embed-document-batch.ts:102-117`

**Issue:** The per-chunk `Date.now() > deadline` check at line 103 causes the loop to return `{ done: false }` mid-batch — after some of the embeddings for the current `rows` slice have been written but not all. The next invocation will re-fetch unembedded chunks (correct), but the chunks that were written just before the early exit are now embedded while others from the same batch are not. This is not data corruption (the next run heals it) but it means the `countNullEmbeddings` path at line 119 can see a partial batch and incorrectly advance status to `analyzing` if a concurrent invocation races to zero. More concretely: two overlapping cron ticks can both see `remaining === 0` in the count check after independently writing disjoint subsets of the chunks.

**Fix:** Batch-update all vectors in a single Supabase `upsert` call (or at minimum do the deadline check before the batch, not inside it), and rely on the outer while-loop deadline guard instead of the inner per-row check:

```typescript
// Check deadline BEFORE issuing the batch, not inside it.
if (Date.now() > deadline) {
  return { done: false };
}

// Upsert all vectors in one round-trip instead of N individual updates.
const updates = rows.map((row, i) => ({
  id: row.id,
  doc_id: docId,
  embedding: vectorToPgString(vectors[i] as number[]),
}));
const up = await supabaseAdmin
  .from("chunks")
  .upsert(updates, { onConflict: "id" });
if (up.error) {
  await failDocumentEmbed(docId, "Could not save embeddings. Try again later.");
  return { done: false };
}
```

---

### WR-02: `rows.length === 0` branch at line 77 has a logic gap — `remaining > 0` silently returns `done: true` without scheduling the next batch

**File:** `src/lib/ingest/embed-document-batch.ts:76-87`

**Issue:** When the `chunks` query returns zero rows but `countNullEmbeddings` returns a positive number (e.g., a race condition where another worker claimed them), the code falls through to `return { done: true }` at line 87 without setting status to `analyzing` and without scheduling another embed batch. The document gets stranded in `embedding` status permanently — it is never retried and never finalized.

**Fix:**
```typescript
if (rows.length === 0) {
  const remaining = await countNullEmbeddings(docId);
  if (remaining === 0) {
    await supabaseAdmin.from("documents").update({ status: "analyzing" }).eq("id", docId);
    return { done: true };
  }
  if (remaining < 0) {
    await failDocumentEmbed(docId, "Could not verify embedding progress.");
    return { done: false };
  }
  // remaining > 0 but no rows returned — likely a race; signal not done so caller retries.
  return { done: false };
}
```

---

### WR-03: `embedQueryText` and `vectorToPgString` are not mocked in the `server-only` boundary test for `match-document-chunks` — `vectorToPgString` dimension guard can fire on test vectors

**File:** `src/lib/rag/match-document-chunks.test.ts:9`

**Issue:** The test mock for `vectorToPgString` bypasses the 768-dimension guard in the real function. The test passes a 768-element vector so this does not currently fail, but the mock silently hides whether the real function's dimension assertion is exercised. More importantly, `embedQueryText` is mocked to return `Array.from({ length: 768 }, () => 0.01)` — if that were changed to a different length, `vectorToPgString` in the real implementation would throw, but the mock would not catch it, giving a false green. This is a test reliability issue rather than a correctness issue in production code, but it means the test does not guard against dimension mismatches end-to-end.

This is flagged as a warning because it masks a class of real bugs. The mock is fine for unit isolation, but an integration test (or a check that the mock's `vectorToPgString` validates dimensions) would close the gap.

**Fix:** Add a dimension assertion in the mock to mirror the real guard:
```typescript
vectorToPgString: (v: number[]) => {
  if (v.length !== 768) throw new Error(`Expected 768-dim vector, got ${v.length}`);
  return `[${v.join(",")}]`;
},
```

---

### WR-04: `parse-document-batch.ts` re-extracts the full PDF text on every batch call in the `unpdf` path — not directly related to phase 4 but introduced in the same diff set

**File:** `src/lib/ingest/parse-document-batch.ts:133-136`

**Issue:** When `extractionSource === "unpdf"`, `extractPdfTextPerPage` is called unconditionally on every batch invocation (line 133), even for pages that were already processed in a previous batch. The function re-reads and re-parses the entire PDF from Supabase storage on each call. For a 200-page document with `MAX_PAGES_PER_BATCH = 8`, this means 25 full PDF downloads and parses to process the whole file. The wall-clock budget (`MAX_BATCH_WALL_MS = 45_000`) is the binding constraint, but this redundant work is likely to cause timeouts on large documents.

**Fix:** Only extract the pages in `[parseStart, windowEnd]` and pass them to `chunkSinglePage`. Since `unpdf` returns all pages as an array, slice before the loop:

```typescript
const textsR = await extractPdfTextPerPage(clonePdfBytes(pdfMaster));
// … itemsByPage setup …

// Only iterate pages in the current window — text already extracted above.
for (let page = parseStart; page <= windowEnd; page++) {
  // textsR.texts is 0-indexed; page is 1-indexed.
  const plain = textsR.texts[page - 1] ?? "";
  // … rest unchanged
}
```

The `extractPdfTextPerPage` call itself cannot be avoided per-batch (the bytes are re-downloaded from Supabase each time), but this is a pre-existing architecture constraint. The fix here is to not call it twice on the same invocation — `extractPdfTextItemsPerPage` is already inside a try/catch; `extractPdfTextPerPage` on line 133 duplicates the call that was already done for the bootstrap classification on the first batch (line 86) but those results are discarded.

## Info

### IN-01: `.env.example` contains a hardcoded placeholder secret value

**File:** `.env.example:19`

**Issue:** `INTERNAL_PARSE_SECRET=01234567890123456789012345678901` is a real-looking 32-character string in the example file. Developers who copy this value without changing it will have a predictable secret in production. The comment says "Min 32 characters" but does not say "change this value."

**Fix:** Replace with a clearly non-functional placeholder:
```
INTERNAL_PARSE_SECRET=<generate-with: openssl rand -hex 32>
```

---

### IN-02: `fetchWithBackoff` has no jitter — thundering-herd risk under sustained 429 rate limiting

**File:** `src/lib/embed/gemini-embed.ts:36-39`

**Issue:** The retry delay is purely exponential (`200 * 2^attempt`) with no random jitter. If multiple documents are being embedded simultaneously and all hit Gemini's 10 RPM free-tier limit at the same time, they will all back off to the same delay and retry at the same instant, causing a burst that re-triggers 429. This is an info item because the free-tier concurrency is low and the cron interval (1 minute) adds natural spacing.

**Fix:**
```typescript
const base = 200 * 2 ** attempt;
const jitter = Math.random() * base * 0.3;
const delay = Math.min(10_000, base + jitter);
```

---

### IN-03: `database.types.ts` `Functions.match_document_chunks` type is missing the `p_query_embedding` field in alphabetical-sort order but has it — minor: `p_match_count` default is not reflected in the type

**File:** `src/db/database.types.ts:242-258`

**Issue:** The `Args` type for `match_document_chunks` marks `p_match_count` as `number` (required), but the SQL function defines it as `DEFAULT 5` (optional). Callers that rely on the generated types cannot omit `p_match_count` even though the database function allows it. This is cosmetic today because `match-document-chunks.ts` always passes `p_match_count`, but it will confuse future callers.

**Fix:** Mark the field optional in the generated type (or regenerate with `supabase gen types`):
```typescript
Args: {
  p_doc_id: string;
  p_match_count?: number;   // optional — SQL function has DEFAULT 5
  p_query_embedding: string;
}
```

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
