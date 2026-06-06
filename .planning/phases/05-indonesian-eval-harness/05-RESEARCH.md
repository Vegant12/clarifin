# Phase 5: Indonesian Eval Harness — Research

**Researched:** 2026-05-13
**Domain:** IDX corpus curation — PDF acquisition + ground-truth fixture authoring for an already-built eval harness
**Confidence:** HIGH (harness code fully verified by reading it; PDF sources verified via web search; financial figures from web with MEDIUM confidence pending audited-statement cross-check)

---

## Summary

The eval harness infrastructure is complete and merged. `pnpm eval` runs, `scripts/eval/run.ts` drives the extract-and-score loop, `src/lib/eval/score-run.ts` computes numeric and citation accuracy, and `src/lib/eval/gemini-eval-extract.ts` handles the Gemini Files API upload-poll-extract cycle. Vitest unit tests in `score-run.test.ts` and `fixture-io.test.ts` cover offline scoring logic.

What remains is pure corpus curation: obtaining 6 missing PDFs and populating 6 placeholder fixtures with audited ground-truth values. Three documents already have PDFs and `"ready"` fixtures (`bbca-ar-bilingual-large-cap-digital`, `tlkm-ar-id-only-mid-cap-digital`, `small-cap-scanned-annual`). Six remain as `"placeholder"` with empty arrays, and their PDFs are missing from `eval/pdfs/`.

The manifest uses abstract slot IDs (not company-named IDs) — each slot maps to a specific risk category (large-cap bilingual, ID-only mid-cap, scanned, quarterly, long-form, manufacturing, mining, etc.). The planner must decide which real IDX filing fills each slot. This research provides the canonical slot-to-company mapping, verified PDF sources, and approximate financial figures from web sources (MEDIUM confidence — must be confirmed from actual audited PDFs before committing to fixtures).

**Primary recommendation:** Download each PDF from the official IR/IDX source, open it in a viewer to confirm the denomination note (jutaan vs. miliaran), identify the consolidated statement page range, then hand-transcribe the audited figures into the fixture JSON using the five standard keys.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF acquisition | Developer workstation | — | Manual one-time action; PDFs gitignored; copied into `eval/pdfs/` |
| Ground-truth authoring | Developer workstation | — | Human visual verification against audited statements — cannot be automated |
| Numeric extraction | Gemini Files API (cloud) | — | Harness calls Gemini; no local processing |
| Scoring logic | Node.js / Vitest (local) | — | `score-run.ts` is pure arithmetic; offline unit tests cover it |
| Gate enforcement | `pnpm eval` process exit code | CI (GitHub Actions) | Non-zero exit blocks Phase 6 merge |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVAL-01 | 9-document Indonesian eval set covering large-cap bilingual, mid-cap ID-only digital, small-cap scanned, quarterly, and long-form annual | Slot-to-company mapping in "Standard Corpus Slot Map" section; PDF sources documented |
| EVAL-02 | Eval harness measures numeric accuracy (≥90% target) and citation page accuracy (≥90% target) | Already implemented in `score-run.ts`; fixture format documented in "Fixture Format" section |
| EVAL-03 | Eval results reviewable per run; harness blocks Phase 6 sign-off until thresholds met | Already implemented in `run.ts` exit-code gate; per-document breakdown printed to stderr |
| EVAL-04 | Eval harness re-runnable on demand with `pnpm eval` | Already wired in `package.json scripts.eval`; env bootstrap in `scripts/eval/register-env.ts` |
</phase_requirements>

---

## Current Corpus State

[VERIFIED: reading eval/fixtures/ and eval/pdfs/]

