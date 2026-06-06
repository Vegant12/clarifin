---
phase: 04-embeddings-vector-store
verified: 2026-05-12T02:30:00Z
status: human_needed
score: 7/9
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Run the full ingestion pipeline against a real IDX PDF and confirm every resulting chunk row has non-null doc_id, page_number, section, chunk_type, content, and embedding"
    expected: "SELECT count(*) FROM chunks WHERE doc_id = '<id>' AND embedding IS NULL returns 0; spot-check 10 rows shows all metadata columns populated"
    why_human: "Requires a running Supabase instance, a real PDF upload, and a live GEMINI_API_KEY to exercise the embed pipeline end-to-end"
  - test: "Run `pnpm exec tsx scripts/smoke-vector-perf.ts` against a local Supabase instance and record the elapsed match_document_chunks_ms in 04-UAT.md"
    expected: "Reported match_document_chunks_ms < 500 (or a hardware-adjusted note explaining any deviation from the 500ms target)"
    why_human: "Requires a running local Supabase instance with migrations applied; script seeds 10k vectors and times one RPC call — cannot execute in static verification"
gaps: []
deferred: []
---

# Phase 4: Embeddings & Vector Store — Verification Report

**Phase Goal:** All parsed chunks are embedded with text-embedding-004 and stored in pgvector with HNSW indexing, enabling accurate similarity retrieval with full metadata passthrough
**Verified:** 2026-05-12T02:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After ingestion completes, every chunk has all metadata fields populated and a non-null embedding | ? HUMAN | Pipeline is fully wired (embed-document-batch.ts updates each chunk with vectorToPgString output; status gates to 'analyzing' on zero null embeddings). Requires live run to confirm no metadata columns are null at completion. |
| 2 | Similarity search returns top-5 most relevant chunks with page_number intact and readable content | ✓ VERIFIED | matchDocumentChunks (src/lib/rag/match-document-chunks.ts) calls supabaseAdmin.rpc('match_document_chunks', {p_doc_id, p_query_embedding, p_match_count:5}); test asserts p_doc_id and page_number=42 in response; RPC returns page_number, content, source_page_start, source_page_end, section, chunk_type, distance columns. |
| 3 | HNSW index is active; 10k-vector smoke returns results in under 500ms | ? HUMAN | Migration creates chunks_embedding_hnsw_idx (m=16, ef_construction=64, cosine ops, WHERE embedding IS NOT NULL). Smoke script (scripts/smoke-vector-perf.ts) seeds 10k rows and times RPC call; target <500ms documented. Requires live execution to confirm actual latency. |
| 4 | Migration creates HNSW index with vector_cosine_ops (m=16, ef_construction=64) | ✓ VERIFIED | supabase/migrations/20260508120000_phase4_hnsw_match_document_chunks.sql line 5–9: CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON public.chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64) WHERE embedding IS NOT NULL |
| 5 | match_document_chunks RPC filters by doc_id, ordering by cosine distance | ✓ VERIFIED | SQL function body: WHERE c.doc_id = p_doc_id AND c.embedding IS NOT NULL ORDER BY c.embedding <=> p_query_embedding LIMIT greatest(1, least(coalesce(p_match_count, 5), 50)) |
| 6 | EXECUTE on match_document_chunks granted to service_role only; anon/authenticated/public revoked | ✓ VERIFIED | Migration lines 48–51: REVOKE ALL FROM PUBLIC; REVOKE ALL FROM anon; REVOKE ALL FROM authenticated; GRANT EXECUTE TO service_role |
| 7 | Embedding helper uses server-only module with 768-dim output and exponential backoff on 429/5xx | ✓ VERIFIED | gemini-embed.ts: import "server-only"; EMBEDDING_DIMENSIONS=768; fetchWithBackoff with maxRetries=4, base 200ms, cap 10s on 429 and 5xx; 4 Vitest tests pass with mocked fetch |
| 8 | runEmbedBatch orchestrator loads null-embedding chunks by chunk_index, updates rows, transitions status to 'analyzing' when done | ✓ VERIFIED | embed-document-batch.ts: selects WHERE embedding IS NULL ORDER BY chunk_index ASC LIMIT 96; calls embedTextBatch on content only; updates each chunk with vectorToPgString(vec); re-queries null count; sets status='analyzing' when count=0 |
| 9 | Parse completion triggers scheduleEmbedBatchesForDoc; embed-batch route chains partial batches via after() | ✓ VERIFIED | parse-document-batch.ts line 268: scheduleEmbedBatchesForDoc(docId) immediately after status='embedding' update. embed-batch/route.ts line 79: scheduleEmbedBatchesForDoc(docId) when !result.done. trigger-parse-batch.ts: NODE_ENV test guard present in both schedulers. |

