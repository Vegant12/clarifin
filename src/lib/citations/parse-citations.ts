export type CitationToken =
  | { kind: "text"; value: string }
  | { kind: "citation"; page: number };

const CITATION_REGEX = /\[p\.(\d+)\]/g;

/**
 * Splits a string containing inline [p.N] markers into an ordered sequence
 * of text and citation tokens. Empty text segments (e.g. when the input
 * starts or ends with a citation, or two citations are adjacent) are
 * filtered out so consumers never have to handle "" text nodes.
 *
 * Pure function — no side effects, deterministic.
 */
export function parseCitations(input: string): CitationToken[] {
  if (input.length === 0) return [];

  const tokens: CitationToken[] = [];
  let lastIndex = 0;

  // Reset regex state (regex has /g flag)
  CITATION_REGEX.lastIndex = 0;

  for (const match of input.matchAll(CITATION_REGEX)) {
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;

    if (matchStart > lastIndex) {
      tokens.push({ kind: "text", value: input.slice(lastIndex, matchStart) });
    }

    tokens.push({ kind: "citation", page: Number.parseInt(match[1] ?? "0", 10) });
    lastIndex = matchEnd;
  }

  if (lastIndex < input.length) {
    tokens.push({ kind: "text", value: input.slice(lastIndex) });
  }

  return tokens;
}
