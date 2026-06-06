---
plan: 06-04
phase: 06-ai-explanation-generation
status: complete
wave: 3
tasks_total: 4
tasks_complete: 4
requirements: [EXPLAIN-04, EXPLAIN-05]
key-files:
  created:
    - src/app/api/internal/analyze-batch/route.ts
    - src/app/api/internal/analyze-batch/__tests__/route.test.ts
  modified:
    - src/lib/ingest/trigger-parse-batch.ts
    - src/lib/ingest/embed-document-batch.ts
    - src/app/api/status/route.ts
---

## What Was Built

Wired `runAnalyzeBatch` (Plan 03) into the live ingestion pipeline using **Option A: `after()` chain** — no third Vercel Cron slot consumed.

### Trigger Strategy

`embed-document-batch.ts` already transitioned docs to `analyzing` in two places. Both now call `scheduleAnalyzeBatchForDoc(docId)` immediately after the `status: analyzing` write. The helper lives in `trigger-parse-batch.ts` and uses Next.js `after()` to fire a server-to-server fetch to `/api/internal/analyze-batch` AFTER the embed response is sent. `vercel.json` is unchanged.

### Files Changed

| File | Change |
|------|--------|
| `src/lib/ingest/trigger-parse-batch.ts` | Added `scheduleAnalyzeBatchForDoc` (mirrors `scheduleEmbedBatchesForDoc`, points at `/api/internal/analyze-batch`) |
| `src/lib/ingest/embed-document-batch.ts` | Added `scheduleAnalyzeBatchForDoc(docId)` at both `analyzing` transition points |
| `src/app/api/internal/analyze-batch/route.ts` | New internal route — auth via `timingSafeStringEq(INTERNAL_PARSE_SECRET)`, doc picker (`status='analyzing'`, oldest first), delegates to `runAnalyzeBatch`, exports `maxDuration = 300` |
| `src/app/api/internal/analyze-batch/__tests__/route.test.ts` | 6 tests: 401 on missing/wrong secret, happy-path POST + GET, doc picker no-match, doc picker match |
| `src/app/api/status/route.ts` | Extended `STUB_PIPELINE_TICK` to advance `analyzing → ready` for local dev |

### Manual Invocation (ad-hoc retry)

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/internal/analyze-batch" \
  -H "Authorization: Bearer $INTERNAL_PARSE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"doc_id":"<uuid>"}'
```

Or via GET for browser-based testing:
```
/api/internal/analyze-batch?secret=<INTERNAL_PARSE_SECRET>&doc_id=<uuid>
```

### Test Results

- 84/84 tests pass (full suite including Plans 01/03 tests)
- `pnpm tsc --noEmit` exits 0
- `vercel.json` unchanged — no third cron added

## Self-Check: PASSED

| Must-Have | Status |
|-----------|--------|
| POST /analyze-batch authenticates via timingSafeStringEq | ✓ |
| GET /analyze-batch supports secret query param | ✓ |
| No doc_id → picks oldest analyzing doc | ✓ |
| Route delegates to runAnalyzeBatch, returns { ok, doc_id, done } | ✓ |
| maxDuration = 300 exported | ✓ |
| embed-document-batch calls scheduleAnalyzeBatchForDoc at both transition points | ✓ |
| trigger-parse-batch exports scheduleAnalyzeBatchForDoc via after() | ✓ |
| STUB_PIPELINE_TICK advances analyzing → ready | ✓ |
