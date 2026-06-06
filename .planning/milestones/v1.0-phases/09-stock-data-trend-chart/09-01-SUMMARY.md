---
phase: 09-stock-data-trend-chart
plan: 01
subsystem: database, infra, testing
tags: [yahoo-finance2, recharts, supabase, vitest, idr-formatting, migrations, wave-0]

# Dependency graph
requires:
  - phase: 07-citation-ui-pdf-viewer
    provides: explanation-panel component that Plan 04 extends with stock/chart slots
  - phase: 06-ai-explanation-generation
    provides: documents table and database.types.ts patterns followed for new columns

provides:
  - yahoo-finance2@3.14.1 and recharts@3.8.1 installed as runtime dependencies
  - Supabase migration adding stock_data JSONB + stock_fetched_at TIMESTAMPTZ to documents
  - database.types.ts updated with new columns (Row/Insert/Update types)
  - formatIDR and formatIDRShort utilities in src/lib/utils.ts with 10 passing tests
  - Wave 0 test stubs for all 5 downstream Phase 9 modules (32 todos, suite green)

affects:
  - 09-02-PLAN (detect-ticker — test stub in place)
  - 09-03-PLAN (fetch-stock-data — test stub + DB cache columns in place)
  - 09-04-PLAN (stock-widget, trend-chart-card, explanation-panel — stubs + utilities ready)

# Tech tracking
tech-stack:
  added:
    - yahoo-finance2@3.14.1 (server-side IDX stock data fetching via .JK suffix)
    - recharts@3.8.1 (client-side ComposedChart for financial trend rendering)
  patterns:
    - Wave 0 Nyquist scaffolding: create it.todo stubs before modules ship
    - formatIDR/formatIDRShort: threshold-based IDR formatting (triliun/miliar/juta/raw)
    - Nullable JSONB cache columns: stock_data + stock_fetched_at pattern for 24h TTL

key-files:
  created:
    - supabase/migrations/20260519120000_stock_cache_columns.sql
    - src/lib/utils.test.ts
    - src/lib/stock/detect-ticker.test.ts
    - src/lib/stock/fetch-stock-data.test.ts
    - src/components/doc/stock-widget.test.tsx
    - src/components/doc/trend-chart-card.test.tsx
    - src/components/doc/explanation-panel.test.tsx
  modified:
    - package.json (+ yahoo-finance2, recharts under dependencies)
    - pnpm-lock.yaml (lockfile updated)
    - src/db/database.types.ts (stock_data + stock_fetched_at on documents Row/Insert/Update)
    - src/lib/utils.ts (formatIDR + formatIDRShort appended after cn)

key-decisions:
  - "Manually updated database.types.ts instead of running pnpm db:types — Docker was not running; manual edit mirrors what db:types would produce; idempotent once Docker is available"
  - "Both yahoo-finance2 and recharts placed under dependencies (not devDependencies) — yahoo-finance2 is server-only runtime; recharts renders in client components"
  - "Pre-existing test failure in explain-prompts.test.ts (gemini-2.0-flash vs 2.5-flash) logged to deferred-items.md; out of scope for Plan 01"

patterns-established:
  - "Pattern: Wave 0 stubs use it.todo() so suite stays green while source modules are missing"
  - "Pattern: formatIDR thresholds 1T/1B/1M match UI-SPEC IDR Formatting Contract (D-11)"
  - "Pattern: Stock cache columns follow nullable JSONB pattern from document_analysis.explanation"

requirements-completed: [STOCK-04]

# Metrics
duration: 10min
completed: 2026-05-20
---

# Phase 09 Plan 01: Wave 0 Setup Summary

**yahoo-finance2 + recharts installed, stock cache migration created, formatIDR/formatIDRShort utilities with 10 passing tests, and 5 Wave 0 test stubs scaffolding all downstream Phase 9 modules**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-20T10:00:00Z
- **Completed:** 2026-05-20T10:10:00Z
- **Tasks:** 4 completed (Tasks 1, 2, 4, 5); Task 3 is blocking human-action checkpoint
- **Files modified:** 10

## Accomplishments

- Installed `yahoo-finance2@3.14.1` and `recharts@3.8.1` as runtime dependencies; typecheck green
- Created `20260519120000_stock_cache_columns.sql` migration adding nullable `stock_data JSONB` and `stock_fetched_at TIMESTAMPTZ` to `documents`; `database.types.ts` updated with Row/Insert/Update types
- Implemented `formatIDR` + `formatIDRShort` in `src/lib/utils.ts` per UI-SPEC IDR Formatting Contract; all 10 unit tests pass
- Created 5 Wave 0 test stub files covering all downstream Phase 9 modules (32 `it.todo` entries); full test suite stays green with stubs as pending

## Task Commits

Each task was committed atomically:

1. **Task 1: Install yahoo-finance2 and recharts** — `0e96183` (chore)
2. **Task 2: Create stock cache migration + update database types** — `52d4347` (feat)
3. **Task 3: [BLOCKING] Push migration to remote Supabase** — _awaiting user confirmation_
4. **Task 4: Implement formatIDR + formatIDRShort + tests** — `a83ce99` (feat)
5. **Task 5: Create Wave 0 test stubs** — `38ee388` (test)

