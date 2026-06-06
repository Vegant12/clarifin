---
phase: 09-stock-data-trend-chart
plan: 02
subsystem: stock-data, ingest
tags: [ticker-detection, regex, pure-function, parse-pipeline, tdd, TICKER-01]

# Dependency graph
requires:
  - phase: 09-01
    provides: Wave 0 detect-ticker.test.ts stub (replaced by real tests in this plan)
  - phase: 06-ai-explanation-generation
    provides: documents table with ticker column (string | null)

provides:
  - detectTicker pure function (regex only, no LLM, bounded to first 5 pages)
  - IDX_TICKER_BLOCKLIST (ReadonlySet of 14 false-positive abbreviations)
  - 16 real assertions in detect-ticker.test.ts (replaces 6 Wave 0 todos)
  - parse-document-batch bootstrap UPDATE writes ticker alongside total_pages + extraction_source

affects:
  - 09-03-PLAN (fetch-stock-data reads documents.ticker to decide whether to fetch)
  - 09-04-PLAN (RSC page.tsx reads documents.ticker to render stock widget)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN: stub todos → failing assertions → implementation → all green
    - Pure regex ticker detection: context-anchored prefix + XXXX Tbk proximity patterns
    - Soft-fail try/catch on integration point: ticker failure logs, does not fail parse

key-files:
  created:
    - src/lib/stock/detect-ticker.ts
  modified:
    - src/lib/stock/detect-ticker.test.ts (replaced 6 Wave 0 todos with 16 real assertions)
    - src/lib/ingest/parse-document-batch.ts (import + detectTicker call + ticker field in UPDATE)

key-decisions:
  - "Two regex patterns: context-anchored prefix (Kode Efek/BEI/IDX/Kode saham/Kode Emiten) first, XXXX Tbk proximity second — order ensures more specific pattern wins"
  - "IDX and BEI are in the blocklist to prevent self-referential false positives (e.g., 'IDX: BBCA' would match IDX as ticker via pattern 2 if not blocked)"
  - "detectTicker receives bootstrapTexts.texts directly (full list); internal slice(0,5) bounds the scan — no double-slicing at call site"
  - "Soft-fail wraps detectTicker call in parse-document-batch; ticker: null on exception keeps parse pipeline alive"

patterns-established:
  - "Pattern: Pure detector module — no imports, no side effects, defensive try/catch at function root"
  - "Pattern: Blocklist as ReadonlySet<string> exported alongside function for testability"

requirements-completed: [TICKER-01]

# Metrics
duration: 8min
completed: 2026-05-20
---

# Phase 09 Plan 02: Ticker Detection Summary

**Pure regex IDX ticker detector (TICKER-01) with 16 passing tests; wired into parse-document-batch bootstrap UPDATE so every newly parsed document has its ticker written to documents.ticker automatically**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-05-20
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- Implemented `detectTicker(pageTexts: string[]): string | null` in `src/lib/stock/detect-ticker.ts` — pure regex, no LLM, bounded to first 5 pages via `.slice(0, 5)`
- Exported `IDX_TICKER_BLOCKLIST` as a `ReadonlySet<string>` of 14 common false-positive abbreviations (PSAK, IFRS, GAAP, BANK, NOTE, etc.)
- Replaced 6 Wave 0 `it.todo` stubs in `detect-ticker.test.ts` with 16 real assertions covering all TICKER-01 patterns: prefix patterns, XXXX Tbk, blocklist rejection, bounded window, case-insensitivity, null safety, and defensive try/catch
- Wired `detectTicker` into `parse-document-batch.ts` bootstrap UPDATE: single `documents.update()` call now writes `total_pages`, `extraction_source`, AND `ticker` — no extra DB round-trip; soft-fail on exception

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | detectTicker failing tests | `1c7483d` | src/lib/stock/detect-ticker.test.ts |
| 1 (GREEN) | detectTicker implementation | `283f26c` | src/lib/stock/detect-ticker.ts |
| 2 | Wire into parse-document-batch | `ffceb28` | src/lib/ingest/parse-document-batch.ts |

## Files Created/Modified

- `src/lib/stock/detect-ticker.ts` — new pure function + blocklist (41 lines)
- `src/lib/stock/detect-ticker.test.ts` — 16 real assertions (replaced 6 Wave 0 todos)
- `src/lib/ingest/parse-document-batch.ts` — import + try/catch detectTicker call + ticker field in bootstrap UPDATE

## Decisions Made

- **Two regex patterns, order matters:** Context-anchored prefix pattern (Kode Efek/BEI/IDX/Kode saham/Kode Emiten) runs first; XXXX Tbk proximity second. More specific wins, prevents false Tbk matches on well-labeled documents.
- **IDX and BEI in blocklist:** Prevents self-referential false positives — "IDX: BBCA" would match "IDX" as the 4-letter candidate via the Tbk pattern if not blocked. The prefix pattern captures the group after the colon, so IDX/BEI in the blocklist only blocks pattern 2.
- **Full texts array passed to detectTicker:** `detectTicker(bootstrapTexts.texts)` — the function internally does `.slice(0, 5)`. No double-slicing at the call site; keeps the call site clean and consistent with the function contract.

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the exact code in the plan's `<action>` block verbatim.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm test --run src/lib/stock/detect-ticker.test.ts` exits 0 | PASS (16/16) |
| `pnpm test --run src/lib/ingest/` exits 0 | PASS (17 tests, no regression) |
| `pnpm typecheck` exits 0 | PASS |
| `grep -c 'detectTicker' parse-document-batch.ts` >= 3 | PASS (4 occurrences) |
| `ticker: detectedTicker` present in documents.update() | PASS |
| `[runParseBatch] detectTicker threw` error log present | PASS |
| No `it.todo` in detect-ticker.test.ts | PASS |

## Known Stubs

None — all TICKER-01 behavior is fully implemented. The `documents.ticker` field is written on every first parse. Plans 03 and 04 read this field.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Ticker detection runs entirely inside the existing parse pipeline trust boundary, consuming already-extracted page text. Threats T-09-02-01 through T-09-02-03 are mitigated as documented in the plan's threat register.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/stock/detect-ticker.ts exists | PASS |
| src/lib/stock/detect-ticker.test.ts exists (16 assertions) | PASS |
| src/lib/ingest/parse-document-batch.ts contains detectTicker import | PASS |
| Commits 1c7483d, 283f26c, ffceb28 in git log | PASS |
| pnpm typecheck exits 0 | PASS |
| All 16 detect-ticker tests pass | PASS |

---
*Phase: 09-stock-data-trend-chart*
*Completed: 2026-05-20*
