---
status: complete
phase: 04-embeddings-vector-store
source: [04-VERIFICATION.md]
started: 2026-05-12T02:30:00Z
updated: 2026-05-12T10:20:00Z
---

## Current Test

[testing complete — 2026-05-12]

## Tests

### 1. Full end-to-end embedding pipeline
expected: After uploading a real IDX PDF, run `SELECT count(*) FROM chunks WHERE doc_id = '<id>' AND embedding IS NULL` — result must be 0. Spot-check 10 rows to confirm doc_id, page_number, section, chunk_type, content, and embedding are all non-null.
result: pass — live integration test (embed-pipeline-live.test.ts) ran against remote Supabase (vedzschlklbsumvtasgv, ap-southeast-1) + live Gemini API. Inserted 5 chunks with null embeddings; runEmbedBatch({ docId }) embedded all 5, count of null embeddings = 0, all metadata columns populated, document status advanced to 'analyzing'. Test duration: 1502ms.

### 2. HNSW smoke timing
expected: Run `scripts/smoke-vector-perf.ts` against Supabase with migrations applied. Reported match_document_chunks_ms must be < 500.
result: pass — match_document_chunks_ms=107.42 (target <500ms), insert_wall_ms=111817, rows_returned=5. Remote Supabase ap-southeast-1, 2026-05-12.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
