/**
 * Phase 13 Plan 04 — TA-TICKER-02: Ticker URL normalization helper.
 *
 * Shared between the /ta/[ticker] RSC page (Plan 07) and its tests.
 * Extracted as a pure function so the lowercase-redirect rule is tested in isolation.
 *
 * Rules:
 * - If raw !== raw.toUpperCase() → redirectTo: "/ta/{UPPERCASED}", valid: depends on uppercased form
 * - If already uppercase and matches regex → redirectTo: null, valid: true
 * - If already uppercase but doesn't match regex → redirectTo: null, valid: false
 */

const TICKER_REGEX = /^[A-Z]{1,5}$/;

export interface NormalizeTickerResult {
  /** If non-null, the page should redirect to this path (e.g. "/ta/BBCA"). */
  redirectTo: string | null;
  /** Whether the ticker is a valid IDX ticker code after normalization. */
  valid: boolean;
}

/**
 * Normalize a raw ticker path parameter.
 *
 * Usage in RSC page:
 *   const { redirectTo, valid } = normalizeTickerParam(params.ticker);
 *   if (redirectTo) redirect(redirectTo);
 *   if (!valid) return <TAErrorCard />;
 */
export function normalizeTickerParam(raw: string): NormalizeTickerResult {
  const upper = raw.toUpperCase();
  const valid = TICKER_REGEX.test(upper);

  if (raw !== upper) {
    // Lowercase or mixed-case → redirect to uppercase path
    return { redirectTo: `/ta/${upper}`, valid };
  }

  // Already uppercase
  return { redirectTo: null, valid };
}
