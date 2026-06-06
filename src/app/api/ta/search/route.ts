/**
 * Phase 13 Plan 04 — TA-TICKER-02: Ticker autocomplete search route.
 *
 * GET /api/ta/search?q={query}&limit={n}
 *
 * Returns ranked ticker_metadata matches for code or company name.
 * Fail-open: returns { results: [] } on parse or DB error (autocomplete is non-critical).
 *
 * Security (T-13-14): query sanitized to alphanumeric+space before interpolating
 * into PostgREST .or() filter string to prevent filter injection.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";

export const runtime = "nodejs";

const searchSchema = z.object({
  q: z.string().min(1).max(20),
});

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

/** T-13-14: strip everything except alphanumerics and spaces before DB interpolation. */
function sanitizeQuery(q: string): string {
  return q.replace(/[^a-zA-Z0-9 ]/g, "");
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawQ = url.searchParams.get("q");
  const rawLimit = url.searchParams.get("limit");

  const parsed = searchSchema.safeParse({ q: rawQ });
  if (!parsed.success) {
    // Fail-open for autocomplete — empty string or missing query is not an error
    return NextResponse.json({ results: [] });
  }

  const q = parsed.data.q;

  // Parse limit with bounds
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsedLimit = parseInt(rawLimit, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, MAX_LIMIT);
    }
  }

  // Sanitize before string interpolation into PostgREST filter (T-13-14)
  const sanitizedQ = sanitizeQuery(q);
  const sanitizedQUpper = sanitizedQ.toUpperCase();

  if (sanitizedQ.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Query: match ticker prefix (uppercase) OR name_en contains OR name_id contains
  // Ticker prefix match uses uppercased query; name matching uses original case (ilike is case-insensitive)
  const { data, error } = await supabaseAdmin
    .from("ticker_metadata")
    .select("ticker, name_en, name_id, sector")
    .or(
      `ticker.ilike.${sanitizedQUpper}%,name_en.ilike.%${sanitizedQ}%,name_id.ilike.%${sanitizedQ}%`,
    )
    .order("ticker", { ascending: true })
    .limit(limit);

  if (error) {
    // T-13-16: fail-open — never leak DB error details to client
    console.error("[ta/search] ticker_metadata query error:", error.message);
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  return NextResponse.json({ results: data ?? [] });
}
