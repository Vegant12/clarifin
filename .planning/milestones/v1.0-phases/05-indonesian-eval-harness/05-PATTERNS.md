# Phase 5: Indonesian Eval Harness — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 6 new fixture files + 1 possible manifest update = 7
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `eval/fixtures/bbcj-ar-variant-bilingual-large-cap-digital-b.json` | fixture (bank) | batch | `eval/fixtures/bbca-ar-bilingual-large-cap-digital.json` | exact — same slot category, same bank revenue semantics |
| `eval/fixtures/mid-cap-quarterly-filing-id.json` | fixture (non-bank digital) | batch | `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` | role-match — same digital PDF, tolerancePct 0.5 |
| `eval/fixtures/long-form-annual-200p-plus.json` | fixture (non-bank digital) | batch | `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` | role-match — same digital PDF, tolerancePct 0.5 |
| `eval/fixtures/mid-cap-annual-manufacturing-id-digital.json` | fixture (non-bank digital) | batch | `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` | role-match — same digital PDF, tolerancePct 0.5 |
| `eval/fixtures/goto-class-small-cap-quarterly-pack.json` | fixture (loss-company digital) | batch | `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` | role-match — digital tolerancePct 0.5; negative net income variant |
| `eval/fixtures/idx-mining-annual-heavy-tables-id.json` | fixture (non-bank digital) | batch | `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` | role-match — same digital PDF, tolerancePct 0.5 |
| `eval/manifest.json` | config | — | `eval/manifest.json` (existing) | exact — no structural change needed; manifest is complete for all 9 slots |

---

## Pattern Assignments

### `eval/fixtures/bbcj-ar-variant-bilingual-large-cap-digital-b.json` (bank fixture, bilingual digital)

**Analog:** `eval/fixtures/bbca-ar-bilingual-large-cap-digital.json` (lines 1-16)

**Complete pattern to copy:**
```json
{
  "documentId": "bbcj-ar-variant-bilingual-large-cap-digital-b",
  "fixtureStatus": "ready",
  "numericExpectations": [
    { "key": "revenue_latest_year",                "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "net_income_latest_year",             "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_assets_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_equity_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "operating_cash_flow_latest_year",    "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 }
  ],
  "citationExpectations": [
    { "id": "income_statement_citation", "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "balance_sheet_citation",   "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "cash_flow_citation",       "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] }
  ]
}
```

**Bank-specific revenue rule (from BBCA analog, line 5):**
`revenue_latest_year` = net interest income + non-interest operating income = total operating income (pendapatan operasional).
BBCA's figure is `87397774000000` — this is NOT loan origination volume. Apply the same definition to BJBR.
Starting-point web figure for BJBR 2023: net interest income ~10 T → full IDR `10000000000000`; confirm against PDF.

**Denomination note:** BJBR states figures in "jutaan Rupiah" (millions). If printed value is e.g. `14,262,123`, fixture value = `14262123000000` (× 1,000,000). Confirm with the header note on the first page of the financial statements.

---

### `eval/fixtures/mid-cap-quarterly-filing-id.json` (SMGR Q3 2023, digital PDF)

**Analog:** `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` (lines 1-16)

**Complete pattern to copy:**
```json
{
  "documentId": "mid-cap-quarterly-filing-id",
  "fixtureStatus": "ready",
  "numericExpectations": [
    { "key": "revenue_latest_year",                "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "net_income_latest_year",             "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_assets_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_equity_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "operating_cash_flow_latest_year",    "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 }
  ],
  "citationExpectations": [
    { "id": "income_statement_citation", "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "balance_sheet_citation",   "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "cash_flow_citation",       "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] }
  ]
}
```

**Quarterly-specific caution:** Quarterly filings are unaudited. `revenue_latest_year` and `net_income_latest_year` are 9-month YTD figures (January–September 2023), NOT full-year. The PROMPT_EVAL_BASE instructs Gemini to use "most recent year column only" — for a Q3 filing this is the YTD column. Confirm column header says "30 September 2023" before recording.

**Denomination note:** SMGR states figures in "jutaan Rupiah". Starting-point web figure for SMGR 2023 full-year revenue = 38.65 T → Q3 YTD will be lower; verify from the actual quarterly PDF page.

---

### `eval/fixtures/long-form-annual-200p-plus.json` (ASII 2023, large conglomerate, digital PDF)

**Analog:** `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` (lines 1-16)

**Complete pattern to copy:**
```json
{
  "documentId": "long-form-annual-200p-plus",
  "fixtureStatus": "ready",
  "numericExpectations": [
    { "key": "revenue_latest_year",                "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "net_income_latest_year",             "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_assets_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_equity_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "operating_cash_flow_latest_year",    "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 }
  ],
  "citationExpectations": [
    { "id": "income_statement_citation", "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "balance_sheet_citation",   "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "cash_flow_citation",       "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] }
  ]
}
```