| Manifest ID | Status | PDF Present | Company |
|-------------|--------|-------------|---------|
| `bbca-ar-bilingual-large-cap-digital` | `ready` | Yes (4.3 MB) | BBCA 2023 Annual Report |
| `tlkm-ar-id-only-mid-cap-digital` | `ready` | Yes (3.0 MB) | TLKM 2023 Annual Report |
| `small-cap-scanned-annual` | `ready` | Yes (5.6 MB) | BISI 2022 Annual Report (scanned) |
| `bbcj-ar-variant-bilingual-large-cap-digital-b` | `placeholder` | No | TBD — second large-cap bilingual variant |
| `mid-cap-quarterly-filing-id` | `placeholder` | No | TBD — mid-cap quarterly ID-only |
| `long-form-annual-200p-plus` | `placeholder` | No | TBD — long-form annual (200+ pages) |
| `mid-cap-annual-manufacturing-id-digital` | `placeholder` | No | TBD — mid-cap manufacturing ID-only |
| `goto-class-small-cap-quarterly-pack` | `placeholder` | No | TBD — GOTO-class quarterly pack |
| `idx-mining-annual-heavy-tables-id` | `placeholder` | No | TBD — mining annual heavy-tables |

**Wave 1 scope** (per ROADMAP.md D-08): Curate 3 documents to unblock Phase 6 start — the 3 `ready` fixtures already pass the minimum 3-document gate IF the harness exit-code behavior counts `ready` documents and skips `placeholder` ones. However, inspecting `run.ts` line 67-76 confirms: `placeholder` fixtures cause the run to exit non-zero. Therefore Wave 1 must flip at least some placeholder fixtures to `ready` to pass the gate. The ROADMAP.md Wave 1 plan targets "BBCA + TLKM + BISI" — all three are already `ready`. The Wave 1 plan may therefore focus on verifying the existing fixtures pass the live harness, then curating the next 3 (SMGR/BJBR slot + ASII long-form + INDF manufacturing) to begin Wave 2.

---

## Standard Corpus Slot Map

[ASSUMED for slot-to-company assignments not already locked by existing PDFs; VERIFIED for the three already-present documents]

The AI-SPEC.md Section 5 "Reference Dataset" provides the canonical slot intent. The table below reconciles it with the manifest IDs and recommends specific companies:

| Manifest ID | Recommended Company | Ticker | Filing Year | Risk Covered | Confidence |
|-------------|---------------------|--------|-------------|--------------|------------|
| `bbcj-ar-variant-bilingual-large-cap-digital-b` | Bank BJB | BJBR | 2023 Annual Report | Second bilingual format; regional bank balance sheet structure | MEDIUM |
| `mid-cap-quarterly-filing-id` | SMGR (Semen Indonesia) | SMGR | Q3 2023 Quarterly | Quarterly unaudited vs. annual audited discrimination; period column confusion | MEDIUM |
| `long-form-annual-200p-plus` | ASII (Astra International) | ASII | 2023 Annual Report | 200+ page document; segment revenue substitution risk; 1M context window validation | HIGH (AI-SPEC explicitly names ASII) |
| `mid-cap-annual-manufacturing-id-digital` | INDF (Indofood Sukses Makmur) | INDF | 2023 Annual Report | Consolidation scope risk (INDF/ICBP structure); manufacturing ID-only labels | MEDIUM |
| `goto-class-small-cap-quarterly-pack` | GOTO (GoTo Gojek Tokopedia) | GOTO | Q4 2023 / Full Year pack | Multi-entity quarterly; parent-only vs. consolidated risk; tech company structure | HIGH (AI-SPEC explicitly names GOTO) |
| `idx-mining-annual-heavy-tables-id` | PTBA (Bukit Asam) | PTBA | 2023 Annual Report | Dense commodity tables; denomination scale (jutaan vs. miliaran); mining sector | MEDIUM (AI-SPEC names PTBA/ADRO) |

---

## PDF Acquisition Sources

[VERIFIED: URLs confirmed reachable or confirmed to exist via web search 2026-05-13]

### Already Present (no action needed)
- `bbca-ar-bilingual-large-cap-digital.pdf` — BBCA 2023 Annual Report, already in `eval/pdfs/`
- `tlkm-ar-id-only-mid-cap-digital.pdf` — TLKM 2023 Annual Report, already in `eval/pdfs/`
- `small-cap-scanned-annual.pdf` — BISI 2022 Annual Report (scanned), already in `eval/pdfs/`

### To Acquire for Wave 1 Additional (if needed beyond existing 3)

