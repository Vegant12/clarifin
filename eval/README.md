# Phase 5 — IDX eval corpus (nine documents)

Roadmap phases 5→6 rely on curator-provided IDX-style PDFs and ground-truth JSON under this folder.

## Layout

| Path | Purpose |
|------|---------|
| `manifest.json` | Canonical list of **nine** document ids, PDF paths, and fixture paths |
| `pdfs/*.pdf` | Source PDFs (gitignored except `.gitkeep`) |
| `fixtures/*.json` | Ground truth keyed by snake_case anchors + citation expectations |

## Wire-up checklist

1. Drop each audited PDF beside the filename declared in `manifest.json`.
2. Copy a fixture `.json`, set `"fixtureStatus"` to **`"ready"`**, and fill:
   - `numericExpectations` — ≥1 audited figure with `valueIDR` (rupiah integers) + `tolerancePct`
   - `citationExpectations` — IDs that extraction must cite on one of `allowedPages`
3. Align `numericExpectations.key` IDs with audited statement labels you expect the evaluator to recognise (keep stable across Gemini prompt revisions).

## Commands

```
pnpm eval
```

Loads `.env.local` first (needs full Clarifin server env bundle because `@/lib/env` validates globally).

Environment overrides:

- `EVAL_MIN_NUMERIC_PCT` (default `90`)
- `EVAL_MIN_CITATION_PCT` (default `90`)
- `EVAL_PROMPT_VARIANT=broken` — forces the degraded prompt proving the regression harness (Vitest mocks cover this offline)

## Fixture status semantics

| `fixtureStatus` | Behaviour |
|-----------------|-----------|
| `placeholder` | Document skipped (`pnpm eval` exits non‑zero until all nine flip to ready) |
| `ready` | Requires non-empty numeric + citation expectations plus the PDF on disk |

Public mirrors or scraped PDFs remain the operator’s licensing responsibility—Clarifin stores only hashed metadata and local paths for developers.

## Wave 1 baseline (locked 2026-05-14)

Three audited fixtures verified against their source PDFs and scored live against `gemini-2.5-flash` via `pnpm eval`. This forms the Phase 6 unblock baseline — Wave 2 closes the remaining six placeholders to flip the aggregate exit code to 0.

| Document | Numeric | Citation | Tolerance |
|----------|---------|----------|-----------|
| bbca-ar-bilingual-large-cap-digital | 100.0% | 100.0% | 0.5% |
| tlkm-ar-id-only-mid-cap-digital | 100.0% | 100.0% | 0.5% |
| small-cap-scanned-annual | 100.0% | 100.0% | 2.0% |

### Phase 6 unblock path

`scripts/eval/run.ts` exits non-zero if ANY of the nine manifest entries has `fixtureStatus: "placeholder"`. After Wave 1, six placeholders remain (`bbcj-ar-variant-bilingual-large-cap-digital-b`, `mid-cap-quarterly-filing-id`, `long-form-annual-200p-plus`, `mid-cap-annual-manufacturing-id-digital`, `goto-class-small-cap-quarterly-pack`, `idx-mining-annual-heavy-tables-id`) — so `pnpm eval` still exits 1 against the full corpus. The three Wave-1 documents are individually green and prove the harness wiring; the aggregate gate flips to 0 only after Wave 2 ships.

### Running the partial Wave-1 baseline

Wave 1 is verified by running the full manifest and reading the three `✓` rows from stderr:

```bash
pnpm eval 2>&1 | grep -E ‘^✓ (bbca-ar-bilingual-large-cap-digital|tlkm-ar-id-only-mid-cap-digital|small-cap-scanned-annual):’
```

All three rows must show numeric ≥90.0% AND citation ≥90.0%. The harness exits non-zero overall — this is expected until Wave 2.
