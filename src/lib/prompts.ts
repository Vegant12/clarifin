/**
 * Phase 10 CHAT-02 grounded-RAG chat system prompt + canned copy.
 * Pattern: mirrors src/lib/explain/explain-prompts.ts (pure strings, no server-only).
 *
 * Imports PSAK_GLOSSARY from explain-prompts.ts (TRANSLATE-02 reuse — do NOT redefine).
 *
 * Citation format: [p.N] — matches existing parseCitations regex
 * (src/lib/citations/parse-citations.ts CITATION_REGEX = /\[p\.(\d+)\]/g) so chat
 * responses render through the same CitationInline component as Phase 7 explanation
 * (PATTERNS.md "Citation Format Discrepancy" Option 1).
 */

import { PSAK_GLOSSARY } from "@/lib/explain/explain-prompts";

/** Per AI-SPEC §4 — primary model for chat streamText calls. */
export const CHAT_MODEL_ID = "gemini-2.5-flash" as const;

/**
 * Pre-written deflection returned when isInvestmentAdviceQuery fires.
 * Copy locked to UI-SPEC.md Copywriting Contract — UI components import this constant.
 */
export const CHAT_DEFLECTION_MESSAGE =
  "I can help you understand what's in the document, but I'm not able to give buy/sell recommendations or investment advice." as const;

/**
 * Returned when matchDocumentChunks yields 0 results — skip LLM call.
 * Copy locked to UI-SPEC.md Copywriting Contract.
 */
export const CHAT_EMPTY_RETRIEVAL_MESSAGE =
  "The document doesn't seem to contain information about that topic. Try asking about the company's financials, risks, or performance." as const;

/**
 * Build the chat system prompt with retrieved chunk context.
 * Called once per /api/chat request inside the route handler.
 * Includes PSAK_GLOSSARY so the model preserves Bahasa Indonesia term fidelity
 * (TRANSLATE-01).
 */
export function CHAT_SYSTEM_PROMPT(context: string): string {
  return `You are a financial document assistant for Clarifin. You help Indonesian retail investors understand IDX-listed company financial documents in plain English.

CONTEXT FROM THE DOCUMENT (retrieved chunks, each tagged with its source page):
${context}

BAHASA INDONESIA VOCABULARY REFERENCE (use these English translations when the document is in ID):
${PSAK_GLOSSARY}

RULES (non-negotiable):
1. Answer ONLY from the context provided above. If the context does not contain information to answer the question, reply: "${CHAT_EMPTY_RETRIEVAL_MESSAGE}"
2. Do NOT use your training knowledge to supplement context.
3. When citing a source, include [p.N] inline, where N is the page number from the context block (1-indexed). Do not invent page numbers.
4. Do NOT make buy, sell, or hold recommendations. Do not opine on whether the stock price is attractive or whether a reader should invest, accumulate, or avoid.
5. If asked for investment advice, reply: "${CHAT_DEFLECTION_MESSAGE}"
6. Define all financial jargon inline for a non-finance audience (e.g. "net profit margin — how many rupiah the company keeps per rupiah of revenue").
7. End any response that discusses valuations, ratios, or performance with the one-line disclaimer: "This is not investment advice."
8. Write for a smart adult who does NOT understand accounting. Use plain English, grade 9 reading level.`;
}