No Wave 1 acquisition is needed if the three existing `ready` fixtures already satisfy the minimum gate for unblocking Phase 6 planning. However per `run.ts` behavior, 6 `placeholder` documents will cause exit non-zero even if 3 `ready` documents score 100%. Wave 1 curation must therefore flip more `placeholder` fixtures to `ready`.

### Wave 2 PDF Sources

| Slot | Source | URL | Notes |
|------|--------|-----|-------|
| BJBR 2023 Annual Report | Bank BJB official IR | `https://ir.bankbjb.co.id/page/laporan-tahunan` | 2023 Annual Report page; PDF link requires navigation |
| BJBR 2023 Financial Statements (alternate) | bankbjb.co.id direct | `https://www.bankbjb.co.id/files//2024/03/laporan-keuangan-tahun-2023-new.pdf` | Direct PDF — standalone financial statements (not full annual report) [CITED: web search 2026-05-13] |
| SMGR 2023 Annual Report | SIG official IR | `https://sig.id/en/annual-report` → `/storage/downloads/laporan-tahunan/ar-smgr-2023-1804.pdf` | "Embracing Challenges For Growth Recovery" [CITED: sig.id] |
| SMGR 2023 Annual Report (alternate) | Stockbit attachment | `https://emitten-announcement.stockbit.com/attachments/f-31626070-0_AnnualReport2023-SMGR-att2.pdf` | Third-party mirror; prefer official source [CITED: web search] |
| ASII 2023 Annual Report | Astra official CDN | `https://r2.astra.co.id/annual-reports/documents/Astra_AR_2023.pdf` | Large file (200+ pages); confirmed URL pattern [CITED: web search 2026-05-13] |
| INDF 2023 Financial Statements | Indofood official | `https://www.indofood.com/uploads/statement/INDF_billingual_31_december_2023_released.pdf` | Bilingual; full year 2023 [CITED: indofood.com/menu/financial-statements] |
| GOTO 2023 Financial Statements | IDX official filing | `https://www.idx.co.id/StaticData/NewsAndAnnouncement/ANNOUNCEMENTSTOCK/From_EREP/202303/20240319163937-42270-0/LK%20GOTO_31%20Des%202023.pdf` | OJK-filed audited document [CITED: idx.co.id, web search 2026-05-13] |
| GOTO annual report / quarterly | GoTo IR | `https://www.gotocompany.com/en/investor-relations/financial-information` | Navigate to 2023 tab; quarterly packs available per quarter |
| PTBA 2023 Annual Report | PTBA official IR | `https://www.ptba.co.id/id/investor/annual-report` | Navigate to 2023 report; filename pattern from 2024 suggests uploads path |

**Licensing note:** All IDX filings are publicly filed documents. Downloading them for private developer eval purposes does not create commercial distribution risk. PDFs are gitignored and stored only in `eval/pdfs/` on the developer machine.

---

## Fixture Format

[VERIFIED: reading eval/fixtures/bbca-ar-bilingual-large-cap-digital.json and src/lib/eval/schema.ts]

### Schema (Zod-validated via `groundTruthFixtureSchema`)

```json
{
  "documentId": "<manifest id — must match exactly>",
  "fixtureStatus": "ready",
  "numericExpectations": [
    { "key": "revenue_latest_year",        "valueIDR": <full IDR integer>, "tolerancePct": 0.5 },
    { "key": "net_income_latest_year",     "valueIDR": <full IDR integer>, "tolerancePct": 0.5 },
    { "key": "total_assets_latest_year",   "valueIDR": <full IDR integer>, "tolerancePct": 0.5 },
    { "key": "total_equity_latest_year",   "valueIDR": <full IDR integer>, "tolerancePct": 0.5 },
    { "key": "operating_cash_flow_latest_year", "valueIDR": <full IDR integer>, "tolerancePct": 0.5 }
  ],
  "citationExpectations": [
    { "id": "income_statement_citation", "allowedPages": [<page_index>, <page_index+1>, <page_index+2>] },
    { "id": "balance_sheet_citation",   "allowedPages": [<page_index>, <page_index+1>, <page_index+2>] },
    { "id": "cash_flow_citation",       "allowedPages": [<page_index>, <page_index+1>, <page_index+2>] }
  ]
}
```

