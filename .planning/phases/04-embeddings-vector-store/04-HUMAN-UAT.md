---
status: partial
phase: 04-embeddings-vector-store
source: [04-VERIFICATION.md]
started: 2026-05-12T02:30:00Z
updated: 2026-05-12T02:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full end-to-end embedding pipeline
expected: After uploading a real IDX PDF, run `SELECT count(*) FROM chunks WHERE doc_id = '<id>' AND embedding IS NULL` — result must be 0. Spot-check 10 rows to confirm doc_id, page_number, section, chunk_type, content, and embedding are all non-null.
result: [pending]

### 2. HNSW smoke timing
expected: Run `pnpm exec tsx scripts/smoke-vector-perf.ts` against local Supabase with migrations applied. Reported match_document_chunks_ms must be < 500. Record result in 04-UAT.md.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