**Score:** 7/9 truths verified (2 require human execution of live pipeline and smoke script)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260508120000_phase4_hnsw_match_document_chunks.sql` | HNSW + RPC + grants | ✓ VERIFIED | 55 lines; HNSW index, match_document_chunks function, REVOKE/GRANT, ANALYZE |
| `src/db/database.types.ts` | Functions.match_document_chunks present | ✓ VERIFIED | Functions section has match_document_chunks with Args (p_doc_id, p_query_embedding, p_match_count) and Returns array shape |
| `src/lib/embed/gemini-embed.ts` | embedTextBatch + EMBEDDING_DIMENSIONS=768 | ✓ VERIFIED | 114 lines; server-only; embedTextBatch, embedQueryText, vectorToPgString exported; EMBEDDING_DIMENSIONS=768; EMBED_TEXTS_BATCH_SIZE=100 |
| `src/lib/embed/gemini-embed.test.ts` | Mocked tests for batch, retry, empty | ✓ VERIFIED | 73 lines; 4 tests: empty returns [], two-vector batch, 429 retry, embedQueryText single vector; all mocked via vi.stubGlobal |
| `src/lib/ingest/embed-document-batch.ts` | runEmbedBatch + MAX_EMBED_BATCH_WALL_MS | ✓ VERIFIED | 132 lines; server-only; MAX_EMBED_BATCH_WALL_MS=52000; MAX_CHUNKS_PER_RUN=96; deadline-aware loop; failDocumentEmbed on error |
| `src/app/api/internal/embed-batch/route.ts` | GET + POST with timingSafeEqual auth | ✓ VERIFIED | 91 lines; timingSafeEqual on Bearer + ?secret=; picks oldest embedding doc if no doc_id; chains scheduleEmbedBatchesForDoc on !done |
| `src/lib/ingest/trigger-parse-batch.ts` | scheduleEmbedBatchesForDoc export | ✓ VERIFIED | scheduleEmbedBatchesForDoc: NODE_ENV test guard, after() with Bearer header to /api/internal/embed-batch |
| `vercel.json` | crons includes embed-batch | ✓ VERIFIED | Two crons: /api/internal/parse-batch and /api/internal/embed-batch, both schedule "* * * * *" |
| `src/lib/rag/match-document-chunks.ts` | matchDocumentChunks(docId, query, matchCount?) | ✓ VERIFIED | 52 lines; server-only; embedQueryText → vectorToPgString → supabaseAdmin.rpc('match_document_chunks'); returns MatchedChunkRow[] with all citation columns |
| `src/lib/rag/match-document-chunks.test.ts` | RPC contract + error propagation | ✓ VERIFIED | 66 lines; mocks embedQueryText and supabaseAdmin.rpc; asserts p_doc_id, p_match_count, page_number in response; error propagation test |
| `scripts/smoke-vector-perf.ts` | 10k-vector seed + timing | ✓ VERIFIED | Seeds 10,000 chunks with random 768-d vectors; times match_document_chunks RPC call; reports elapsed ms; documents <500ms target |
| `.planning/phases/04-embeddings-vector-store/04-UAT.md` | UAT record with 7 checks | ✓ VERIFIED | All 7 checks passed (2026-05-10); covers test suite, typecheck, migration, auth, RAG wrapper, perf script, pipeline wiring |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| gemini-embed.ts | embed-document-batch.ts | import { embedTextBatch } from "@/lib/embed/gemini-embed" | ✓ WIRED | embed-document-batch.ts line 4: import confirmed |
| parse-document-batch.ts (status: embedding) | scheduleEmbedBatchesForDoc | import + call after status update | ✓ WIRED | Line 6 import, line 268 call immediately after status='embedding' update |
| embed-batch/route.ts | runEmbedBatch | delegation after auth | ✓ WIRED | Line 8 import, line 77 call inside handleEmbedBatch |
| embed-batch/route.ts (!done) | scheduleEmbedBatchesForDoc | import + call when partial | ✓ WIRED | Line 9 import, line 79 call when !result.done |
| match-document-chunks.ts | public.match_document_chunks | supabaseAdmin.rpc | ✓ WIRED | Line 30: supabaseAdmin.rpc("match_document_chunks", {p_doc_id, p_query_embedding, p_match_count}) |
| migration SQL | src/db/database.types.ts | supabase gen types | ✓ WIRED | Functions.match_document_chunks present in generated types with correct Args and Returns |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| embed-document-batch.ts | vectors (embeddings) | embedTextBatch → Gemini batchEmbedContents REST API | Yes — live API call (mocked in tests only) | ✓ FLOWING |
| match-document-chunks.ts | rows (MatchedChunkRow[]) | supabaseAdmin.rpc('match_document_chunks') → pgvector cosine similarity | Yes — DB query with real ORDER BY cosine distance | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| scheduleEmbedBatchesForDoc exported from trigger file | file inspection | Function exists, NODE_ENV test guard present, uses after() | ✓ PASS |
| embed-batch route returns 401 without secret | Vitest embed-batch.test.ts (GET without auth) | Route test asserts 401 + {error: "Unauthorized."} | ✓ PASS |
| match-document-chunks RPC called with correct p_doc_id | Vitest match-document-chunks.test.ts | Test asserts rpcMock called with p_doc_id, p_match_count, pgvector string | ✓ PASS |
| 10k-vector smoke script exists and has timing logic | file inspection | scripts/smoke-vector-perf.ts: 10_000 rows, performance.now() timing, reports elapsed ms | ✓ PASS |
| Live 10k-vector smoke < 500ms | pnpm exec tsx scripts/smoke-vector-perf.ts | SKIPPED — requires running local Supabase | ? SKIP |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INGEST-06 | 04-01, 04-02, 04-03, 04-04, 04-05 | All parsed chunks are embedded and stored in pgvector with HNSW indexing, enabling similarity retrieval with metadata passthrough | ✓ SATISFIED (pending live run) | Migration, helper, orchestrator, scheduler, RAG wrapper all implemented and wired. Chunked embedding with content-only input (D4-02), 768-dim vectors (D4-01), HNSW index (D4-05), service_role-only RPC (D4-06), no dummy vectors (D4-07). Live chunk verification and <500ms timing require human execution. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| gemini-embed.ts | 10 | EMBEDDING_MODEL_ID = "gemini-embedding-001" (plan specified text-embedding-004) | ⚠️ Warning | Model deviation from plan and ROADMAP goal — documented in 04-02-SUMMARY.md: text-embedding-004 returns 404 on the v1beta batchEmbedContents endpoint; gemini-embedding-001 produces identical 768-d output. outputDimensionality=768 enforced on all requests. Not a functional gap — an intentional, documented substitution. |

No stub patterns, no TODO/FIXME blockers, no NEXT_PUBLIC in server modules, no dummy vector writes.

### Human Verification Required

#### 1. Full End-to-End Embedding Pipeline

**Test:** Upload a real IDX PDF, allow parse-batch to complete (status transitions to 'embedding'), then allow embed-batch to run. After status reaches 'analyzing', query: `SELECT id, doc_id, page_number, section, chunk_type, content, embedding FROM chunks WHERE doc_id = '<id>' LIMIT 20`
**Expected:** All rows have non-null values for doc_id, page_number, section, chunk_type, content, and embedding. A follow-up `SELECT count(*) FROM chunks WHERE doc_id = '<id>' AND embedding IS NULL` returns 0.
**Why human:** Requires a running Supabase instance (local or remote with db push completed), a valid GEMINI_API_KEY with live API access, and a real PDF file. Cannot be verified by static code inspection alone.

#### 2. HNSW Similarity Search Latency (10k-vector smoke)

**Test:** Run `pnpm exec tsx scripts/smoke-vector-perf.ts` against a local Supabase instance with migrations applied (after `pnpm exec supabase db reset`). Record the `match_document_chunks_ms` output and enter it in 04-UAT.md.
**Expected:** match_document_chunks_ms < 500 on local hardware. If hardware-limited, document the actual figure with a note.
**Why human:** Requires a running local Supabase instance. The smoke script seeds 10,000 vectors (destructive to dev DB) and times one RPC call — execution involves live DB operations that cannot be performed in static verification.

### Gaps Summary

No blocking gaps. All 12 artifacts exist and are substantive. All 6 key links are wired. All data flows are connected. The 2 human verification items (live pipeline execution and HNSW smoke timing) are inherent to this phase's nature — they require running infrastructure and cannot be confirmed programmatically.

The only notable deviation is the model substitution (gemini-embedding-001 vs text-embedding-004). This is intentional, documented, and functionally equivalent — both produce 768-d vectors. See anti-patterns section for suggested override.

**Suggested override for model name deviation** (add to VERIFICATION.md frontmatter if accepted):

```yaml
overrides:
  - must_have: "embedded with text-embedding-004"
    reason: "text-embedding-004 returns 404 on the v1beta batchEmbedContents endpoint; gemini-embedding-001 produces identical 768-d output with outputDimensionality=768 enforced per request — documented in 04-02-SUMMARY.md"
    accepted_by: "{your name}"
    accepted_at: "{ISO timestamp}"
```

---

_Verified: 2026-05-12T02:30:00Z_
_Verifier: Claude (gsd-verifier)_
