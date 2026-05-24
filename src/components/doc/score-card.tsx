"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ScoreResult } from "@/lib/explain/score-schema";
import { cn } from "@/lib/utils";

import { CitationInline } from "./citation-inline";

export function ScoreCard(props: {
  documentId: string;
  score: ScoreResult;
  onGoToPage: (page: number) => void;
  className?: string;
}) {
  const { documentId, score, onGoToPage, className } = props;
  return (
    <section
      aria-label="AI Assessment"
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-background p-4",
        className,
      )}
    >
      {/* Score header — D-08: number large + disclaimer directly beneath */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-5xl font-semibold text-primary"
          aria-label={`Overall AI assessment score: ${score.overall_score} out of 10`}
        >
          {score.overall_score}
        </span>
        <span className="text-muted-foreground text-sm">
          AI Assessment · not financial advice
        </span>
      </div>

      {/* 4 dimension rows — D-10: single accordion */}
      <Accordion type="single" collapsible className="w-full">
        {score.dimensions.map((dim) => (
          <AccordionItem key={dim.name} value={dim.name}>
            <AccordionTrigger aria-label={`Expand ${dim.name} details`}>
              <div className="flex w-full items-center gap-2 pr-2">
                <span className="text-sm font-semibold text-foreground flex-1 min-w-0">{dim.name}</span>
                <span className="rounded-full bg-primary px-2 py-1 text-primary-foreground text-xs font-semibold">
                  {`[${dim.score}/10]`}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2 pt-1">
                <p className="text-sm text-foreground mb-2">{dim.reasoning}</p>
                {dim.snippets.map((snip, i) => (
                  <div
                    key={`${dim.name}.snip.${i}`}
                    className="border-l-2 border-muted pl-3 py-1 bg-muted/40"
                  >
                    <span className="text-sm italic text-foreground">{snip.text} </span>
                    <CitationInline
                      page={snip.page}
                      docId={documentId}
                      onGoToPage={onGoToPage}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
