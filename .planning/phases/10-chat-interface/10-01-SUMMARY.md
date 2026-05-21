---
phase: 10
plan: "01"
subsystem: chat
tags:
  - ai-sdk
  - rag
  - test-stubs
  - migration
dependency_graph:
  requires:
    - "Phase 4: match_document_chunks RAG infrastructure"
    - "Phase 6: document_analysis table with explanation jsonb"
  provides:
    - "ai@4.3.19, @ai-sdk/google@1.2.22, @ai-sdk/groq@1.2.9 pinned in package.json"
    - "supabase/migrations/20260520120000_starter_questions.sql"
    - "src/lib/chat/guardrail.test.ts (RED — CHAT-06 contract)"
    - "src/lib/chat/prompts.test.ts (RED — CHAT-02 contract)"
    - "src/lib/chat/starter-questions-schema.test.ts (RED — CHAT-05 contract)"
    - "src/lib/chat/session-restore.test.ts (RED — CHAT-04 contract)"
    - "src/app/api/chat/route.test.ts (RED — CHAT-01/06 contract)"
    - "src/app/api/starter-questions/route.test.ts (RED — CHAT-05 contract)"
  affects:
    - "Plan 02: chat guardrail + prompts implementation"
    - "Plan 03: starter-questions route + db push"
    - "Plan 05: session-restore RSC"
tech_stack:
  added:
    - "ai@4.3.19 (Vercel AI SDK v4 — pinned, not v6)"
    - "@ai-sdk/google@1.2.22"
    - "@ai-sdk/groq@1.2.9"
  patterns:
    - "Exact-pinned dependencies (no carets) to prevent v6 drift"
    - "vi.hoisted() mock chain pattern for Supabase chain assertions"
    - "RED-first TDD: test stubs precede implementation"
key_files:
  created:
    - supabase/migrations/20260520120000_starter_questions.sql
    - src/lib/chat/guardrail.test.ts
    - src/lib/chat/prompts.test.ts
    - src/lib/chat/starter-questions-schema.test.ts
    - src/lib/chat/session-restore.test.ts
    - src/app/api/chat/route.test.ts
    - src/app/api/starter-questions/route.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml
decisions:
  - "Pin ai@4.3.19 exactly (no caret) — ai@6.x has incompatible API surface that breaks all Plan 02/03 patterns"
  - "Use vi.hoisted() Supabase mock chain in session-restore test to assert on .eq/.gte/.order/.limit call args (contract enforcement)"
  - "Task 3 executed before Task 2 DB push: safe because test stubs fail on missing source modules, not missing types"
metrics:
  duration: "~3 min 23 sec"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 3
  files_created: 9
  files_modified: 2
---

# Phase 10 Plan 01: Wave 0 Foundation — AI SDK + Migration + RED Stubs Summary

**One-liner:** Pinned AI SDK v4 (ai@4.3.19, @ai-sdk/google@1.2.22, @ai-sdk/groq@1.2.9), added starter_questions jsonb migration, and created 6 RED Vitest stubs encoding CHAT-01/02/04/05/06 contracts.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install AI SDK v4 + migration | 94b71ef | package.json, pnpm-lock.yaml, supabase/migrations/20260520120000_starter_questions.sql |
| 2 | [BLOCKING CHECKPOINT] Apply migration + regen DB types | — | src/db/database.types.ts (awaiting human) |
| 3 | Write 6 RED Vitest stubs | 09b1f65 | 6 test files in src/lib/chat/ and src/app/api/ |

## Task 1: AI SDK v4 Installation

**Installed exact versions:**

| Package | Version | Confirmed in node_modules |
|---------|---------|--------------------------|
| ai | 4.3.19 | node_modules/ai/package.json .version = 4.3.19 |
| @ai-sdk/google | 1.2.22 | Yes |
| @ai-sdk/groq | 1.2.9 | Yes |

package.json dependencies block (exact, no carets):
```json
"ai": "4.3.19",
"@ai-sdk/google": "1.2.22",
"@ai-sdk/groq": "1.2.9",
```

**Migration file:** `supabase/migrations/20260520120000_starter_questions.sql`
- Adds `starter_questions jsonb` column to `public.document_analysis` (nullable, O(1) catalog-only operation)
- Includes `COMMENT ON COLUMN` referencing CHAT-05

## Task 2: [BLOCKING CHECKPOINT — AWAITING HUMAN ACTION]

The migration must be applied to the remote Supabase project and DB types regenerated. The agent cannot perform the interactive `supabase link --project-ref` flow.

**Required steps (in order):**
1. `pnpm supabase login` (if not already)
2. `pnpm supabase link --project-ref <your-project-ref>` (skip if already linked)
3. `pnpm supabase db push` (applies 20260520120000_starter_questions.sql)
4. `pnpm db:types` (regenerates src/db/database.types.ts from live schema)
5. `grep -n 'starter_questions' src/db/database.types.ts` (MUST return 3+ lines)
6. `pnpm typecheck` (MUST pass with zero errors)

**Resume signal:** `grep -n 'starter_questions' src/db/database.types.ts` shows 3+ matches AND `pnpm typecheck` passes.

## Task 3: RED Vitest Stubs

All 6 test files created and confirmed RED (module resolution errors):

| File | Requirement | RED Error |
|------|-------------|-----------|
| src/lib/chat/guardrail.test.ts | CHAT-06 | Failed to load url ../guardrail |
| src/lib/chat/prompts.test.ts | CHAT-02 | Failed to load url ../prompts |
| src/lib/chat/starter-questions-schema.test.ts | CHAT-05 | Failed to load url ../starter-questions-schema |
| src/lib/chat/session-restore.test.ts | CHAT-04 | Failed to load url ../session-restore |
| src/app/api/chat/route.test.ts | CHAT-01/06 | Failed to load url ../route |
| src/app/api/starter-questions/route.test.ts | CHAT-05 | Failed to load url ../route |

**Test run output (RED confirmed):**
```
Test Files  6 failed (6)
      Tests  no tests
```

**Contract highlights:**
- guardrail.test.ts: 10 phrase variants (6 EN + 4 ID) tested via for loop; `isInvestmentAdviceQuery` must return `true` for each
- session-restore.test.ts: Asserts BOTH `session_id` AND `doc_id` scoping, `gte("created_at", sevenDaysAgo)`, `order("created_at", {ascending: true})`, `limit(40)`
- starter-questions-schema.test.ts: Zod schema rejects 4/6/121-char violations

## Deviations from Plan

None — plan executed exactly as written for auto tasks. Task 3 executed before Task 2's DB types are regenerated (safe because stubs fail on missing source modules, not missing type definitions).

## Known Stubs

None in production code — this plan only creates test stubs (intentional RED state per TDD wave-0 design).

## Threat Flags

No new threat surface introduced. Migration adds a nullable jsonb column with no public-facing endpoint. Test files have no security surface.

## Self-Check: PASSED

- [x] package.json contains `"ai": "4.3.19"` (exact)
- [x] package.json contains `"@ai-sdk/google": "1.2.22"` (exact)
- [x] package.json contains `"@ai-sdk/groq": "1.2.9"` (exact)
- [x] node_modules/ai/package.json .version = 4.3.19
- [x] supabase/migrations/20260520120000_starter_questions.sql exists
- [x] Migration contains `ALTER TABLE public.document_analysis`
- [x] Migration contains `starter_questions jsonb`
- [x] Migration contains `COMMENT ON COLUMN`
- [x] All 6 test files exist
- [x] All 6 test files are RED (module resolution errors)
- [x] Commits 94b71ef and 09b1f65 confirmed in git log
