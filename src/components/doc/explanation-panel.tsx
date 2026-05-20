"use client";

import { Fragment } from "react";

import { parseCitations } from "@/lib/citations/parse-citations";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
import type { ScoreResult } from "@/lib/explain/score-schema";
import { jargonDictionary } from "@/lib/jargon";
import { cn } from "@/lib/utils";

import type { ChartDataPoint, StockData } from "@/lib/stock/stock-schema";

import { CitationInline } from "./citation-inline";
import { JargonTooltip } from "./jargon-tooltip";
import { ScoreCard } from "./score-card";
import { StockWidget } from "./stock-widget";
import { TrendChartCard } from "./trend-chart-card";

const SECTION_LABELS: Record<keyof ExplanationResult, string> = {
  revenue: "Revenue",
  profitability: "Profitability",
  balance_sheet: "Balance Sheet",
  cash_flow: "Cash Flow",
  key_risks: "Key Risks",
};

const SECTION_ORDER: ReadonlyArray<keyof ExplanationResult> = [
  "revenue",
  "profitability",
  "balance_sheet",
  "cash_flow",
  "key_risks",
];

// Precompute term list sorted by length DESC to prefer longer matches first
// (e.g. "operating margin" before "margin"). Pure computation, runs once per module load.
const SORTED_TERMS: readonly string[] = Object.keys(jargonDictionary).sort(
  (a, b) => b.length - a.length,
);

/**
 * Splits a plain-text segment into jargon-wrapped and untouched runs.
 * Returns an array of React nodes. Case-insensitive substring match.
 */
function wrapJargon(text: string, keyPrefix: string): React.ReactNode[] {
  if (text.length === 0) return [];

  const lowered = text.toLowerCase();
  // Find the earliest, longest match across all dictionary terms.
  let bestStart = -1;
  let bestTerm: string | null = null;
  for (const term of SORTED_TERMS) {
    const idx = lowered.indexOf(term);
    if (idx === -1) continue;
    if (
      bestStart === -1 ||
      idx < bestStart ||
      (idx === bestStart && term.length > (bestTerm?.length ?? 0))
    ) {
      bestStart = idx;
      bestTerm = term;
    }
  }

  if (bestStart === -1 || bestTerm === null) {
    return [text];
  }

  const before = text.slice(0, bestStart);
  const matchedRaw = text.slice(bestStart, bestStart + bestTerm.length);
  const after = text.slice(bestStart + bestTerm.length);
  const definition = jargonDictionary[bestTerm] ?? "";

  return [
    ...(before.length > 0 ? wrapJargon(before, `${keyPrefix}.b`) : []),
    <JargonTooltip key={`${keyPrefix}.j`} term={bestTerm} definition={definition}>
      {matchedRaw}
    </JargonTooltip>,
    ...(after.length > 0 ? wrapJargon(after, `${keyPrefix}.a`) : []),
  ];
}

export function ExplanationPanel(props: {
  documentId: string;
  explanation: ExplanationResult;
  score: ScoreResult | null;
  onGoToPage: (page: number) => void;
  className?: string;
  // Phase 9 additions
  ticker: string | null;
  stockData: StockData | null;
  chartData: ChartDataPoint[] | null;
  stockError: boolean;
}) {
  const {
    documentId,
    explanation,
    score,
    onGoToPage,
    className,
    ticker,
    stockData,
    chartData,
    stockError,
  } = props;

  return (
    <article
      className={cn("flex flex-col gap-12 px-6 py-8", className)}
      aria-label="Plain-English explanation"
    >
      {score ? (
        <ScoreCard documentId={documentId} score={score} onGoToPage={onGoToPage} />
      ) : (
        <section
          aria-label="AI Assessment unavailable"
          className="rounded-lg border border-border bg-muted/30 px-4 py-4"
        >
          <p className="text-base font-semibold text-muted-foreground">
            AI Assessment unavailable
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            The AI assessment could not be generated for this document. The explanation below is still available.
          </p>
        </section>
      )}
      {/* Phase 9 stock widget slot (D-08 order, D-10 fallback) */}
      {ticker !== null ? (
        stockError ? (
          <p
            aria-label="Market data unavailable"
            className="text-sm text-muted-foreground"
          >
            Market data temporarily unavailable.
          </p>
        ) : stockData !== null ? (
          <StockWidget ticker={ticker} data={stockData} />
        ) : null
      ) : null}

      {/* Phase 9 trend chart slot — hidden entirely when chartData empty (D-02) */}
      {ticker !== null && chartData !== null && chartData.length > 0 ? (
        <TrendChartCard ticker={ticker} data={chartData} />
      ) : null}

      {SECTION_ORDER.map((sectionKey) => {
        const sectionText = explanation[sectionKey];
        const tokens = parseCitations(sectionText);

        return (
          <section key={sectionKey} className="flex flex-col gap-4">
            <h2 className="font-semibold text-foreground text-xl leading-tight">
              {SECTION_LABELS[sectionKey]}
            </h2>
            <p className="text-foreground text-base leading-relaxed">
              {tokens.map((tok, idx) => {
                if (tok.kind === "citation") {
                  return (
                    <CitationInline
                      key={`${sectionKey}.cite.${idx}`}
                      page={tok.page}
                      docId={documentId}
                      onGoToPage={onGoToPage}
                    />
                  );
                }
                return (
                  <Fragment key={`${sectionKey}.text.${idx}`}>
                    {wrapJargon(tok.value, `${sectionKey}.${idx}`)}
                  </Fragment>
                );
              })}
            </p>
          </section>
        );
      })}
    </article>
  );
}