### Key rules (from prompt and schema)

1. **`documentId`** must exactly match the `id` field in `manifest.json` — `run.ts` line 60-65 validates this and exits `invalid_ready` if mismatched.
2. **`valueIDR`** is the **full integer in Rupiah** — if the statement says "dalam jutaan Rupiah" (in millions) and the printed number is `87,397,774`, the fixture value is `87397774000000` (multiply by 1,000,000). Do NOT store the raw printed number.
3. **`tolerancePct`** is `0.5` for digital PDFs, `2.0` for scanned documents (`small-cap-scanned-annual`).
4. **`allowedPages`** is the **PDF page index** (1-based), not the printed page number in the document footer. A 3-page window (e.g., `[9, 10, 11]`) covers renderer variance where the statement table begins.
5. **`fixtureStatus: "ready"`** requires both `numericExpectations` and `citationExpectations` to be non-empty — `validateReadyFixture()` in `run.ts` checks this.
6. **Required keys**: all five standard keys are expected by `PROMPT_EVAL_BASE`. Gemini is instructed to omit rather than fabricate; the fixture should only include keys that actually appear in the document.

### Scanned-document special rule
For `small-cap-scanned-annual` (already ready), `tolerancePct: 2.0` on all keys. If the BISI fixture is updated in the future, preserve the 2.0 tolerance. Do NOT apply 0.5 tolerance to any document identified as image-heavy.

### Bank fixtures — income statement key semantics
For banks (BBCA, BJBR), `revenue_latest_year` maps to **net interest income + non-interest income** (total operating income / pendapatan operasional), NOT loan origination volume. BBCA's fixture uses `87397774000000` which corresponds to this combined operating income figure. Replicate the same key definition for BJBR.

---

## Approximate Financial Figures for Fixture Authoring

[MEDIUM confidence — sourced from Indonesian financial news sites and aggregators 2026-05-13; MUST be verified against the actual audited PDF before committing to fixtures]

These are starting points for the LLM-assisted first pass and human cross-check. Do not commit fixture values without opening the PDF and confirming each figure.

| Company | Year | Revenue (IDR) | Net Income attr. to parent (IDR) | Total Assets (IDR) | Notes |
|---------|------|---------------|-----------------------------------|--------------------|-------|
| BJBR | 2023 | ~14.26 T interest income; ~10 T net interest income | ~1.78 T | ~188.29 T | Net interest income = pendapatan bunga bersih [CITED: bareksa.com, cnbcindonesia.com 2026-05-13] |
| SMGR | 2023 | 38.65 T | 2.17 T | 82.96 T | Revenue up 6.2%; net income down 8% [CITED: bareksa.com 2026-05-13] |
| ASII | 2023 | 316.56 T | 33.83 T | ~570 T (estimated from liabilities 195T + equity ~375T) | Conglomerate — segment risk; net income to parent owners per ASII press release [CITED: kontan.co.id 2026-05-13] |
| INDF | 2023 | ~123.49 T | ~5.1 T (estimate) | ~140 T (estimate) | Bilingual filing; large subsidiary ICBP [ASSUMED — exact figures require PDF] |
| GOTO | 2023 | ~14.78 T net revenue | Net loss ~90.63 T (loss-making company) | ~54.1 T | Loss company — `net_income_latest_year` will be negative; check if fixture should include this or omit [CITED: statista.com, web search 2026-05-13] |
| PTBA | 2023 | ~38.5 T | 6.11 T | ~47 T (estimate from Q1 2023 46.4T baseline) | Mining; denominator likely "miliaran" [CITED: ptba.co.id press releases 2026-05-13] |

