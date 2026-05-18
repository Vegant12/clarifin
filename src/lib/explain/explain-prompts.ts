/**
 * Explanation prompt constants and builder for Phase 6 AI Explanation Generation.
 * Mirrors pattern from src/lib/eval/prompts.ts.
 * No server-only import — pure strings/functions, importable in Vitest tests.
 */

export const EXPLANATION_MODEL_ID = "gemini-2.5-flash" as const;

/**
 * PSAK/IFRS Financial Vocabulary (TRANSLATE-02).
 * 30 canonical Bahasa Indonesia → English financial term mappings.
 * Injected into prompts when isIndonesian === true.
 */
export const PSAK_GLOSSARY = `PSAK/IFRS Financial Vocabulary (Bahasa Indonesia → English):
- laba bersih → net income (profit attributable to owners of parent)
- laba kotor → gross profit
- laba usaha / laba operasi → operating income / EBIT
- laba sebelum pajak → pre-tax income
- pendapatan / penjualan → revenue / net sales
- beban pokok penjualan → cost of goods sold (COGS)
- ekuitas → equity (shareholders' equity)
- aset lancar → current assets
- liabilitas lancar → current liabilities
- arus kas dari aktivitas operasi → operating cash flow
- arus kas dari aktivitas investasi → investing cash flow
- arus kas dari aktivitas pendanaan → financing cash flow
- laba ditahan → retained earnings
- pendapatan komprehensif lain → other comprehensive income (OCI)
- catatan atas laporan keuangan → notes to financial statements
- laporan keuangan konsolidasian → consolidated financial statements
- laporan posisi keuangan → statement of financial position (balance sheet)
- beban bunga → interest expense
- pajak penghasilan → income tax
- aset tidak lancar → non-current assets
- utang usaha → trade payables / accounts payable
- piutang usaha → trade receivables / accounts receivable
- persediaan → inventory
- goodwill → goodwill
- aset tetap → fixed assets / property, plant & equipment (PP&E)
- penyusutan → depreciation
- amortisasi → amortization
- modal disetor → paid-in capital / share capital
- saham treasury → treasury shares
- laba per saham → earnings per share (EPS)
- dividen → dividend` as const;

/**
 * Static system prompt header carrying the no-recommendation clause (DISCLAIM-02 / T-6-01 mitigation).
 * Hard-coded before any PDF content is attached — PDF tokens cannot rewrite system instructions.
 * Exported so other modules can reference the clause directly in tests.
 */
export const EXPLAIN_SYSTEM_PROMPT = `You are a financial analyst explaining an IDX-listed company's financial document to a non-finance retail investor.

IMPORTANT RULES:
- Write for a smart adult who does NOT understand accounting. Use plain English, grade 9 reading level.
- Do NOT make buy/sell recommendations. Frame ALL output as explanation and analysis only.
- Every factual claim (a number, a ratio, a trend) MUST include an inline citation: [p.N] where N is the PDF page index (1-indexed) where that fact appears.
- If you quote a Bahasa Indonesia financial term, immediately follow it with its English translation in parentheses.
- No jargon without an inline plain-English definition on first use.` as const;

/**
 * Builds the full explanation prompt by interpolating totalPages into the citation bound rule
 * and conditionally injecting the PSAK_GLOSSARY block for Indonesian-language documents.
 *
 * @param totalPages - Total page count of the document (from documents.total_pages).
 *   Used to constrain [p.N] citation values so the model cannot hallucinate page numbers
 *   beyond the document length (Pitfall 3 mitigation — EXPLAIN-02).
 * @param isIndonesian - When true, appends the PSAK_GLOSSARY reference block (TRANSLATE-02).
 */
export function buildExplanationPrompt(
  totalPages: number,
  isIndonesian: boolean,
): string {
  const glossaryBlock = isIndonesian
    ? `\n\nBAHASA INDONESIA VOCABULARY REFERENCE (use these English translations in your output):\n${PSAK_GLOSSARY}`
    : "";

  return `${EXPLAIN_SYSTEM_PROMPT} The document has ${totalPages} total pages; every [p.N] must be a valid page in that range.${glossaryBlock}

Produce a JSON object with EXACTLY these five string keys. Each value is a paragraph (or two) of plain-English analysis with inline [p.N] citations woven into the prose:
- revenue: Explain what the company earns, revenue growth or decline, and what drove it.
- profitability: Explain gross margin, operating margin, and net margin trends.
- balance_sheet: Explain total assets, debt level, liquidity, and equity position.
- cash_flow: Explain operating cash flow quality and whether the company generates or consumes cash.
- key_risks: Explain 2-3 material risks evident from the document.`;
}
