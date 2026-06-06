---
phase: "06"
plan: "02"
subsystem: database
tags: [database, migration, supabase, jsonb, schema-push, types-regen]
dependency_graph:
  requires: []
  provides: [document_analysis.explanation is jsonb on remote Supabase]
  affects: [Plan 03 service upsert, Plan 04 status route reads]
tech_stack:
  added: []
  patterns: [supabase db push with --linked for type regen when Docker unavailable]
key_files:
  created:
    - supabase/migrations/20260517120000_explain_jsonb.sql
  modified:
    - src/db/database.types.ts
decisions:
  - Used `supabase gen types typescript --linked` instead of `--local` because Docker Desktop is not running; `--linked` connects directly to the remote Supabase project and produces identical output
  - Migration filename timestamp `20260517120000` chosen to be later than the most recent migration `20260508120000`; preserves correct Supabase apply order
metrics:
  duration: "~3 minutes"
  completed: "2026-05-18T03:59:23Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 6 Plan 02: Migrate explanation Column to jsonb Summary

**One-liner:** ALTER COLUMN explanation TYPE jsonb on remote Supabase (migration 20260517120000) + database.types.ts regenerated to reflect `Json | null`

## What Was Built

Migrated `document_analysis.explanation` from `text` to `jsonb` on the remote Supabase project. This is a blocking prerequisite for Plan 03, which upserts plain JS objects into that column — without jsonb the Supabase JS client would silently stringify to `"[object Object]"`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write migration SQL | 8d35dc2 | supabase/migrations/20260517120000_explain_jsonb.sql |
| 2 | Push migration + regenerate types | b8ff77b | src/db/database.types.ts |

## Verification Results

| Check | Result |
|-------|--------|
| Migration file exists at correct path | PASS |
| `alter column explanation type jsonb using explanation::jsonb` in SQL | PASS |
| No `drop column` or `add column` in migration | PASS |
| Timestamp ordering: 20260517120000 > 20260508120000 | PASS |
| `supabase db push --include-all` applied all 4 migrations | PASS |
| Remote schema query: `SELECT data_type ... WHERE column_name='explanation'` | `jsonb` |
| `grep explanation src/db/database.types.ts` shows `Json \| null` (Row/Insert/Update) | PASS |
| `pnpm tsc --noEmit` exits 0 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `db:types` script uses `--local` which requires Docker**
- **Found during:** Task 2
- **Issue:** `package.json` `db:types` script is `supabase gen types typescript --local --schema public` — `--local` requires Docker Desktop running. Docker was not running.
- **Fix:** Ran `npx supabase gen types typescript --linked --schema public > src/db/database.types.ts` directly. `--linked` connects to the already-linked remote Supabase project and generates identical types.
- **Files modified:** src/db/database.types.ts
- **Commit:** b8ff77b

**2. [Rule 3 - Blocking] `SUPABASE_ACCESS_TOKEN` env var format rejected by npx supabase**
- **Found during:** Task 2
- **Issue:** `.env.local` stores `SUPABASE_ACCESS_TOKEN=sbp_v0_...` but `npx supabase` v2.98.1 requires format `sbp_0102...`. Setting the env var caused auth failure.
- **Fix:** Unset the env var and used the existing npx supabase CLI session (already authenticated). The CLI maintains its own session; the `sbp_v0_` token was only needed for the Management REST API call to verify the remote column type.
- **Remote schema verification method:** Used `curl https://api.supabase.com/v1/projects/{ref}/database/query` with `Authorization: Bearer sbp_v0_...` — the Management REST API accepts the `sbp_v0_` format even though the CLI rejects it.
- **Files modified:** none

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what is recorded in the plan's threat model (T-6-06, T-6-07, T-6-08).

## Known Stubs

None — this plan creates a migration file and regenerates types. No UI components or data sources are involved.

## Self-Check: PASSED

- Migration file: `supabase/migrations/20260517120000_explain_jsonb.sql` — FOUND
- Types file updated: `src/db/database.types.ts` — FOUND (explanation: Json | null confirmed)
- Commit 8d35dc2 — FOUND in git log
- Commit b8ff77b — FOUND in git log
- Remote schema: `data_type = jsonb` confirmed via Management API
