/**
 * Score prompt constants, builder, and compliance guardrail for Phase 8 AI Score Generation.
 * No server-only import — pure strings/functions, importable in Vitest tests.
 *
 * SCORE_MODEL_ID intentionally diverges from EXPLANATION_MODEL_ID (which is "gemini-2.0-flash"
 * per Phase 6). Phase 8 AI-SPEC §4 mandates "gemini-2.5-flash" for structured score extraction.
 * Do NOT inherit from explain-prompts.ts.
 */

export const SCORE_MODEL_ID = "gemini-2.5-flash" as const;

/**
 * Builds the full score prompt by interpolating totalPages and conditionally
 * injecting a Bahasa Indonesia/PSAK translation note.
 *
 * @param totalPages - Total page count of the document (from documents.total_pages).
 * @param isIndonesian - When true, injects PSAK translation note (TRANSLATE-01).
 */
export function buildScorePrompt(totalPages: number, isIndonesian: boolean): string {
  const langNote = isIndonesian
    ? "The document is in Bahasa Indonesia. Translate all quoted snippets into English in the `text` field. Use correct English equivalents for PSAK financial terms (e.g. 'laba bersih' → 'net profit', 'aset lancar' → 'current assets')."
    : "";

  return `
You are a financial analyst reviewing an IDX-listed company financial document (${totalPages} pages).
${langNote}

Score this document on exactly 4 dimensions. Return the JSON object specified by the schema.

Dimension criteria:
1. Profitability — net profit margin, operating income, return on equity from continuing operations.
   Exclude extraordinary items (pos luar biasa). Do not count other comprehensive income as core profit.
2. Balance Sheet — current ratio, debt-to-equity, interest coverage. Note sector context
   (banks and financial institutions have structurally high leverage — do not penalise unless capital
   adequacy ratios are also stressed).
3. Growth Trend — year-over-year revenue and net income over at least 3 years of comparative data.
   Distinguish organic growth from one-time revaluations or acquisitions.
4. Valuation Context — P/E and P/B ratios where available in the document. Frame as "above/below
   sector norms" without directional investment advice. If ratios are not in the document, note that
   live market data is required and score conservatively (5).

RULES (non-negotiable):
- Do NOT use the words: buy, sell, invest, recommend, accumulate, avoid, underweight, overweight.
- All reasoning must be descriptive, not prescriptive.
- Page numbers must match actual document pages containing the cited data.
- overall_score is the mean of the 4 dimension scores, rounded to the nearest integer.
`.trim();
}

const BLOCKED_TERMS = /\b(buy|sell|invest|recommend|accumulate|avoid|underweight|overweight)\b/i;

/**
 * Pre-persist compliance guardrail (SCORE-05 / AI-SPEC §6).
 * Returns the matched blocked term (original casing) if present, otherwise null.
 * Used by Plan 03 generate-score.ts after Zod parse and before Supabase upsert.
 * Implements OJK Kep-26/PM/1996 investment advice prohibition.
 *
 * Uses \b word boundaries so "buyer" and "seller" do NOT match "buy" / "sell".
 */
export function scanForInvestmentAdvice(text: string): string | null {
  const m = BLOCKED_TERMS.exec(text);
  return m ? m[0] : null;
}
