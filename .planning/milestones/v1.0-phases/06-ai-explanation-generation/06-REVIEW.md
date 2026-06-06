---
phase: 06-ai-explanation-generation
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/app/api/internal/analyze-batch/__tests__/route.test.ts
  - src/app/api/internal/analyze-batch/route.ts
  - src/app/api/status/route.ts
  - src/db/database.types.ts
  - src/lib/explain/__tests__/explain-prompts.test.ts
  - src/lib/explain/__tests__/explanation-schema.test.ts
  - src/lib/explain/__tests__/generate-explanation.test.ts
  - src/lib/explain/explain-prompts.ts
  - src/lib/explain/explanation-schema.ts
  - src/lib/explain/generate-explanation.ts
  - src/lib/ingest/__tests__/analyze-document-batch.test.ts
  - src/lib/ingest/__tests__/trigger-parse-batch.test.ts
  - src/lib/ingest/analyze-document-batch.ts
  - src/lib/ingest/embed-document-batch.ts
  - src/lib/ingest/trigger-parse-batch.ts
  - supabase/migrations/20260517120000_explain_jsonb.sql
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 6 introduces the AI explanation generation pipeline: a Gemini-backed orchestration layer (`runAnalyzeBatch`) that reads a document in "analyzing" status, calls `generateExplanation` for a structured 5-section JSON result, persists it to `document_analysis.explanation` (now `jsonb`), and transitions the document to "ready". The cron/`after()` triggering plumbing in `trigger-parse-batch.ts` and the new internal route (`analyze-batch/route.ts`) close the end-to-end pipeline loop.

The design is sound overall. The timing-safe auth helper, cache-hit guard, transient vs permanent error separation, and streaming-accumulation pattern are all handled correctly. The test coverage is thorough for the happy path and several error branches.

Three issues require attention before shipping: a logic hole in `generateExplanation` that silently swallows fresh-upload failures and loops infinitely when `waitForFileReady` returns `PROCESSING` forever, a `FAILED`-state re-upload path that calls `waitForFileReady` a second time but skips persisting the new `fileResourceName` back to the caller, and a `totalPages === 0` edge case that produces a misleading citation bound in the prompt. The remaining findings are lower-severity warnings and informational items.

---

## Critical Issues

### CR-01: Infinite wait loop when Gemini file remains in PROCESSING state indefinitely

**File:** `src/lib/explain/generate-explanation.ts:22-30`
**Issue:** `waitForFileReady` polls `ai.files.get()` every 1500 ms with no timeout or maximum iteration count. If the Gemini Files API returns `state: "PROCESSING"` indefinitely (network stall, quota problem, or upstream bug), this function never returns. Because `generateExplanation` is called inside the Vercel serverless function with `maxDuration = 300`, the function will eventually be killed by Vercel's hard ceiling, but the document will be left in `"analyzing"` status with no error recorded — it will be retried on every subsequent cron tick without ever succeeding.

```typescript
// Current — no escape hatch:
async function waitForFileReady(ai, name) {
  let file = await ai.files.get({ name });
  while (file.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 1500));
    file = await ai.files.get({ name });
  }
  // ...
}

// Fix — add a max-attempts guard (e.g., Gemini's typical processing is <30s):
async function waitForFileReady(ai: GoogleGenAI, name: string): Promise<{ uri: string; mimeType: string }> {
  const MAX_POLLS = 40; // 40 × 1500ms = 60s max
  let file = await ai.files.get({ name });
  let polls = 0;
  while (file.state === "PROCESSING" && polls < MAX_POLLS) {
    await new Promise((r) => setTimeout(r, 1500));
    file = await ai.files.get({ name });
    polls++;
  }
  if (file.state === "PROCESSING") {
    throw new Error(`Gemini file ${name} still PROCESSING after ${MAX_POLLS} polls — aborting.`);
  }
  if (file.state === "FAILED") {
    throw new Error("Gemini file processing failed.");
  }
  if (!file.uri) {
    throw new Error("Gemini file has no URI.");
  }
  return { uri: file.uri, mimeType: file.mimeType ?? "application/pdf" };
}
```

---

## Warnings

### WR-01: Re-uploaded `fileResourceName` is lost when the catch-block re-upload path is taken

