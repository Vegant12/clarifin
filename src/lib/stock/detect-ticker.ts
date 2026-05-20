/**
 * Phase 9 — TICKER-01: IDX ticker detection from extracted PDF page text.
 * Pure function, regex only, bounded to first 5 pages (cover + TOC region).
 * No LLM call. See 09-RESEARCH.md Pattern 5 + Pitfall 5.
 */

// Common 4-letter ID abbreviations that LOOK like tickers but aren't.
// Blocks regex false positives without a network call against the IDX listing.
export const IDX_TICKER_BLOCKLIST: ReadonlySet<string> = new Set([
  "PSAK", "IFRS", "GAAP", "NOTE", "IAPI", "BUMN", "APBN",
  "BANK", "DPR", "OJK", "IDX", "BEI", "PPSI", "DJSN",
]);

// Context-anchored patterns. Order matters: more specific first.
const IDX_TICKER_PATTERNS: readonly RegExp[] = [
  /\b(?:BEI|IDX|Kode\s*Efek|Kode\s*saham|Kode\s*Emiten)\s*[:：]\s*([A-Z]{4})\b/i,
  /\b([A-Z]{4})\s+Tbk\b/,
];

/**
 * Returns the detected IDX ticker (uppercase, 4 letters) or null.
 * Scans only the first 5 entries of pageTexts. Defensive: any internal throw → null.
 */
export function detectTicker(pageTexts: string[]): string | null {
  try {
    const earlyPages = pageTexts.slice(0, 5);
    for (const text of earlyPages) {
      if (typeof text !== "string" || text.length === 0) continue;
      for (const pattern of IDX_TICKER_PATTERNS) {
        const match = text.match(pattern);
        const candidate = match?.[1]?.toUpperCase();
        if (candidate && !IDX_TICKER_BLOCKLIST.has(candidate)) {
          return candidate;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
