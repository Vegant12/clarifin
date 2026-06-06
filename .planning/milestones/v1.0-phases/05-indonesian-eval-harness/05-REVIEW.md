---
phase: 05-indonesian-eval-harness
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - eval/README.md
  - eval/fixtures/bbca-ar-bilingual-large-cap-digital.json
  - eval/fixtures/bbcj-ar-variant-bilingual-large-cap-digital-b.json
  - eval/fixtures/goto-class-small-cap-quarterly-pack.json
  - eval/fixtures/idx-mining-annual-heavy-tables-id.json
  - eval/fixtures/long-form-annual-200p-plus.json
  - eval/fixtures/mid-cap-annual-manufacturing-id-digital.json
  - eval/fixtures/mid-cap-quarterly-filing-id.json
  - eval/fixtures/small-cap-scanned-annual.json
  - eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json
  - src/lib/eval/gemini-eval-extract.ts
  - src/lib/eval/load-manifest.ts
  - src/lib/eval/prompts.ts
  - src/lib/eval/schema.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the Phase 5 eval harness: four TypeScript source files (extraction wrapper, manifest loader, prompt constants, Zod schemas) and nine JSON fixture files. The harness architecture is sound — Zod validation is applied at every parse boundary, cleanup runs in `finally`, and the scoring logic correctly handles negative values (GOTO). No critical security or data-loss issues were found.

Four warnings require attention before this harness is extended to Phase 6 or additional fixtures:

1. `waitForFileReady` has no iteration limit and will loop forever if Gemini's Files API returns `PROCESSING` indefinitely.
2. Three fixtures (bbca, tlkm, mid-cap-quarterly) have overlapping `allowedPages` across citation IDs, which can produce false-positive citation scores.
3. The extraction prompt does not instruct Gemini how to encode loss/negative values (parenthesis notation is standard in Indonesian financial statements), leaving ambiguity for any new fixture with negative figures.
4. The JSON extraction in `parseEvalExtractionResponse` slices between the outermost `{` and `}` characters — if a `text` field inside a `citedFact` entry happens to contain a closing brace, `lastIndexOf("}")` will silently truncate the JSON and cause a parse error instead of a clear message.

---

## Warnings

### WR-01: Infinite loop in `waitForFileReady` — no retry limit

**File:** `src/lib/eval/gemini-eval-extract.ts:17-20`
**Issue:** The `while (file.state === "PROCESSING")` loop polls Gemini every 1500 ms with no maximum iteration count. If the Gemini Files API gets stuck in `PROCESSING` (network partition, transient service issue), `extractEvalClaims` never returns and the eval process hangs until the host OS kills it. This also means no useful error message is surfaced to the operator.
**Fix:**
```typescript
const MAX_POLLS = 120; // 3 minutes at 1500 ms
let polls = 0;
while (file.state === "PROCESSING") {
  if (++polls > MAX_POLLS) {
    throw new Error(`Gemini file ${name} stuck in PROCESSING after ${MAX_POLLS} polls.`);
  }
  await new Promise((r) => setTimeout(r, 1500));
  file = await ai.files.get({ name });
}
```

---

### WR-02: Overlapping `allowedPages` across citation IDs causes false-positive scoring

**Files:**
- `eval/fixtures/bbca-ar-bilingual-large-cap-digital.json:11-15`
- `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json:11-15`
- `eval/fixtures/mid-cap-quarterly-filing-id.json:11-15`

**Issue:** In three fixtures, the `allowedPages` windows for adjacent citation IDs share at least one page number:

| Fixture | Shared page(s) |
|---------|----------------|
| bbca | page 9 in `income_statement_citation` and `balance_sheet_citation` |
| tlkm | pages 9 and 10 in `income_statement_citation` and `balance_sheet_citation` |
| mid-cap-quarterly | page 9 in `income_statement_citation` and `cash_flow_citation` |

The scoring logic in `score-run.ts:42` checks whether any cited page falls in the allowed set. If Gemini cites page 9 for both the income statement and the balance sheet, both checks pass even if one citation is incorrect. This inflates citation accuracy and undermines the reliability of the 90% gate.

**Fix:** Audit each fixture against the actual PDF to ensure the `allowedPages` windows for different statement types do not share page numbers. Where statements genuinely span adjacent pages, tighten the window to the page where each statement *starts*:
```json
{ "id": "income_statement_citation", "allowedPages": [9, 10, 11] },
{ "id": "balance_sheet_citation",    "allowedPages": [7, 8] }
```

---

### WR-03: Extraction prompt silent on negative-value encoding

