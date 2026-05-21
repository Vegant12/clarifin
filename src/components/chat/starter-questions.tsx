"use client";

import { cn } from "@/lib/utils";

/**
 * Phase 10 CHAT-05 starter question pills.
 * Render 5 clickable buttons + heading + body. Hide when messages exist (visible=false).
 * Copy verbatim from UI-SPEC Copywriting Contract.
 */
export function StarterQuestions(props: {
  questions: string[];
  onSelect: (q: string) => void;
  visible: boolean;
  className?: string;
}) {
  const { questions, onSelect, visible, className } = props;
  if (!visible || questions.length === 0) return null;

  return (
    <section
      aria-label="Suggested questions"
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-semibold text-foreground">Start with a question</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ask about revenue, debt levels, risks, or anything in the document. Clarifin
          finds the answer from the source pages.
        </p>
      </div>
      <ul role="list" className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onSelect(q)}
              aria-label={`Ask: ${q}`}
              className={cn(
                "rounded-full border border-border bg-muted/30 px-3 py-1.5",
                "text-sm text-foreground hover:bg-muted text-left min-h-[36px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
