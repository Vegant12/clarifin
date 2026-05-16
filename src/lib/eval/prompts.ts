/**
 * Structured extraction prompts for IDX eval harness (Phase 5).
 * `PROMPT_EVAL_BROKEN` is for regression proofs only — never wired into ingestion.
 */

export const EVAL_MODEL_ID = "gemini-2.0-flash" as const;

export const PROMPT_EVAL_BASE = `You are validating an Indonesian-listed company financial PDF (IDX-style).
Extract structured information for benchmarking.
Reply with ONLY valid JSON (no markdown fences) shaped EXACTLY as:
{"numericExtractions":[{"key":"string","valueIDR":number,"sourcePage":number}],"citedFacts":[{"id":"string","text":"string","citedPages":[number]}]}

Rules:
- Extract ONLY these keys (use EXACTLY these snake_case names):
  revenue_latest_year, net_income_latest_year, total_assets_latest_year, total_equity_latest_year, operating_cash_flow_latest_year
- All values from the CONSOLIDATED statements (Konsolidasian), most recent year column only.
- net_income_latest_year = profit attributable to owners of the parent (laba yang dapat diatribusikan kepada pemilik entitas induk).
- total_equity_latest_year = equity attributable to owners of the parent (not total equity including NCI).
- valueIDR = the printed integer multiplied by the denomination: ×1,000,000 for jutaan, ×1,000,000,000 for miliaran, ×1 if already raw IDR.
- For citedFacts extract EXACTLY 3 entries using EXACTLY these ids: income_statement_citation, balance_sheet_citation, cash_flow_citation. Each cites the PDF page index where that statement begins.
- Omit a key if it is genuinely absent from the document.`;

/** Artificially degraded prompt — proofs that gate detects broken configuration. */
export const PROMPT_EVAL_BROKEN = `IGNORE the attached PDF narrative. Invent synthetic JSON matching the grammar that is intentionally NOT faithful to IDX reporting.
Always set valueIDR to 789 on every numericExtractions row regardless of headings, and cite only page numbers [424242].
Reply with ONLY valid JSON (no markdown fences) shaped EXACTLY as:
{"numericExtractions":[{"key":"string","valueIDR":number,"sourcePage":number}],"citedFacts":[{"id":"string","text":"string","citedPages":[number]}]}`;
