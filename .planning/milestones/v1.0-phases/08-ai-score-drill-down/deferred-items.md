# Phase 08 Deferred Items

## Pre-existing failures (out of scope for Plans 02+)

### explain-prompts.test.ts: EXPLANATION_MODEL_ID mismatch

- **File:** `src/lib/explain/__tests__/explain-prompts.test.ts` line 11
- **Issue:** Test asserts `EXPLANATION_MODEL_ID` equals `"gemini-2.5-flash"` but the source file `explain-prompts.ts` exports `"gemini-2.0-flash"` (Phase 6 value, correct per AI-SPEC).
- **Impact:** 1 failing test in the explain tests suite. Pre-existing before Plan 02 — confirmed by `git stash` verification.
- **Resolution:** Either the test is wrong (should assert `"gemini-2.0-flash"`) or `explain-prompts.ts` needs to be updated to `gemini-2.5-flash`. Per AI-SPEC §4, the explanation model is intentionally `gemini-2.0-flash`; the test assertion appears to be a copy-paste error from Plan 02 scope.
- **Owner:** Plan 03 or a dedicated cleanup plan should fix the test assertion to match the intended value.
