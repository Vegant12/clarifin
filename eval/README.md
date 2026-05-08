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