**File:** `src/lib/explain/generate-explanation.ts:152-158`
**Issue:** The `catch` block at line 152 calls `uploadFresh()` to re-upload the PDF when the cached resource is expired or FAILED. This sets `resourceName` locally, but `waitForFileReady` is NOT called for the fresh upload inside the `uploadFresh` function — it already handles that correctly. However, the issue is that when the catch path executes, the `resourceName` (and `uri`/`mimeType`) variables declared on lines 131-133 are set inside the try-block's `then`-branch, but control may reach the catch without them being set at all (e.g., if `waitForFileReady` throws before assigning). TypeScript does not catch this because the variables are `let` with no initializer, so reading them after `uploadFresh` completes in the catch block is valid but the `uri` variable used on line 164 may be from the catch re-upload while `resourceName` still has its value — this is fine. But consider the case where `params.fileResourceName` is provided, `waitForFileReady` throws with `FAILED`, and `params.pdfBytes` IS present: the catch re-uploads correctly, BUT the `fileResourceName` returned to `runAnalyzeBatch` (line 193) will be the new one from `fresh.resourceName`. The caller in `runAnalyzeBatch` then checks `if (fileResourceName !== doc.gemini_file_resource_name)` and updates the DB correctly. **However, the test at line 147-164 of `generate-explanation.test.ts` mocks `filesGet` returning `FAILED` and expects re-upload, but the second `filesGet` call inside `waitForFileReady` (called from `uploadFresh`) is not tested for the FAILED-path `uploadFresh`. This means the test does not actually exercise `waitForFileReady` being called a second time on the freshly uploaded file.** More critically: if the second `filesGet` call (inside `uploadFresh` → `waitForFileReady`) also fails, the error propagates out of the catch block as an unhandled rejection, leaving document status as "analyzing" with no soft-fail recorded, because `generateExplanation` doesn't have its own try/catch around the catch-path `uploadFresh` call.

```typescript
// Fix — wrap the catch-path uploadFresh in its own try so errors propagate cleanly:
} catch (err) {
  if (!params.pdfBytes) throw err;
  // uploadFresh can also fail — let it throw naturally so runAnalyzeBatch
  // catches it and records the appropriate error state.
  const fresh = await uploadFresh(ai, params.pdfBytes, params.filename);
  resourceName = fresh.resourceName;
  uri = fresh.uri;
  mimeType = fresh.mimeType;
}
// (No change to code logic — this is already the current code.
// The fix is: DO NOT re-catch inside the outer catch.
// The concern is that uploadFresh itself may throw, which will propagate
// to runAnalyzeBatch's try/catch at line 136 of analyze-document-batch.ts.
// Verify this call path is tested with a mock where filesUpload rejects.)
```

The immediate actionable fix is to add a test that mocks `filesUpload` rejecting inside the re-upload path and verifies `runAnalyzeBatch` transitions the document to "failed".

### WR-02: `totalPages === 0` (or `null`) produces a misleading citation bound in the prompt

**File:** `src/lib/ingest/analyze-document-batch.ts:141`
**Issue:** `doc.total_pages` is nullable in the DB schema (`number | null`). The fallback is `doc.total_pages ?? 0`. This means `buildExplanationPrompt(0, ...)` will generate the instruction: _"The document has 0 total pages; every [p.N] must be a valid page in that range."_ A well-behaved LLM would refuse to emit any citation, producing empty or stub citations in the output. If `total_pages` is genuinely unavailable (e.g., the document was parsed via Gemini Files API only, not through unpdf), a zero value is wrong and will degrade the quality of the explanation.

```typescript
// In analyze-document-batch.ts, around line 141:
// Current:
totalPages: doc.total_pages ?? 0,

// Fix — use a reasonable fallback and/or gate on zero:
const totalPages = doc.total_pages ?? 200; // 200 is a conservative upper bound for IDX reports
// OR: surface a warning/log when total_pages is null so it can be tracked.
```

A better long-term fix would be to add a `total_pages IS NOT NULL` guard before the cache-check step and soft-fail if it is genuinely unknown, but a non-zero fallback is the minimal safe fix.

### WR-03: `EXPLAIN_SYSTEM_PROMPT` export is unused dead code — prompt is duplicated in `buildExplanationPrompt`

**File:** `src/lib/explain/explain-prompts.ts:52-59`
**Issue:** `EXPLAIN_SYSTEM_PROMPT` is exported (lines 52-59) but `buildExplanationPrompt` (lines 78-93) does not reference it — the preamble is inlined verbatim inside `buildExplanationPrompt`'s template literal. This means any future edit to the system prompt rules must be made in TWO places, and the two copies can drift. Currently they are identical, so there is no functional bug, but this is a correctness maintenance risk. The `generate-explanation.ts` file does not import `EXPLAIN_SYSTEM_PROMPT` either.