**File:** `src/lib/eval/prompts.ts:19`
**Issue:** The prompt instructs Gemini to multiply by the denomination (`×1,000,000 for jutaan`, etc.) but says nothing about signed values. Indonesian financial statements conventionally represent losses and negative cash flows in parentheses — `(90,395,629)` rather than `-90,395,629`. Without explicit instruction, Gemini may return a positive number for a loss figure. This only affects documents with net losses (currently the GOTO fixture). The eval happened to pass, but this is fragile: a future Gemini model revision or a different loss-reporting document could break it silently.

**Fix:** Add one rule to `PROMPT_EVAL_BASE`:
```
- Negative values (losses, outflows) use negative integers. Parentheses notation (90,395,629) means the amount is negative: encode as -90395629000000, not +90395629000000.
```

---

### WR-04: `lastIndexOf("}")` truncation risk in `parseEvalExtractionResponse`

**File:** `src/lib/eval/load-manifest.ts:29-31`
**Issue:** After stripping markdown fences, the function locates the JSON payload by finding the first `{` and the *last* `}` in the response string. Because `responseMimeType: "application/json"` is set in `gemini-eval-extract.ts`, Gemini should return clean JSON without fences, making the fence-stripping redundant. However, if a `text` field inside `citedFacts` contains a `}` character (e.g., a quoted passage from the financial statement), `lastIndexOf("}")` correctly lands on the outermost closing brace only if the JSON is well-formed — but if Gemini omits a closing brace (a known truncation failure mode at quota limits), the slice silently chops the JSON and `JSON.parse` throws a cryptic syntax error rather than a clear "truncated response" message.

The double-parse path (fence strip then bracket slice) is also dead code when structured JSON mode is active.

**Fix:** Since `responseMimeType: "application/json"` guarantees no markdown fences, simplify to:
```typescript
export function parseEvalExtractionResponse(body: string): EvalExtraction {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) {
    throw new Error(`Gemini response is not JSON. Got: ${trimmed.slice(0, 120)}`);
  }
  return extractionResultSchema.parse(JSON.parse(trimmed) as unknown);
}
```
This surfaces Gemini truncation or structural errors as clear messages rather than silent slicing.

---

## Info

### IN-01: `z.number().int().positive()` rejects page 0 — may cause spurious schema failures

**File:** `src/lib/eval/schema.ts:9,16,36`
**Issue:** `citedPages`, `sourcePage`, and `allowedPages` all use `.positive()` which enforces `> 0`. This is intentional if all PDFs use 1-based page numbering, but the Gemini Files API returns 0-based page indices for some document types. If a citation lands on page 0 in the Gemini response, `extractionResultSchema.parse()` throws a Zod validation error and the entire document is failed rather than just that citation. All current fixtures start at page 4 or higher, so this has not yet triggered, but it is a latent risk.

**Fix:** If page numbering conventions across the corpus are confirmed as 1-based, add a comment to document the assumption. If there is uncertainty, change `.positive()` to `.nonnegative()` and handle the edge case in scoring:
```typescript
citedPages: z.array(z.number().int().nonnegative()).min(1),
```

---

### IN-02: Prompt instructs `net_income` to be "attributable to owners of parent" but `total_equity` is "not total equity including NCI" — asymmetric wording may confuse

**File:** `src/lib/eval/prompts.ts:17-18`
**Issue:** The prompt uses positive framing for `net_income` ("profit attributable to owners of the parent") but negative/exclusionary framing for `total_equity` ("not total equity including NCI"). Indonesian reports frequently list both equity sub-totals adjacent to each other; the exclusionary phrasing for equity is less reliable than an explicit "use the sub-total labeled *Ekuitas yang dapat diatribusikan kepada pemilik entitas induk*". The bbcj fixture scored 80% numeric — the missing key is likely `operating_cash_flow`, but unclear NCI-vs-total-equity instructions could also be a contributing factor in future documents with complex ownership structures.

**Fix:**
```
- total_equity_latest_year = equity attributable to owners of the parent (Ekuitas yang dapat diatribusikan kepada pemilik entitas induk). Use the subtotal row, not the grand total that includes non-controlling interests (kepentingan non-pengendali).
```

---

### IN-03: Commented-out code style — `/* best-effort */` comment in catch block

**File:** `src/lib/eval/gemini-eval-extract.ts:39`
**Issue:** The empty catch block in `cleanupIfFresh` swallows all errors from `ai.files.delete`. While the intent ("best-effort cleanup") is documented by the comment, a failed cleanup leaks a Gemini Files API slot for 48 hours. At the current free-tier quota of 20 GB/project, this is low risk, but a log line would help diagnose cleanup failures during development.

**Fix:**
```typescript
} catch (e) {
  // best-effort — file will auto-expire after 48 h
  console.warn("Gemini file cleanup failed (non-fatal):", e instanceof Error ? e.message : e);
}
```

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
