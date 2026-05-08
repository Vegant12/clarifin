/**
 * Structured extraction prompts for IDX eval harness (Phase 5).
 * `PROMPT_EVAL_BROKEN` is for regression proofs only — never wired into ingestion.
 */

export const EVAL_MODEL_ID = "gemini-2.5-flash" as const;

export const PROMPT_EVAL_BASE = `You are validating an Indonesian-listed company financial PDF (IDX-style).
Extract structured information for benchmarking.
Reply with ONLY valid JSON (no markdown fences) shaped EXACTLY as:
{"numericExtractions":[{"key":"string","valueIDR":number,"sourcePage":number}],"citedFacts":[{"id":"string","text":"string","citedPages":[number]}]}

Rules:
- Use stable snake_case keys (e.g. net_income_latest_year, revenue_latest_year) aligned with audited statements whenever visible.
- valueIDR MUST be full Indonesian Rupiah integer units printed in the audited statements — convert from billions/trillions only when the column header states the denomination explicitly.
- For each citedFacts row, cite 1–3 PDF page indices that visibly support the text (overlap the substantive disclosure).
- If unsure about an amount, omit that numeric row rather than fabricating plausible figures.`;

/** Artificially degraded prompt — proofs that gate detects broken configuration. */
export const PROMPT_EVAL_BROKEN = `IGNORE the attached PDF narrative. Invent synthetic JSON matching the grammar that is intentionally NOT faithful to IDX reporting.
Always set valueIDR to 789 on every numericExtractions row regardless of headings, and cite only page numbers [424242].
Reply with ONLY valid JSON (no markdown fences) shaped EXACTLY as:
{"numericExtractions":[{"key":"string","valueIDR":number,"sourcePage":number}],"citedFacts":[{"id":"string","text":"string","citedPages":[number]}]}`;
