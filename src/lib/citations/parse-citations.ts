export type CitationToken =
  | { kind: "text"; value: string }
  | { kind: "citation"; page: number };

// Match a whole `[p....]` bracket block. The block's interior may contain
// multiple page references separated by commas, or a range like `p.49 - p.55`.
// We pull all digit runs out of the block's interior and treat each as a page.
const CITATION_BLOCK_REGEX = /\[p\.[^\]]*\]/g;
const PAGE_DIGITS_REGEX = /\d+/g;

/**
 * Splits a string containing inline `[p.N]` (or `[p.N, p.M, ...]`) markers
 * into an ordered sequence of text and citation tokens.
 *
 * Behavior:
 * - `[p.49]` → one citation token (page 49)
 * - `[p.49, p.111]` or `[p.49, 111]` → two consecutive citation tokens
 * - `[p.49 - p.55]` → two citation tokens (range endpoints; v1 acceptable
 *   approximation rather than expanding the full range)
 * - `[p.0]` and `[p.]` are dropped silently (no citation token, no bracket
 *   text emitted) — LLMs occasionally hallucinate these when a real page is
 *   missing, and surfacing the raw `[p.0]` to the reader looks broken.
 * - `[foo]` (no `p.` prefix) is NOT a citation — the bracket text is preserved.
 * - Empty text segments (boundary citations, adjacent blocks) are filtered out
 *   so consumers never have to handle "" text nodes.
 *
 * Pure function — no side effects, deterministic.
 */
export function parseCitations(input: string): CitationToken[] {
  if (input.length === 0) return [];

  const tokens: CitationToken[] = [];
  let lastIndex = 0;

  // Reset regex state (regex has /g flag)
  CITATION_BLOCK_REGEX.lastIndex = 0;

  for (const match of input.matchAll(CITATION_BLOCK_REGEX)) {
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;

    // Extract all digit runs inside the block, filter out non-finite + 0.
    const block = match[0];
    const pages: number[] = [];
    for (const digitMatch of block.matchAll(PAGE_DIGITS_REGEX)) {
      const n = Number.parseInt(digitMatch[0], 10);
      if (Number.isFinite(n) && n > 0) pages.push(n);
    }

    // Flush preceding text slice (if any).
    if (matchStart > lastIndex) {
      tokens.push({ kind: "text", value: input.slice(lastIndex, matchStart) });
    }

    // If the block has no usable pages (malformed, [p.], [p.0]), drop it
    // silently — do NOT emit the bracket text and do NOT emit citation tokens.
    for (const page of pages) {
      tokens.push({ kind: "citation", page });
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < input.length) {
    tokens.push({ kind: "text", value: input.slice(lastIndex) });
  }

  return tokens;
}
