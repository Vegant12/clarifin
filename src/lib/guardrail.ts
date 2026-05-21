/**
 * Phase 10 CHAT-06 pre-LLM investment-advice guardrail.
 * Extends the pattern from src/lib/explain/score-prompts.ts (scanForInvestmentAdvice)
 * with Bahasa Indonesia variants per RESEARCH.md §Pitfall 5.
 *
 * No server-only import — pure function, importable in Vitest tests.
 * Implements OJK Kep-26/PM/1996 investment-advice prohibition (AI-SPEC §1b).
 */

// EN + ID phrase patterns. Word boundaries on EN terms (\b) prevent
// false positives like "buyer" matching "buy". ID phrases like "beli saham"
// are multi-word and inherently bounded by spaces; no \b needed.
export const INVESTMENT_ADVICE_PATTERNS =
  /\b(buy|sell|invest|recommend|accumulate|avoid|underweight|overweight|price target|should i|worth buying)\b|beli saham|jual saham|investasi|rekomendasikan|layak dibeli|saham bagus|apakah bagus|apakah sebaiknya/i;

/**
 * Returns true if the user query contains any investment-advice trigger phrase.
 * Called pre-LLM in the chat route handler — when true, the route returns a
 * deflection message and skips the LLM call entirely (no quota consumed,
 * <1ms latency).
 */
export function isInvestmentAdviceQuery(text: string): boolean {
  return INVESTMENT_ADVICE_PATTERNS.test(text);
}