**GOTO special case:** GOTO is a loss-making tech company. `net_income_latest_year` will return a large negative number. The `withinTolerance()` function in `score-run.ts` handles this correctly (it uses `Math.abs(expected)` in the denominator). Include the net loss figure with a negative `valueIDR` and verify the harness scores it correctly. If the AI-SPEC slot intends GOTO as the quarterly pack slot rather than a full annual, use the Q4 2023 quarterly pack — in which case revenue and loss will be the quarterly figures, not full-year.

---

## Architecture Patterns

### Curation Workflow (Human Process)

The AI-SPEC.md Section 5 "Labeling approach (per D-04)" defines the authoritative process:

```
1. LLM-assisted first pass — run extractEvalClaims() against the PDF
   to get Gemini's candidate extraction output as a starting point
2. Human visual verification — open PDF in viewer, locate the audited
   consolidated income statement and balance sheet, confirm each value
3. Record verified values in numericExpectations with audited figure as expectedValue
4. Record allowedPages by reading PDF page index for each statement table
   (±1 page to cover renderer variance)
```

Practically for the planner: each Wave 2 document requires ~30-60 minutes of curator time per document (download, open, locate pages, verify 5 figures, note page indices, write JSON).

### Broken-Prompt Regression Proof

`PROMPT_EVAL_BROKEN` (in `src/lib/eval/prompts.ts`) is already defined. It instructs Gemini to return `valueIDR: 789` for all keys and cite page `424242`. Running with `EVAL_PROMPT_VARIANT=broken pnpm eval` on any `ready` fixture will immediately fail the ±0.5% tolerance test and produce pages not in `allowedPages`. The Vitest unit test `scoreDocument` "counts missing mismatched citations" already verifies this logic offline (no API call).

For D-09 (broken-prompt regression proof), the Wave 2 plan needs only to:
1. Confirm `EVAL_PROMPT_VARIANT=broken pnpm eval` exits non-zero with all 9 ready fixtures
2. Print the failure breakdown showing specific documents and dimensions that failed
3. Document the result as regression proof

This does NOT require any code changes — it is a `pnpm eval` invocation with an env var.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation of fixture files | Custom validator | `groundTruthFixtureSchema` (Zod, already in `schema.ts`) | Already wired in `load-manifest.ts:loadGroundTruth()` |
| PDF text extraction for fixture authoring | Custom extractor | Open PDF in any viewer (Preview, browser, Acrobat) | Fixtures are hand-curated; extraction is only for first-pass suggestions |
| Financial figure scraping | Web scraper | Direct IR page + manual lookup | Scraped figures may not reflect audited consolidated values |
| Denomination unit normalization | Custom converter | Follow the per-document denomination note | Each filer states their own unit; do not normalize across filers |
| Citation page detection | Custom page scanner | Open PDF in viewer, count PDF pages (not printed page numbers) | PDF page index ≠ printed footer page number — only human viewing confirms the correct index |

---

## Common Pitfalls

### Pitfall 1: Printed Page Number vs. PDF Page Index
**What goes wrong:** The income statement printed footer says "page 105" but it is PDF page index 112 because the first 7 pages are a cover section without printed numbers. `allowedPages` must contain the PDF page index (what a PDF viewer shows in its page count), not the footer number.
**Why it happens:** IDX annual reports often have unnumbered cover, table of contents, and board letter sections before the financial statements. The PDF page index includes all pages.
**How to avoid:** Open the PDF in a viewer that shows absolute page position (e.g., browser PDF viewer shows "Page 112 of 300"). Confirm by checking that the visible income statement header appears on that viewer page.
**Warning signs:** `citationHits: 0` for every document on first run — check whether `allowedPages` was populated from footer numbers.

### Pitfall 2: Denomination Unit Applied Incorrectly
**What goes wrong:** Fixture records `revenue_latest_year: 38650000` (treating the number as raw IDR) when the filing says "Stated in millions of Rupiah" — the correct value is `38650000000000` (× 1,000,000).
**Why it happens:** The printed number looks like a normal figure; the denomination note is often in a small table header.
**How to avoid:** Always read the denomination note on the cover page or Note 1 of the financial statements before recording any figure. Search for "jutaan" (millions) or "miliaran" (billions). The BBCA fixture shows the correct scale: `87397774000000` for revenue stated in billions.
**Warning signs:** Gemini's extraction will score 0% because it converts correctly and the fixture is wrong by 10^6 or 10^9.

