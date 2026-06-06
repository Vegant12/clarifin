---
phase: 12
plan: "03"
subsystem: upload-rate-limiting
tags: [infra, rate-limiting, security, tdd]
dependency_graph:
  requires: []
  provides: [per-ip-daily-upload-rate-limiting]
  affects: [upload-init-route, pdf-dropzone, database-types]
tech_stack:
  added: []
  patterns: [fail-open-rate-limiting, x-forwarded-for-ip-extraction, rolling-24h-window]
key_files:
  created:
    - supabase/migrations/20260524151928_add_ip_address_to_documents.sql
    - src/lib/rate-limit.ts
    - src/lib/__tests__/rate-limit.test.ts
  modified:
    - src/db/database.types.ts
    - src/app/api/upload-init/route.ts
    - src/components/upload/pdf-dropzone.tsx
decisions:
  - Manual type update for ip_address instead of pnpm supabase gen types (Docker/linked remote unavailable)
  - Fail-open design: DB errors allow upload to proceed rather than blocking all users
  - Rolling 24h window (not UTC midnight reset) for simpler implementation
metrics:
  duration_minutes: 12
  completed_date: "2026-05-24"
  tasks_completed: 2
  files_changed: 6
---

# Phase 12 Plan 03: Per-IP Rate Limiting (INFRA-02) Summary

**One-liner:** Per-IP daily upload rate limiting (5/day, rolling 24h) via documents table count query with fail-open on DB error.

## What Was Built

INFRA-02: protect free-tier Gemini/Supabase quotas by rejecting uploads from IPs that have already uploaded 5 documents in the past 24 hours.

### Migration

**File:** `supabase/migrations/20260524151928_add_ip_address_to_documents.sql`

```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ip_address text;
```

Idempotent (`IF NOT EXISTS`). No index added — free-tier volume is small enough that a sequential scan on the tiny documents table per upload is negligible.

### rate-limit.ts

- **DAILY_UPLOAD_LIMIT:** `5` (hardcoded constant — launch value, not operator-tunable)
- **Window:** Rolling 24 hours (`Date.now() - 24 * 60 * 60 * 1000`), not UTC midnight reset
- **`extractClientIp(request)`:** Reads `x-forwarded-for` header, takes leftmost IP (Vercel sets this authoritatively in production), falls back to `"unknown"` for local dev
- **`isIpRateLimited(ip)`:** Counts `documents` rows where `ip_address = ip` AND `created_at >= (now - 24h)`; returns `true` when count >= 5
- **Fail-open:** On any Supabase error, logs the error and returns `false` — upload proceeds. A DB outage must never lock out all users.

### upload-init/route.ts changes

- Rate-limit check inserted immediately after `parsed.data` destructure, **before** session lookup (cheapest possible early-exit order)
- Returns HTTP 429 with `{ error: "Daily upload limit reached. Come back tomorrow." }` when limited
- `ip_address: clientIp` added to `documents.insert()` on every successful upload

### pdf-dropzone.tsx changes

- `mapInitError` now handles `status === 429` before the 400/404 block
- Maps the server error to: `"You've reached the daily upload limit. Come back tomorrow to upload more documents."`
- Falls back to `"Too many uploads. Please try again tomorrow."` for unexpected 429 bodies

## Test Results

5 Vitest tests — all pass:

| Test | Result |
|------|--------|
| `isIpRateLimited` returns true when count >= 5 | PASS |
| `isIpRateLimited` returns false when count = 4 | PASS |
| `isIpRateLimited` returns false (fail open) on DB error | PASS |
| `extractClientIp` returns first IP from x-forwarded-for | PASS |
| `extractClientIp` returns "unknown" when header absent | PASS |

Full suite: 279 tests pass, 1 skipped. Pre-existing failures in `fetch-stock-data.test.ts` and `session-restore.test.ts` are unrelated to this plan.

## Deviations from Plan

### Auto-fixed Issues

None.

### Planned Steps That Deviated

**1. [Rule 3 - Blocking] Manual database type update instead of `pnpm supabase gen types`**

- **Found during:** Task 1
- **Issue:** Docker daemon not running; Supabase CLI not linked to remote project (no `supabase link` run). Both `pnpm supabase db push` and `pnpm supabase db push --linked` failed. The access token in `.env.local` uses a service-role key format (`sbp_v0_...`), not a personal access token format required by the CLI.
- **Fix:** Manually added `ip_address: string | null` to the `documents` Row type and `ip_address?: string | null` to the Insert and Update types in `src/db/database.types.ts`. The migration SQL file (`20260524151928_add_ip_address_to_documents.sql`) is written and ready to apply.
- **Action required:** Run `pnpm supabase db push --linked` (after running `supabase link --project-ref vedzschlklbsumvtasgv` with a valid personal access token) or apply the migration via the Supabase dashboard SQL editor. Then re-run `pnpm supabase gen types typescript --linked > src/db/database.types.ts` to regenerate types from the live schema.
- **Files modified:** `src/db/database.types.ts`
- **Commits:** `2acb4b2`

## Threat Surface

No new network endpoints introduced. The `ip_address` column is only accessible via `supabaseAdmin` (service role key, server-side). No public API exposes this field. Consistent with T-12-03-03 (mitigate) disposition in the plan threat model.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `2acb4b2` | chore | Migration SQL + manual database.types.ts update |
| `4c04a1d` | feat | rate-limit.ts + 5 Vitest tests (TDD RED→GREEN) |
| `274d2ba` | feat | upload-init route + pdf-dropzone 429 handling |

## Self-Check: PASSED

- `supabase/migrations/20260524151928_add_ip_address_to_documents.sql` — exists
- `src/lib/rate-limit.ts` — exists with `import "server-only"`, `extractClientIp`, `isIpRateLimited`
- `src/lib/__tests__/rate-limit.test.ts` — 5 tests all pass
- `src/db/database.types.ts` — contains `ip_address` in Row, Insert, Update (3 occurrences)
- `src/app/api/upload-init/route.ts` — imports and calls `isIpRateLimited` before session lookup; `ip_address: clientIp` in insert
- `src/components/upload/pdf-dropzone.tsx` — 429 case in `mapInitError`
- All commits present in git log
