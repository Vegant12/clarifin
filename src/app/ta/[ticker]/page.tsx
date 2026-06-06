/**
 * Phase 13 Plan 07 — /ta/[ticker] RSC page.
 *
 * Gate states (in order):
 *   1. Lowercase ticker → redirect to uppercase (TA-TICKER-02)
 *   2. Invalid ticker format → TAErrorCard (not-found variant)
 *   3. Analysis fetch error / not found → TAErrorCard
 *   4. Sparse data (<30 candles) → SparseDataCard (TA-CHART-08; no NaN)
 *   5. Mobile (<640px, CSS-based) → MobileInfoCard shown; chart hidden (D-05)
 *   6. Happy path → TaChartShell
 *
 * Security:
 *   T-13-29: normalizeTickerParam validates /^[A-Z]{1,5}$/ before any fetch.
 */

import { redirect } from "next/navigation";

import { TAErrorCard } from "@/components/ta/ta-error-card";
import { SparseDataCard } from "@/components/ta/sparse-data-card";
import { MobileInfoCard } from "@/components/ta/mobile-info-card";
import { TaChartShell } from "@/app/ta/ta-chart-shell";
import { normalizeTickerParam } from "@/lib/ta/ticker-route";
import type { AnalysisPayload } from "@/lib/ta/analysis-schema";

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata(props: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: raw } = await props.params;
  const upper = raw.toUpperCase();
  return {
    title: `${upper} — TA Analysis · Clarifin`,
  };
}

// ─── Base URL helper (mirrors doc page pattern) ──────────────────────────────

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TaTickerPage(props: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: raw } = await props.params;

  // Gate 1 + 2: normalize ticker param — redirects lowercase, rejects invalid format.
  const { redirectTo, valid } = normalizeTickerParam(raw);
  if (redirectTo) {
    redirect(redirectTo);
  }
  if (!valid) {
    return <TAErrorCard ticker={raw} />;
  }

  const ticker = raw; // already uppercase and valid at this point

  // Gate 3: fetch analysis from the TA analysis route (RSC server-side fetch).
  let payload: AnalysisPayload | null = null;
  let fetchErrored = false;

  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/ta/analysis/${ticker}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      if (res.status === 404) {
        return <TAErrorCard ticker={ticker} />;
      }
      fetchErrored = true;
    } else {
      const body = (await res.json()) as { data: AnalysisPayload | null; error: string | null };
      if (!body.data) {
        if (body.error?.toLowerCase().includes("not found")) {
          return <TAErrorCard ticker={ticker} />;
        }
        fetchErrored = true;
      } else {
        payload = body.data;
      }
    }
  } catch {
    fetchErrored = true;
  }

  if (fetchErrored || !payload) {
    return <TAErrorCard variant="fetch-error" ticker={ticker} />;
  }

  // Gate 4: sparse data — not enough candles for indicators (TA-CHART-08).
  if (payload.sparse === true || payload.candle_count < 30) {
    return <SparseDataCard ticker={ticker} />;
  }

  // Gate 5 + Happy path: CSS-based mobile gate (D-05) — avoids UA sniffing.
  // MobileInfoCard is shown on <640px; chart surface is hidden.
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Mobile info: visible only below sm breakpoint */}
      <div className="block sm:hidden">
        <MobileInfoCard />
      </div>

      {/* Chart surface: hidden below sm breakpoint */}
      <div className="hidden sm:block">
        {/* Search bar row */}
        <div className="mb-4 max-w-sm">
          {/* TickerSearch is imported inline to avoid a client import at the top of this RSC */}
          <TickerSearchWrapper />
        </div>

        <TaChartShell
          ticker={payload.ticker}
          name_en={payload.name_en}
          last_updated={payload.last_updated}
          ohlcv={payload.ohlcv}
          indicators={payload.indicators}
          snapshot={payload.snapshot}
        />
      </div>
    </main>
  );
}

// ─── TickerSearchWrapper ──────────────────────────────────────────────────────
// Thin server-side import wrapper to avoid top-level "use client" import in RSC.
// TickerSearch itself is "use client" and safe to import in RSC (Next.js handles it).

import { TickerSearch } from "@/components/ta/ticker-search";

function TickerSearchWrapper() {
  return <TickerSearch />;
}
