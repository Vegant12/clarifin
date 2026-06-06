---
phase: 07-citation-ui-pdf-viewer
plan: "01"
subsystem: api-data-layer
tags:
  - api
  - data
  - citations
  - jargon
  - phase-7

dependency_graph:
  requires:
    - "Phase 3: PDF parsing (chunks table with page_number)"
    - "Phase 4: Embeddings (chunks embedded, doc ownership via session_id)"
  provides:
    - "GET /api/page-text endpoint for citation hover text retrieval"
    - "jargonDictionary typed module for term tooltip rendering"
  affects:
    - "Plan 07-02: citation + jargon UI (consumes both artifacts directly)"

tech_stack:
  added: []
  patterns:
    - "Route handler mirrors /api/status pattern: zod schema → param guard → safeParse → session lookup → ownership check → data fetch"
    - "vi.hoisted() + chainable mock object for multi-step Supabase query chains in Vitest"
    - "Static JSON dictionary imported at build time as typed Record<string,string>"

key_files:
  created:
    - src/app/api/page-text/route.ts
    - src/lib/jargon/jargon-dictionary.json
    - src/lib/jargon/index.ts
    - tests/api/page-text.test.ts
    - tests/lib/jargon-dictionary.test.ts
  modified:
    - vitest.config.ts

decisions:
  - "Placed test files in tests/ directory (not src/) as plan specified; updated vitest.config.ts to include tests/**/*.test.ts"
  - "Used vi.hoisted() with a single shared chain object and mockResolvedValueOnce sequence to handle three sequential Supabase calls"
  - "Removed 'vs.' abbreviation from debt-to-equity definition to satisfy single sentence-terminating period rule"

metrics:
  duration: "~25 minutes"
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 7 Plan 01: Data Layer Foundations Summary

**One-liner:** Page-text API endpoint with session ownership enforcement and a 66-entry typed jargon dictionary covering all JARGON-02 required terms plus PSAK Bahasa Indonesia vocabulary.

## What Was Built

### GET /api/page-text

**Route:** `src/app/api/page-text/route.ts`

**Parameters:**
| Param | Type | Validation |
|-------|------|------------|
| `doc_id` | UUID string | `z.string().uuid()` |
| `session_token` | UUID string | `z.string().uuid()` |
| `page` | positive integer | `z.coerce.number().int().positive()` |

**Success response (200):**
```json
{ "text": "<chunk content for requested page>" }
```

**Error responses:**
| Status | Condition | Body |
|--------|-----------|------|
| 400 | Any param missing | `{ error: "Missing...", missing: { doc_id: bool, session_token: bool, page: bool } }` |
| 400 | Invalid UUID or non-positive page | `{ error: "doc_id must be a valid UUID; session_token must be a valid UUID; page must be a positive integer" }` (only failing field(s) included) |
| 404 | session_token not in chat_sessions | `{ error: "Document not found." }` |
| 404 | doc_id not owned by session | `{ error: "Document not found." }` |
| 404 | No chunk for doc_id + page | `{ error: "Page text not found." }` |

**Security:** Session ownership enforced via two-step lookup (chat_sessions → documents.session_id) before any chunk content is returned. Mirrors the proven /api/status pattern exactly.

### jargon-dictionary.json

**File:** `src/lib/jargon/jargon-dictionary.json`

**Entry count:** 66 entries

**JARGON-02 required English keys (all present):**
`revenue`, `ebitda`, `gross margin`, `operating margin`, `net margin`, `roe`, `roa`, `current ratio`, `quick ratio`, `debt-to-equity`, `p/e`, `p/b`, `dividend yield`, `free cash flow`

**PSAK Bahasa Indonesia keys (all present):**
`laba bersih`, `aset lancar`, `ekuitas`, `laba ditahan`, `pendapatan komprehensif lain`, `catatan atas laporan keuangan`, `beban pokok penjualan`, `arus kas dari aktivitas operasi`

