/**
 * Phase 13 Plan 07 — /ta landing page.
 *
 * Simple RSC page with a centered TickerSearch and introductory heading.
 * SiteHeader is mounted globally in layout.tsx (Plan 06).
 */

import type { Metadata } from "next";

import { TickerSearch } from "@/components/ta/ticker-search";

export const metadata: Metadata = {
  title: "TA Analysis · Clarifin",
  description:
    "Look up technical analysis indicators for any IDX-listed company.",
};

export default function TaLandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Technical Analysis
          </h1>
          <p className="mt-2 text-muted-foreground">
            Search any IDX-listed ticker to view candlestick charts, indicators,
            and plain-English summaries.
          </p>
        </div>

        <div className="w-full max-w-md">
          <TickerSearch />
        </div>
      </div>
    </main>
  );
}