## Files Created/Modified

- `package.json` — Added yahoo-finance2@^3.14.1 and recharts@^3.8.1 under dependencies
- `pnpm-lock.yaml` — Lockfile updated (+59 packages)
- `supabase/migrations/20260519120000_stock_cache_columns.sql` — ALTER TABLE documents ADD COLUMN stock_data/stock_fetched_at
- `src/db/database.types.ts` — New columns added to documents Row/Insert/Update types
- `src/lib/utils.ts` — formatIDR + formatIDRShort appended after existing cn()
- `src/lib/utils.test.ts` — 10 unit tests covering all IDR formatting cases (green)
- `src/lib/stock/detect-ticker.test.ts` — 6 Wave 0 todos for Plan 02
- `src/lib/stock/fetch-stock-data.test.ts` — 7 Wave 0 todos for Plan 03
- `src/components/doc/stock-widget.test.tsx` — 8 Wave 0 todos for Plan 04
- `src/components/doc/trend-chart-card.test.tsx` — 5 Wave 0 todos for Plan 04
- `src/components/doc/explanation-panel.test.tsx` — 6 Wave 0 todos for Plan 04

## Decisions Made

- **Manual database.types.ts update:** Docker was not running so `pnpm db:start` / `pnpm db:reset` / `pnpm db:types` could not execute. Manually added the new columns to the types file to mirror what `db:types` would produce. This is idempotent — once Docker is available and migration is applied, re-running `pnpm db:types` will produce the same output.
- **Dependencies vs devDependencies:** Both libraries correctly placed under `dependencies` — `yahoo-finance2` is called from Next.js API routes (server-only runtime); `recharts` renders in client components at runtime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual database.types.ts update (Docker not running)**
- **Found during:** Task 2 (Create stock cache migration + apply locally + regenerate types)
- **Issue:** `pnpm db:start` failed — Docker Desktop not running; `pnpm db:types` requires Docker. Plan action step 3 called for `pnpm db:types` after applying migration locally.
- **Fix:** Manually edited `src/db/database.types.ts` to add `stock_data: Json | null` and `stock_fetched_at: string | null` to the `documents` Row/Insert/Update types, exactly matching what `supabase gen types typescript` would produce. Typecheck verified as green.
- **Files modified:** `src/db/database.types.ts`
- **Verification:** `pnpm typecheck` exits 0; `grep -c "stock_data" src/db/database.types.ts` returns 3; same for `stock_fetched_at`.
- **Committed in:** `52d4347` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix maintains correctness — downstream plans that read `database.types.ts` for type safety will have accurate types. No scope creep. Once Docker is available, `pnpm db:types` is idempotent and safe to re-run.

## Issues Encountered

- **Pre-existing test failure:** `src/lib/explain/__tests__/explain-prompts.test.ts` expects `EXPLANATION_MODEL_ID = "gemini-2.5-flash"` but `explain-prompts.ts` exports `"gemini-2.0-flash"`. This failure predates Phase 09 (confirmed via `git show HEAD~3`). Logged to `deferred-items.md`. Out of scope.

## User Setup Required

**Task 3 requires manual action — remote database push is a blocking checkpoint.**

Run the following to push the migration to the remote Supabase project:

```bash
# Ensure access token is set (project link already configured from Phase 4+)
# If SUPABASE_ACCESS_TOKEN is unset, run: export SUPABASE_ACCESS_TOKEN=<your_token>
supabase db push
```

Expected: confirmation that `20260519120000_stock_cache_columns.sql` was applied.

Optional verification via Supabase dashboard SQL editor:
```sql
select column_name, data_type
from information_schema.columns
where table_name = 'documents'
  and column_name in ('stock_data', 'stock_fetched_at');
-- should return 2 rows
```

Reply "approved" after `supabase db push` succeeds to unblock Plans 02–04.

## Next Phase Readiness

**Ready now (no remote DB required):**
- Plan 02 (detect-ticker): test stub exists, can implement the module
- Plan 04 utilities: `formatIDR`/`formatIDRShort` available for stock widget + chart

**Blocked until Task 3 completes (remote DB push):**
- Plan 03 (fetch-stock-data): API route needs remote DB cache columns to write/read
- Plan 04 (RSC page.tsx): stock data reads against remote documents table will fail without columns

## Self-Check: PASSED

All files verified present, all task commits verified in git log, all content requirements verified.

| Check | Result |
|-------|--------|
| package.json contains yahoo-finance2 + recharts | PASS |
| Migration file contains both ALTER TABLE statements | PASS |
| database.types.ts contains stock_data + stock_fetched_at (3x each) | PASS |
| formatIDR + formatIDRShort exported from utils.ts | PASS |
| cn() still exported (no regression) | PASS |
| All 5 stub test files exist | PASS |
| Commits 0e96183, 52d4347, a83ce99, 38ee388 in git log | PASS |

---
*Phase: 09-stock-data-trend-chart*
*Completed: 2026-05-20*