**Conglomerate-specific caution:** ASII's 200+ page report contains both consolidated and parent-only tables. The table header must say "Laporan Keuangan Konsolidasian" — NOT "Entitas Induk". `net_income_latest_year` = net income attributable to owners of the parent (not minority interest). Starting-point web figures: revenue ~316.56 T → `316560000000000`; net income ~33.83 T → `33830000000000`. All must be confirmed from the PDF.

**allowedPages note:** ASII's financial statements will appear deep in a 200+ page document. PDF page index will be substantially higher than printed footer page numbers — expect cover/intro sections adding 20-50 pages before the statements begin.

---

### `eval/fixtures/mid-cap-annual-manufacturing-id-digital.json` (INDF 2023, manufacturing, digital bilingual PDF)

**Analog:** `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` (lines 1-16)

**Complete pattern to copy:**
```json
{
  "documentId": "mid-cap-annual-manufacturing-id-digital",
  "fixtureStatus": "ready",
  "numericExpectations": [
    { "key": "revenue_latest_year",                "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "net_income_latest_year",             "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_assets_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_equity_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "operating_cash_flow_latest_year",    "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 }
  ],
  "citationExpectations": [
    { "id": "income_statement_citation", "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "balance_sheet_citation",   "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "cash_flow_citation",       "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] }
  ]
}
```

**Consolidation caution:** INDF's PDF contains both Indofood group consolidated and parent-only (Entitas Induk) statements. Record only from "Laporan Keuangan Konsolidasian". INDF consolidated revenue is the group figure (~123.49 T); parent-only will be far lower. The INDF filing is bilingual (English/Indonesian) — financial tables are in Indonesian; use Indonesian column headers to locate the correct figures.

---

### `eval/fixtures/goto-class-small-cap-quarterly-pack.json` (GOTO 2023 full-year, loss-making, digital PDF)

**Analog:** `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` (lines 1-16) — structural pattern only; negative net income is a new variant

**Complete pattern to copy:**
```json
{
  "documentId": "goto-class-small-cap-quarterly-pack",
  "fixtureStatus": "ready",
  "numericExpectations": [
    { "key": "revenue_latest_year",                "valueIDR": <VERIFY_FROM_PDF>,  "tolerancePct": 0.5 },
    { "key": "net_income_latest_year",             "valueIDR": <NEGATIVE_INTEGER>, "tolerancePct": 0.5 },
    { "key": "total_assets_latest_year",           "valueIDR": <VERIFY_FROM_PDF>,  "tolerancePct": 0.5 },
    { "key": "total_equity_latest_year",           "valueIDR": <VERIFY_FROM_PDF>,  "tolerancePct": 0.5 },
    { "key": "operating_cash_flow_latest_year",    "valueIDR": <VERIFY_FROM_PDF>,  "tolerancePct": 0.5 }
  ],
  "citationExpectations": [
    { "id": "income_statement_citation", "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "balance_sheet_citation",   "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "cash_flow_citation",       "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] }
  ]
}
```

**Loss-company rule:** `net_income_latest_year` must be a **negative integer** in full IDR. GOTO 2023 net loss ~90.63 T → `valueIDR: -90630000000000` (verify from PDF). The `withinTolerance()` function in `score-run.ts` uses `Math.abs(expected)` in the denominator — negative values are handled correctly. Do NOT omit this key or flip the sign to positive.

**Revenue definition:** GOTO reports "net revenue" (revenues net of incentives/promotions). Use the net revenue figure, not gross transaction value (GTV). Starting-point web figure: ~14.78 T → `14780000000000`.

**Document choice:** Use the IDX-filed full-year 2023 audited financial statements (`LK GOTO_31 Des 2023.pdf` from idx.co.id) — audited figures are more reliable than quarterly packs.

---

### `eval/fixtures/idx-mining-annual-heavy-tables-id.json` (PTBA 2023, mining, digital PDF)

**Analog:** `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` (lines 1-16)

**Complete pattern to copy:**
```json
{
  "documentId": "idx-mining-annual-heavy-tables-id",
  "fixtureStatus": "ready",
  "numericExpectations": [
    { "key": "revenue_latest_year",                "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "net_income_latest_year",             "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_assets_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "total_equity_latest_year",           "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 },
    { "key": "operating_cash_flow_latest_year",    "valueIDR": <VERIFY_FROM_PDF>, "tolerancePct": 0.5 }
  ],
  "citationExpectations": [
    { "id": "income_statement_citation", "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "balance_sheet_citation",   "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] },
    { "id": "cash_flow_citation",       "allowedPages": [<PDF_IDX>, <PDF_IDX+1>, <PDF_IDX+2>] }
  ]
}
```

