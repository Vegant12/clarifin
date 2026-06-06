# Deferred Items — Phase 09

## Pre-existing Test Failure (Out of Scope)

**File:** `src/lib/explain/__tests__/explain-prompts.test.ts`
**Test:** `EXPLANATION_MODEL_ID > is gemini-2.5-flash`
**Status:** FAILING before Phase 09 began (pre-exists at HEAD~3)
**Cause:** `src/lib/explain/explain-prompts.ts` exports `EXPLANATION_MODEL_ID = "gemini-2.0-flash"` but the test expects `"gemini-2.5-flash"`
**Action needed:** Update `EXPLANATION_MODEL_ID` in `explain-prompts.ts` to `"gemini-2.5-flash"` to match the project's intended primary model per CLAUDE.md §2
**Scope:** Out of scope for Phase 09 Plan 01 — pre-existing unrelated failure