### Pitfall 3: Consolidated vs. Parent-Only Table
**What goes wrong:** The fixture records revenue from the "Laporan Keuangan Entitas Induk" (parent-only) table instead of the "Laporan Keuangan Konsolidasian" (consolidated) table. For INDF (parent) vs. INDF consolidated, the difference can be 5–20× in revenue.
**Why it happens:** IDX annual reports present both tables in the same PDF. The parent-only table appears first in some filings.
**How to avoid:** Confirm the table header says "Konsolidasian" before recording any figure. For ASII and INDF specifically, the consolidated revenue is the group revenue figure.
**Warning signs:** Fixture value significantly lower than reported group figures in press releases.

### Pitfall 4: Prior-Year Column
**What goes wrong:** Fixture records the 2022 comparison column from the 2023 annual report instead of the 2023 column.
**Why it happens:** Indonesian financial statements present prior-year and current-year side by side; the prior-year column is sometimes on the left (leftmost position = most recent is NOT guaranteed).
**How to avoid:** Confirm the column header shows "2023" (or "31 Desember 2023") before recording. The PROMPT_EVAL_BASE instructs Gemini to use "most recent year column only."
**Warning signs:** Numeric values are systematically lower than known press release figures for 2023.

### Pitfall 5: Bank Revenue Definition Mismatch
**What goes wrong:** For BJBR (a bank), using loan origination volume or gross interest income as `revenue_latest_year` instead of net interest income (pendapatan bunga bersih) — the figure used in BBCA's fixture.
**Why it happens:** Banks have non-standard income statement structures. "Revenue" is ambiguous for banks.
**How to avoid:** Use the same key definition as BBCA: net interest income + non-interest operating income = total operating income (pendapatan operasional). Verify against BBCA fixture value to confirm the same accounting concept is captured.

### Pitfall 6: GOTO Net Loss Handling
**What goes wrong:** Fixture omits `net_income_latest_year` for GOTO because it is a loss, or records a positive value by mistake.
**Why it happens:** Loss-making companies are uncommon in typical financial statement evaluations.
**How to avoid:** Record the negative value as-is. `withinTolerance()` handles negatives correctly via `Math.abs(expected)` in the denominator. Verify the Vitest scorer handles negative expected values by checking `score-run.ts:withinTolerance()`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `pnpm vitest run src/lib/eval/score-run.test.ts` |
| Full offline suite | `pnpm test` (runs all Vitest tests, no API calls) |
| Live harness (requires API key + PDFs) | `GEMINI_API_KEY=... pnpm eval` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVAL-01 | 9 documents in corpus | Integration | `pnpm eval` (exits non-zero until all 9 ready) | `eval/manifest.json` exists |
| EVAL-02 | Numeric + citation accuracy ≥90% | Integration | `pnpm eval` exit code 0 | `score-run.ts` + `run.ts` exist |
| EVAL-02 | `withinTolerance()` math correct | Unit | `pnpm vitest run src/lib/eval/score-run.test.ts` | Exists |
| EVAL-03 | Per-document breakdown printed | Integration | `pnpm eval 2>&1` shows per-doc lines | `run.ts` stderr output |
| EVAL-04 | Re-runnable single command | Integration | `pnpm eval` | `package.json scripts.eval` exists |
| EVAL-02 (gate) | Broken-prompt exits non-zero | Integration | `EVAL_PROMPT_VARIANT=broken pnpm eval` | Live — no additional test needed |
| EVAL-02 (gate) | Broken-prompt scoring offline | Unit | `pnpm vitest run src/lib/eval/score-run.test.ts` (covers 0% score path) | Exists |

### Sampling Rate
- **Per fixture committed:** `pnpm vitest run src/lib/eval/score-run.test.ts` (offline, <2s, no API)
- **Per wave merge:** `GEMINI_API_KEY=... pnpm eval` (live, 3-5 min, 9 API calls)
- **Phase gate:** All 9 documents `ready` + `pnpm eval` exits 0 before `/gsd-verify-work`