**Denomination-scale caution:** Mining companies often state figures in "miliaran Rupiah" (billions), not "jutaan" (millions). PTBA may use either. If the cover note says "miliaran", multiply printed figures by 1,000,000,000 (not 1,000,000). Starting-point web figures: revenue ~38.5 T → `38500000000000`; net income ~6.11 T → `6110000000000`. Confirm denomination note before applying any multiplier.

---

### `eval/manifest.json` (config — no structural change needed)

**Analog:** `eval/manifest.json` (existing, lines 1-59)

The manifest already contains all 9 slot entries with correct `id`, `label`, `relativePdf`, and `relativeGroundTruth` paths. No modifications are required. The planner should NOT add, remove, or rename any manifest entries. The only action for each new document is updating the corresponding fixture file from `placeholder` to `ready`.

---

## Shared Patterns

### fixtureStatus Transition
**Source:** `eval/fixtures/bbca-ar-bilingual-large-cap-digital.json` line 3 and `eval/fixtures/bbcj-ar-variant-bilingual-large-cap-digital-b.json` line 3
**Apply to:** All 6 placeholder fixtures being curated
```json
"fixtureStatus": "ready"
```
A placeholder fixture has `"fixtureStatus": "placeholder"` and empty arrays. Switching to `"ready"` with non-empty arrays is the single state change that flips harness behavior from exit-non-zero to scoreable.

### Five Standard Keys — Always All Five
**Source:** `eval/fixtures/bbca-ar-bilingual-large-cap-digital.json` lines 5-9 and `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` lines 5-9
**Apply to:** All 6 new fixtures
```json
{ "key": "revenue_latest_year",             "valueIDR": <integer>, "tolerancePct": <rate> },
{ "key": "net_income_latest_year",          "valueIDR": <integer>, "tolerancePct": <rate> },
{ "key": "total_assets_latest_year",        "valueIDR": <integer>, "tolerancePct": <rate> },
{ "key": "total_equity_latest_year",        "valueIDR": <integer>, "tolerancePct": <rate> },
{ "key": "operating_cash_flow_latest_year", "valueIDR": <integer>, "tolerancePct": <rate> }
```
All five keys are expected by `PROMPT_EVAL_BASE`. Omit a key only if the document truly does not contain that financial line item (rare for IDX-listed companies).

### Three Citation IDs — Always All Three
**Source:** `eval/fixtures/bbca-ar-bilingual-large-cap-digital.json` lines 12-14 and `eval/fixtures/tlkm-ar-id-only-mid-cap-digital.json` lines 12-14
**Apply to:** All 6 new fixtures
```json
{ "id": "income_statement_citation", "allowedPages": [N, N+1, N+2] },
{ "id": "balance_sheet_citation",    "allowedPages": [N, N+1, N+2] },
{ "id": "cash_flow_citation",        "allowedPages": [N, N+1, N+2] }
```
Always a 3-page window (current, +1, +2) to cover renderer variance. Page indices are PDF absolute positions (1-based), NOT printed footer page numbers.

### tolerancePct by Document Type
**Source:** `eval/fixtures/bbca-ar-bilingual-large-cap-digital.json` (0.5), `eval/fixtures/small-cap-scanned-annual.json` (2.0)
**Apply to:** All fixtures
- `0.5` — digital PDFs (all 6 new Wave 2 fixtures)
- `2.0` — scanned/image-heavy PDFs (`small-cap-scanned-annual` only; do not apply to any new fixture unless it is verified to be scanned)

### valueIDR Full Integer Rule
**Source:** `eval/fixtures/bbca-ar-bilingual-large-cap-digital.json` line 5 (`87397774000000`)
**Apply to:** All 6 new fixtures
`valueIDR` is always the full Rupiah integer — never the raw printed figure from the statement.
- "dalam jutaan Rupiah": printed_number × 1,000,000
- "dalam miliaran Rupiah": printed_number × 1,000,000,000
- "dalam Rupiah penuh": printed_number × 1 (no multiplier)

---

## No Analog Found

All 6 placeholder fixture files share the same JSON structure as the existing `ready` fixtures. There are no files in this phase without a close codebase analog.

The only genuinely new variant is the **negative `valueIDR`** for GOTO's net loss — this pattern has no existing fixture example in the codebase. The planner should note that this is mathematically supported by `withinTolerance()` in `src/lib/eval/score-run.ts` (uses `Math.abs(expected)` in denominator) and confirm it with a quick unit-test run before committing the GOTO fixture.

---

## Metadata

**Analog search scope:** `eval/fixtures/`, `eval/manifest.json`
**Files scanned:** 9 fixture files + 1 manifest
**Pattern extraction date:** 2026-05-13
