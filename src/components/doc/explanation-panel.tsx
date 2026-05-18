"use client";

import { Fragment } from "react";

import { parseCitations } from "@/lib/citations/parse-citations";
import type { ExplanationResult } from "@/lib/explain/explanation-schema";
import { jargonDictionary } from "@/lib/jargon";
import { cn } from "@/lib/utils";

import { CitationInline } from "./citation-inline";
import { JargonTooltip } from "./jargon-tooltip";

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
  onGoToPage: (page: number) => void;
  className?: string;
}) {
  const { documentId, explanation, onGoToPage, className } = props;

  return (
    <article
      className={cn("flex flex-col gap-12 px-6 py-8", className)}
      aria-label="Plain-English explanation"
    >
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
