import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchStockData } from "@/lib/stock/fetch-stock-data";

// Phase 9 STOCK-03 + security: strict ticker validation.
// V5 (ASVS L1) input validation at the trust boundary.
const tickerSchema = z.string().regex(/^[A-Z]{1,5}$/);

const UNAVAILABLE_MESSAGE = "Market data temporarily unavailable";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
): Promise<Response> {
  const { ticker: rawTicker } = await context.params;
  const parsed = tickerSchema.safeParse(rawTicker);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: "Invalid ticker. Must be 1–5 uppercase letters.",
      },
      { status: 400 },
    );
  }

  const data = await fetchStockData(parsed.data);
  if (!data) {
    return NextResponse.json(
      { data: null, error: UNAVAILABLE_MESSAGE },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60",
        },
      },
    );
  }
  return NextResponse.json(
    { data, error: null },
    {
      status: 200,
      headers: {
        // 1-hour CDN cache for ad-hoc /api/stock/[ticker] hits.
        // Per-document 24h cache lives in fetchStockDataForDocument (docId-keyed).
        "Cache-Control": "public, s-maxage=3600",
      },
    },
  );
}