### Wave 0 Gaps
None — test infrastructure is complete. No new test files need to be created.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `GEMINI_API_KEY` | `pnpm eval` live run | Must be in `.env.local` | N/A | None — harness fails fast if missing via `@/lib/env` |
| PDF files in `eval/pdfs/` | `pnpm eval` for any `ready` fixture | 3/9 present | N/A | Documents skip as `missing_pdf` (exit non-zero) |
| `@google/genai` SDK | `gemini-eval-extract.ts` | Installed | `^1.52.0` in package.json | None needed |
| `tsx` (TypeScript runner) | `pnpm eval` script | In devDependencies | Verified via `pnpm eval` existing | None needed |
| Internet access | PDF downloads, Gemini API calls | Required | N/A | None |

**Missing with no fallback:**
- 6 PDFs not yet downloaded — must be acquired manually from IR pages listed above
- `GEMINI_API_KEY` must be valid and have Gemini 2.5 Flash free-tier quota available (250 RPD)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RAGAS for eval | Custom Vitest + @google/genai harness | Phase 5 AI-SPEC decision | RAGAS is Python-only / RAG-focused; direct harness is simpler and already built |
| LangChain orchestration | Direct `@google/genai` SDK | Phase 5 AI-SPEC decision | No abstraction layer; easier to debug; already built |
| Per-page chunking for eval | Full-document Files API upload | Phase 5 AI-SPEC decision | 1M context window eliminates chunking; citation accuracy requires full-document reference |

---

## Open Questions

1. **Does Wave 1 plan require new fixture curation, or just verifying existing 3?**
   - What we know: ROADMAP.md says "BBCA + TLKM + BISI (3-document minimum gate per D-08)"; those 3 are already `ready`.
   - What's unclear: Does "3-document minimum gate" mean the harness should accept a partial run and exit 0 when only 3 are ready? Inspecting `run.ts` confirms it does NOT — any `placeholder` fixture causes exit non-zero.
   - Recommendation: Wave 1 plan should either (a) verify existing 3 pass the live harness + curate 3 more to achieve 6/9 ready, or (b) discuss modifying the harness to allow partial-corpus passes. Option (a) is safer and requires no code change.

2. **GOTO slot: full-year annual or quarterly pack?**
   - What we know: The manifest label is "Small-cap digitally-native quarterly filing pack"; the AI-SPEC slot description says "Multi-entity quarterly structure; parent-only vs. consolidated risk."
   - What's unclear: Should the fixture reference Q4 2023 quarterly figures or full-year 2023 figures?
   - Recommendation: Use the full-year 2023 financial statements (the IDX filing `LK GOTO_31 Des 2023.pdf`) for clearer audited figures — quarterly filings are unaudited. Populate `revenue_latest_year` and other keys from the 2023 full-year audited document.

3. **INDF vs. ICBP for manufacturing slot?**
   - What we know: AI-SPEC says "INDF (Indofood) or SMGR"; the manifest slot is "mid-cap annual manufacturing id-digital."
   - What's unclear: SMGR is in the cement sector; INDF is food manufacturing. SMGR may better represent "manufacturing" while INDF is more conglomerate-like.
   - Recommendation: Use SMGR for the `mid-cap-quarterly-filing-id` slot (quarterly) and INDF for `mid-cap-annual-manufacturing-id-digital` (annual) — this distributes the two companies across different slot types and tests both quarterly and annual contexts.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BJBR is the best fit for the `bbcj-ar-variant-bilingual-large-cap-digital-b` slot | Standard Corpus Slot Map | Alternative bilingual large-cap (e.g., BBRI, BMRI) could be substituted; slot intent is "second bilingual format to verify generalization" |