**Additional IDX-relevant terms (44 more):** working capital, accounts receivable/payable, inventory turnover, asset turnover, interest coverage ratio, debt service coverage, leverage ratio, book value, market cap, earnings per share, price to sales, enterprise value, operating cash flow, capex, depreciation, amortization, goodwill, intangible assets, deferred tax, minority interest, retained earnings, shareholders equity, treasury stock, gross profit, operating profit, net income, comprehensive income, dividend payout ratio, payout ratio, sga, cost of revenue, gross profit margin, pendapatan, beban operasi, laba kotor, laba operasi, modal kerja, kewajiban lancar, kewajiban jangka panjang, total aset, total liabilitas, marjin laba kotor, marjin operasi.

### src/lib/jargon/index.ts

Exports:
- `jargonDictionary: JargonDictionary` — the full dictionary as `Record<string, string>`
- `JargonDictionary` — the type alias

## How Plan 02 Should Call the Route

```typescript
// Fetch page text for a citation hover popover
const url = new URL("/api/page-text", window.location.origin);
url.searchParams.set("doc_id", docId);
url.searchParams.set("session_token", sessionToken);
url.searchParams.set("page", String(pageNumber));

const res = await fetch(url.toString());
if (!res.ok) {
  // 404 → page has no chunk text (show "Text not available for this page")
  // 400 → programming error, log and hide popover
  return null;
}
const { text } = await res.json(); // string
```

Per D-07 (07-CONTEXT.md): cache responses client-side in a `Map<string, string>` keyed by `${docId}:${page}` to avoid re-fetching the same page text on repeated hover.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated vitest.config.ts to include tests/ directory**
- **Found during:** Task 1 setup
- **Issue:** vitest.config.ts only included `src/**/*.test.ts`; plan specifies test files at `tests/api/` and `tests/lib/` which would not be discovered
- **Fix:** Added `tests/**/*.test.ts` and `tests/**/*.test.tsx` to the `include` array
- **Files modified:** `vitest.config.ts`
- **Commit:** fa1fa14

**2. [Rule 1 - Bug] Fixed maybeSingle typo in test mock chain**
- **Found during:** Task 1 RED→GREEN
- **Issue:** `vi.hoisted()` chain object had `chain.maybySingle` (typo with 'y') instead of `chain.maybeSingle`; caused `maybeSingle is not a function` for tests 7–10
- **Fix:** Renamed chain property to `chain.maybeSingle` to match the Supabase client method name
- **Files modified:** `tests/api/page-text.test.ts`
- **Commit:** fa1fa14

**3. [Rule 1 - Bug] Fixed extra period in "debt-to-equity" definition**
- **Found during:** Task 2 RED→GREEN
- **Issue:** Definition contained `vs. ` which matched the trailing-dot regex `/\.(?=\s|$)/g`, causing the one-sentence test to fail with count=2
- **Fix:** Replaced `vs. owner funding` with `compared to owner funding`
- **Files modified:** `src/lib/jargon/jargon-dictionary.json`
- **Commit:** 06210ea

## TDD Gate Compliance

Both tasks followed RED/GREEN/REFACTOR:
- Task 1: RED (module-not-found) → GREEN (all 10 pass) → no refactor needed
- Task 2: RED (module-not-found) → GREEN (6/7 pass, 1 fail on period rule) → fix definition → GREEN (all 7 pass)

All gate commits are present (feat(07-01) commits include both test files and implementation).

## Self-Check: PASSED

Files exist:
- `src/app/api/page-text/route.ts`: FOUND
- `src/lib/jargon/jargon-dictionary.json`: FOUND
- `src/lib/jargon/index.ts`: FOUND
- `tests/api/page-text.test.ts`: FOUND
- `tests/lib/jargon-dictionary.test.ts`: FOUND

Commits exist:
- fa1fa14: FOUND
- 06210ea: FOUND
