---
phase: 11-observability-reliability
plan: 04
subsystem: infra
tags: [concurrency-cap, pdf-cleanup, keep-alive, cron, reliability, free-tier-protection]

# Dependency graph
requires:
  - phase: 11-observability-reliability
    plan: 01
    provides: Langfuse singleton (mocked in tests)
provides:
  - INFRA-03: Concurrency cap on Gemini LLM jobs (max 2 concurrent)
  - INFRA-04: PDF cleanup from Supabase Storage after successful embedding
  - INFRA-05: Weekly keep-alive cron preventing Supabase inactivity pause
affects: [phase-12-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "count: 'exact', head: true query for cross-serverless concurrency control"
    - "Best-effort storage cleanup with console.warn (not silent) at success-exit branches"
    - "Cron route exports runtime='nodejs' + maxDuration=10"

key-files:
  created:
    - src/app/api/cron/keep-alive/route.ts
    - src/app/api/cron/keep-alive/__tests__/route.test.ts
    - src/lib/ingest/__tests__/analyze-document-batch-concurrency.test.ts
    - src/lib/ingest/__tests__/embed-document-batch-cleanup.test.ts
  modified:
    - src/lib/ingest/analyze-document-batch.ts
    - src/lib/ingest/embed-document-batch.ts
    - vercel.json
    - src/lib/ingest/__tests__/analyze-document-batch.test.ts

key-decisions:
  - "Threshold > 2 (not >= 2): the current doc is itself in status=analyzing, so count includes it; cap allows this doc + 1 other = 2 concurrent max"
  - "Fail-open on count-query error: transient Supabase hiccup must not deadlock the pipeline"
  - "PDF cleanup placed AFTER scheduleAnalyzeBatchForDoc and BEFORE return { done: true } — inside === 0 branches only, guaranteeing it never fires on partial failure"
  - "console.warn (not silent catch) for Storage cleanup failure — orphan PDFs must be detectable in Vercel logs"
  - "Keep-alive route is public (no auth gate) in v1 — query is read-only and trivial; deferred to v2 if abuse appears"
  - "Weekly schedule 0 0 * * 0 (Sunday 00:00 UTC) — one ping per week satisfies Supabase Feb-2026 7-day inactivity policy"

# Metrics
duration: 25min
completed: 2026-05-24
---

# Phase 11 Plan 04: Reliability Protections Summary

**Three free-tier reliability mechanisms wired: INFRA-03 concurrency cap (Gemini quota), INFRA-04 PDF cleanup (Storage egress + UU PDP), INFRA-05 weekly keep-alive cron (Supabase inactivity prevention) — 9 new vitest tests, 0 regressions**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-24T05:15:00Z
- **Completed:** 2026-05-24T05:40:00Z
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

### INFRA-03 — Concurrency cap in analyze-document-batch.ts
- Inserted a `SELECT count WHERE status="analyzing"` query immediately after the status gate, before any Gemini work begins
- Threshold `> 2`: the current doc is itself in `status="analyzing"`, so count = 1 means only this doc is running; count = 2 means this doc + 1 other; count = 3 means cap exceeded
- On cap exceeded: returns `{ done: false }` with doc remaining in `status="analyzing"` — the cron re-picks it on the next tick (queueing, not failing)
- Fail-open on count-query error: `if (!countError && (activeCount ?? 0) > 2)` — transient Supabase hiccup does not deadlock the pipeline

### Concurrency Threshold Rationale
`> 2` was chosen because the current doc is already in `status="analyzing"` when `runAnalyzeBatch` runs. The count query includes it, so:
- count = 1: only this doc → proceed
- count = 2: this doc + 1 other → proceed (≤2 concurrent per CONTEXT.md)
- count = 3: this doc + 2 others → cap exceeded → return `{ done: false }`

This matches CONTEXT.md "Cap at ≤2 concurrent" exactly.

### INFRA-04 — PDF cleanup in embed-document-batch.ts
- Extended docRes `select("id, status")` to `select("id, status, storage_path")`
- Added `supabaseAdmin.storage.from("pdfs").remove([storage_path])` at BOTH success-exit branches:
  - Branch 1: `if (remaining === 0)` — after no-work-remaining fast path
  - Branch 2: `if (afterCount === 0)` — after batch embedding loop completes
- Cleanup is gated by `if (docRes.data?.storage_path)` — null storage_path is skipped
- `.catch((err) => console.warn(...))` — not silent; orphan PDFs are visible in Vercel logs
- Natural code structure guarantees cleanup NEVER fires on failure branches (only inside `=== 0` guards)

### INFRA-05 — Keep-alive cron route + vercel.json
- Created `GET /api/cron/keep-alive` running `SELECT id FROM documents LIMIT 1`
- Returns `200 { ok: true }` on success; `500 { ok: false, error }` on Supabase error or thrown exception
- Exports `runtime = "nodejs"` and `maxDuration = 10` per cron route pattern
- Added third `vercel.json` cron entry: `{ path: "/api/cron/keep-alive", schedule: "0 0 * * 0" }` — Sunday 00:00 UTC weekly
- Both existing entries (`parse-batch`, `embed-batch`) preserved unchanged

## Test Coverage

| Test file | Tests | What they verify |
|-----------|-------|-----------------|
| analyze-document-batch-concurrency.test.ts | 3 | Cap exceeded → no Gemini call; at-threshold proceeds; error → fail-open |
| embed-document-batch-cleanup.test.ts | 3 | Success removes PDF; partial-failure does not remove; Storage error does not abort |
| keep-alive/route.test.ts | 3 | Supabase success → 200; Supabase error → 500; thrown error → 500 |
| **Total new** | **9** | — |

All 22 tests passing (9 new + 13 pre-existing), 0 regressions.

## Task Commits

1. **Task 1: INFRA-03 concurrency cap** — `6653251`
   - `src/lib/ingest/analyze-document-batch.ts` — concurrency check inserted
   - `src/lib/ingest/__tests__/analyze-document-batch-concurrency.test.ts` — 3 new tests
   - `src/lib/ingest/__tests__/analyze-document-batch.test.ts` — updated cache-hit test to handle count query call

2. **Task 2: INFRA-04 PDF cleanup** — `571e981`
   - `src/lib/ingest/embed-document-batch.ts` — storage_path select + cleanup at both branches
   - `src/lib/ingest/__tests__/embed-document-batch-cleanup.test.ts` — 3 new tests

3. **Task 3: INFRA-05 keep-alive + vercel.json** — `5691974`
   - `src/app/api/cron/keep-alive/route.ts` — new route
   - `src/app/api/cron/keep-alive/__tests__/route.test.ts` — 3 new tests
   - `vercel.json` — third cron entry added

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing analyze-batch cache-hit test to handle new concurrency count call**
- **Found during:** Task 1 GREEN phase (running full ingest test suite after implementation)
- **Issue:** The existing `analyze-document-batch.test.ts` cache-hit test mocked `documents` calls by index; the new concurrency count query (call #2) fell through to the "status update" mock branch which had no `select` method, causing `TypeError: supabaseAdmin.from(...).select is not a function`
- **Fix:** Added a `callCount === 2` branch returning `{ select: () => ({ eq: () => Promise.resolve({ count: 1, error: null }) }) }` to correctly simulate the count query returning 1 (below threshold)
- **Files modified:** `src/lib/ingest/__tests__/analyze-document-batch.test.ts`
- **Commit:** `6653251`

**2. [Rule 2 - Missing] Test mock for embed-batch used `then` interception for countNullEmbeddings**
- **Found during:** Task 2 test authoring
- **Issue:** `countNullEmbeddings` is a local function in `embed-document-batch.ts` that calls `.select().eq().is()` — the `.is()` result resolves directly (no `.then` chaining needed). The mock used a `then` property on the `.is()` return, which Vitest handles as a thenable
- **Fix:** Built the mock to use the `then` property on the `.is()` return object so that `await { ... .is() }` resolves to `{ count: N, error: null }`. This correctly simulates the count query without requiring the local function to be extracted and separately mocked
- **Impact:** Tests pass; no production code change needed

## Storage Orphan Baseline

No smoke testing against live Supabase was performed (no live credentials in worktree environment). The cleanup mechanism will take effect on first deployment. To verify post-deploy:

```bash
# Before first real upload after deploy:
supabase storage ls pdfs --project-ref <ref>

# After a document completes embedding:
supabase storage ls pdfs --project-ref <ref>
# Expect: the PDF for the completed doc is absent
```

## Keep-Alive First Run Date

The `0 0 * * 0` schedule means the first automated run will be **Sunday 2026-06-01 00:00 UTC** (first Sunday after deploy). Verify in Vercel Dashboard → Cron Jobs after that date.

## Phase 12 Launch Recommendations

1. **Verify Langfuse event count in first 24h**: Plan 02/03 instrumentation should produce ~10 Langfuse events per document analysis. After first real traffic, check Langfuse Cloud dashboard → filter by `doc_id` tag to confirm trace volume matches `10 × actual_analysis_count`.

2. **Monitor concurrency cap in logs**: Search Vercel function logs for `[analyze-batch]` entries with `{ done: false }` immediately after the concurrency check — these indicate the cap is working. If cap fires frequently (>10% of invocations), consider increasing threshold or adding a dedicated queue.

3. **Monitor PDF cleanup in logs**: Search for `[embed-batch] PDF cleanup failed` to detect orphaned PDFs early. Any failures here should be investigated before storage reaches 800 MB.

4. **Keep-alive cron health check**: Add a weekly calendar reminder for the first 4 weeks to verify the Vercel Cron job shows a non-200 status — if it does, Supabase may still be pausing due to other inactivity signals.

## Known Stubs

None — all three reliability mechanisms are fully wired. No placeholder returns, no hardcoded empty values in the data flow.

## Threat Flags

No new network endpoints or auth paths introduced beyond what the plan's threat model covers. The keep-alive route (`/api/cron/keep-alive`) is a new publicly-accessible endpoint, but it is documented in the plan's threat model as T-11-20 (accepted risk: read-only query, trivial attack surface, 1M invocation budget).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/app/api/cron/keep-alive/route.ts | FOUND |
| src/app/api/cron/keep-alive/__tests__/route.test.ts | FOUND |
| src/lib/ingest/__tests__/analyze-document-batch-concurrency.test.ts | FOUND |
| src/lib/ingest/__tests__/embed-document-batch-cleanup.test.ts | FOUND |
| .planning/phases/11-observability-reliability/11-04-SUMMARY.md | FOUND |
| Commit 6653251 (INFRA-03) | FOUND |
| Commit 571e981 (INFRA-04) | FOUND |
| Commit 5691974 (INFRA-05) | FOUND |