| A2 | INDF financial statements are on `indofood.com/uploads/statement/INDF_billingual_31_december_2023_released.pdf` | PDF Acquisition Sources | URL may require authentication or redirect; verify by attempting download |
| A3 | SMGR annual report PDF at `sig.id/storage/downloads/laporan-tahunan/ar-smgr-2023-1804.pdf` | PDF Acquisition Sources | Relative path pattern — full URL requires `https://sig.id` prefix; file may have moved |
| A4 | GOTO full-year 2023 IDX filing is the correct document for the quarterly pack slot | Open Questions | If the slot truly requires a quarterly pack format, the Q3 or Q4 quarterly filing would be different |
| A5 | Approximate financial figures in "Approximate Financial Figures" table are within 5% of audited values | Approximate Financial Figures | Web-scraped aggregator figures may differ from audited PDF values; ALL must be confirmed against PDF |
| A6 | `pnpm eval` will pass the broken-prompt test without code changes | Broken-Prompt Regression Proof | `PROMPT_EVAL_BROKEN` is already defined in `prompts.ts` and `run.ts` reads `EVAL_PROMPT_VARIANT` — verified by reading both files |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: reading `eval/manifest.json`] — 9 manifest slot IDs, PDF paths, fixture paths
- [VERIFIED: reading `eval/fixtures/*.json`] — fixture status (3 ready, 6 placeholder) and format
- [VERIFIED: reading `src/lib/eval/schema.ts`] — Zod schemas for fixture, extraction, manifest
- [VERIFIED: reading `src/lib/eval/prompts.ts`] — PROMPT_EVAL_BASE, PROMPT_EVAL_BROKEN, EVAL_MODEL_ID
- [VERIFIED: reading `src/lib/eval/score-run.ts`] — withinTolerance(), scoreDocument(), aggregateScores()
- [VERIFIED: reading `scripts/eval/run.ts`] — full harness driver; exit-code behavior; placeholder handling
- [VERIFIED: reading `src/lib/eval/gemini-eval-extract.ts`] — Files API upload-poll-extract pattern
- [VERIFIED: reading `src/lib/eval/score-run.test.ts` and `fixture-io.test.ts`] — existing Vitest coverage
- [VERIFIED: reading `package.json scripts`] — `pnpm eval` = `tsx scripts/eval/run.ts`
- [VERIFIED: reading `.planning/phases/05-indonesian-eval-harness/05-AI-SPEC.md`] — full AI design contract

### Secondary (MEDIUM confidence)
- [CITED: r2.astra.co.id web search 2026-05-13] — ASII 2023 annual report direct PDF URL
- [CITED: bankbjb.co.id web search 2026-05-13] — BJBR 2023 financial statements PDF URL
- [CITED: idx.co.id web search 2026-05-13] — GOTO 2023 IDX-filed financial statements URL
- [CITED: sig.id fetched 2026-05-13] — SMGR 2023 annual report relative path
- [CITED: indofood.com/menu/financial-statements fetched 2026-05-13] — INDF 2023 full-year PDF path
- [CITED: bareksa.com, cnbcindonesia.com 2026-05-13] — BJBR 2023 net income and total assets
- [CITED: bareksa.com 2026-05-13] — SMGR 2023 revenue and net income
- [CITED: kontan.co.id 2026-05-13] — ASII 2023 revenue and net income
- [CITED: statista.com, web search 2026-05-13] — GOTO 2023 revenue and total assets
- [CITED: ptba.co.id press releases, web search 2026-05-13] — PTBA 2023 revenue and net income

### Tertiary (LOW confidence — verify before use)
- Approximate financial figures table — all flagged MEDIUM/ASSUMED; confirm against actual audited PDFs
- ASII total assets estimate — derived from liabilities figure, not directly found; must verify from PDF
- INDF net income and total assets — not found in web search results; marked ASSUMED

---

## Metadata

**Confidence breakdown:**
- Harness code understanding: HIGH — fully read and verified
- Fixture format: HIGH — Zod schema + working examples verified
- PDF sources: MEDIUM — URLs found via web search; some may require IR page navigation
- Financial figures: MEDIUM to LOW — aggregator sources; must be confirmed against audited PDFs
- Slot-to-company mapping: MEDIUM — derived from AI-SPEC.md intent; not all locked decisions

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (annual report links stable; financial figures are from 2023 audited filings so won't change)
