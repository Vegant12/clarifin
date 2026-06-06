---
phase: 10
plan: 02
subsystem: chat
tags:
  - guardrail
  - prompt-engineering
  - zod-schema
  - pure-functions
  - tdd
dependency_graph:
  requires:
    - "10-01 (test stubs, AI SDK install)"
    - "src/lib/explain/explain-prompts.ts (PSAK_GLOSSARY)"
    - "src/lib/citations/parse-citations.ts (CITATION_REGEX [p.N] format)"
  provides:
    - "src/lib/guardrail.ts (isInvestmentAdviceQuery, INVESTMENT_ADVICE_PATTERNS)"
    - "src/lib/prompts.ts (CHAT_SYSTEM_PROMPT, CHAT_MODEL_ID, CHAT_DEFLECTION_MESSAGE, CHAT_EMPTY_RETRIEVAL_MESSAGE)"
    - "src/lib/starter-questions-schema.ts (StarterQuestionsSchema, StarterQuestions)"
  affects:
    - "10-03 (API routes import these pure modules)"
    - "10-04 (UI components import CHAT_DEFLECTION_MESSAGE, StarterQuestions type)"
tech_stack:
  added: []
  patterns:
    - "Pure-function module pattern: no server-only import, testable in Vitest node env"
    - "TDD RED→GREEN: 3 stubs from Plan 01 now GREEN"
    - "Word-boundary regex (\b) on EN terms prevents false positives on compound words"
key_files:
  created:
    - "src/lib/guardrail.ts"
    - "src/lib/prompts.ts"
    - "src/lib/starter-questions-schema.ts"
  modified: []
decisions:
  - "Files placed at src/lib/ (not src/lib/chat/) to match test import paths: tests import ../guardrail from src/lib/chat/ which resolves to src/lib/guardrail.ts"
  - "PSAK_GLOSSARY reused via import from explain-prompts.ts — zero duplication"
  - "CHAT_DEFLECTION_MESSAGE and CHAT_EMPTY_RETRIEVAL_MESSAGE exported as const literals for UI consumers"
metrics:
  duration_minutes: 3
  completed_date: "2026-05-21"
  tasks_completed: 3
  files_created: 3
  tests_added: 0
  tests_turned_green: 21
---

# Phase 10 Plan 02: Chat Pure-Function Library Modules Summary

**One-liner:** Three pure-function modules implement CHAT-06 investment-advice guardrail, CHAT-02 grounded-RAG system prompt, and CHAT-05 starter-questions Zod schema — turning 21 RED Plan 01 test assertions GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | guardrail.ts — CHAT-06 regex guardrail | 579b2fb | src/lib/guardrail.ts |
| 2 | prompts.ts — CHAT-02 system prompt | 423552e | src/lib/prompts.ts |
| 3 | starter-questions-schema.ts — CHAT-05 Zod schema | 426d2c8 | src/lib/starter-questions-schema.ts |

## Export Surface

### src/lib/guardrail.ts
- `export const INVESTMENT_ADVICE_PATTERNS` — regex: 6 EN phrases + 4 ID phrases, word-boundary protected
- `export function isInvestmentAdviceQuery(text: string): boolean` — CHAT-06 pre-LLM gate

### src/lib/prompts.ts
- `export const CHAT_MODEL_ID = "gemini-2.5-flash"` — AI-SPEC §4 primary model
- `export const CHAT_DEFLECTION_MESSAGE` — "I can help you understand what's in the document, but I'm not able to give buy/sell recommendations or investment advice."
- `export const CHAT_EMPTY_RETRIEVAL_MESSAGE` — "The document doesn't seem to contain information about that topic..."
- `export function CHAT_SYSTEM_PROMPT(context: string): string` — grounded RAG system prompt

### src/lib/starter-questions-schema.ts
- `export const StarterQuestionsSchema` — z.object with exactly 5 strings, each max 120 chars
- `export type StarterQuestions` — inferred TypeScript type

## Test Results

| Test File | Tests | Result |
|-----------|-------|--------|
| src/lib/chat/guardrail.test.ts | 12 | GREEN |
| src/lib/chat/prompts.test.ts | 5 | GREEN |
| src/lib/chat/starter-questions-schema.test.ts | 4 | GREEN |
| src/lib/chat/session-restore.test.ts | N/A | RED (not in scope — needs Supabase I/O, deferred to Plan 03) |

**Total: 21 assertions across 3 test files, all GREEN.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] File paths corrected from src/lib/chat/ to src/lib/**
- **Found during:** Task 1 implementation
- **Issue:** Plan 02 frontmatter listed `src/lib/chat/guardrail.ts` as the target path, but the test file `src/lib/chat/guardrail.test.ts` imports via `../guardrail` which resolves to `src/lib/guardrail.ts` (one level up). Placing the file at `src/lib/chat/guardrail.ts` caused module resolution failure.
- **Fix:** Created files at `src/lib/guardrail.ts`, `src/lib/prompts.ts`, `src/lib/starter-questions-schema.ts` — exactly where the `../` relative import in the test files resolves.
- **Files modified:** All 3 implementation files placed at `src/lib/` root, not `src/lib/chat/`
- **Commits:** 579b2fb, 423552e, 426d2c8

**2. [Rule 1 - Bug] session-restore.test.ts remains RED — out of scope for Plan 02**
- **Noted during:** Plan verification
- **Issue:** `session-restore.test.ts` was created in Plan 01 alongside the 3 pure-function test stubs, but `session-restore.ts` uses `@/db/client` (Supabase — I/O dependency), making it NOT a pure function and outside Plan 02's scope ("3 pure-function library modules").
- **Resolution:** session-restore.ts will be implemented in Plan 03 or later when server-side infrastructure is wired. This matches the plan verification statement "Test Files  3 passed" (implying exactly 3 pure-module tests going GREEN).

## INVESTMENT_ADVICE_PATTERNS — Phrase Coverage

Initial 10 patterns from the plan are included. No additional variants were needed — all 12 test assertions (10 blocked + 2 negative) pass with the base regex:

| Pattern | Language | Type |
|---------|----------|------|
| `\b(buy)\b` | EN | Word-boundary protected |
| `\b(sell)\b` | EN | Word-boundary protected |
| `\b(recommend)\b` | EN | Word-boundary protected |
| `\b(accumulate)\b` | EN | Word-boundary protected |
| `\b(worth buying)\b` | EN | Phrase, word-boundary |
| `\b(price target)\b` | EN | Phrase, word-boundary |
| `\b(should i)\b` | EN | Phrase, word-boundary |
| `beli saham` | ID | Multi-word, space-bounded |
| `jual saham` | ID | Multi-word, space-bounded |
| `rekomendasikan` | ID | Single word, no \b needed |
| `layak dibeli` | ID | Multi-word, space-bounded |

Negative tests: "buyer" passes (word-boundary prevents match), "net income question" passes.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All three modules are pure functions/schemas with no I/O. Threat model items T-10-05, T-10-06, T-10-07, T-10-08 addressed as specified in the plan.

## Known Stubs

None — all three modules are fully implemented. The session-restore.test.ts remains RED but that test's implementation is deferred to a later plan (not a stub in these files).

## Self-Check: PASSED

Files exist:
- FOUND: src/lib/guardrail.ts
- FOUND: src/lib/prompts.ts
- FOUND: src/lib/starter-questions-schema.ts

Commits exist:
- FOUND: 579b2fb (guardrail)
- FOUND: 423552e (prompts)
- FOUND: 426d2c8 (starter-questions-schema)