```typescript
// Fix — have buildExplanationPrompt reuse the constant:
export function buildExplanationPrompt(totalPages: number, isIndonesian: boolean): string {
  const glossaryBlock = isIndonesian
    ? `\n\nBAHASA INDONESIA VOCABULARY REFERENCE (use these English translations in your output):\n${PSAK_GLOSSARY}`
    : "";
  return `${EXPLAIN_SYSTEM_PROMPT} The document has ${totalPages} total pages; every [p.N] must be a valid page in that range.${glossaryBlock}

Produce a JSON object with EXACTLY these five string keys. ...`;
}
```

The exact restructuring depends on whether `EXPLAIN_SYSTEM_PROMPT` is intended to remain as a separate export for testing, but the duplication must be resolved.

### WR-04: `status/route.ts` STUB path does a second select with `.single()` (not `.maybeSingle()`) after an update — will throw on no row

**File:** `src/app/api/status/route.ts:86-112`
**Issue:** The stub pipeline tick code uses `.single()` (lines 89, 99, 109) for all three re-fetch queries after the `update()` call. Unlike `.maybeSingle()`, `.single()` throws a Postgres error if the row is not found. In development/testing, if the `update()` silently fails (e.g., the document was deleted between the update and the re-select, or there is a RLS policy issue), `.single()` will cause an unhandled rejection that propagates out of the `GET` handler, returning a 500 to the client instead of a graceful 404. This is a dev-only path (`STUB_PIPELINE_TICK === "true"`) but can cause confusing failures during local development.

```typescript
// Fix — replace .single() with .maybeSingle() for the stub re-fetch calls:
docQuery = await supabaseAdmin
  .from("documents")
  .select("status, updated_at, error_message")
  .eq("id", doc_id)
  .maybeSingle(); // was: .single()
```

Apply this change at all three re-fetch sites (lines 86-89, 96-99, 106-109).

---

## Info

### IN-01: `isIndonesianDoc` stopword detection is substring-based, causing false positives on partial word matches

**File:** `src/lib/explain/generate-explanation.ts:93-95`
**Issue:** The stopword check uses `sample.includes(w)` (line 94), which matches substrings. For example, the word `"dan"` would match inside `"standard"`, `"Indonesia"`, or `"Scandinavian"`. The threshold of 5 hits helps reduce noise, but an English-language document with common substrings could be misclassified as Indonesian, which wastes prompt tokens on the PSAK glossary block. Low severity at current threshold (5 required), but worth noting.

**Fix:** Switch to whole-word matching: `new RegExp(`\\b${w}\\b`).test(sample)` for each word, or split `sample` on whitespace and check the resulting token set.

### IN-02: `clonePdfBytes` does not actually guarantee a detached buffer

**File:** `src/lib/pdf/clone-pdf-bytes.ts:6` (imported by `generate-explanation.ts`)
**Issue:** `new Uint8Array(bytes)` copies the content into a new typed array, but the comment claims this "avoids DataCloneError when buffers are passed through Blob uploads." A `DataCloneError` occurs when the `ArrayBuffer` underlying the source is transferred (neutered) by a postMessage/worker call. If `pdfBytes` arrives from `dl.data.arrayBuffer()` in `analyze-document-batch.ts` (line 131), it is a fresh buffer from `Blob.arrayBuffer()` and is not neutered, so the clone is unnecessary. The function is harmless but the documentation comment is misleading. No functional issue here.

**Fix:** Update the comment to accurately state the purpose: "creates an independent copy of the typed array's content to ensure the source Uint8Array and its backing buffer are not mutated during upload."

### IN-03: `analyze-batch/route.ts` — `doc_id` from query param is parsed but then handled identically to the body's `doc_id`, obscuring the priority order

**File:** `src/app/api/internal/analyze-batch/route.ts:61-68`
**Issue:** When both `doc_id` is in the request body AND in the URL query params, the body value takes precedence (the query-param branch is only reached when `!docId` after body parsing). This is correct behavior but the code path is not commented, which could confuse a future reader who sees `doc_id` accepted from two sources and assumes they are additive or that the query param is for GET only.

**Fix:** Add a brief comment:
```typescript
// Body doc_id takes precedence; fall back to query param (used by GET requests).
if (!docId) {
  const q = url.searchParams.get("doc_id");
  // ...
}
```

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
