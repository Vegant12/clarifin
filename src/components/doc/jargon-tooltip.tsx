"use client";

import { useId } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function JargonTooltip(props: {
  term: string;
  definition: string;
  children: React.ReactNode;
}) {
  const { term, definition, children } = props;
  const tooltipId = useId();

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="cursor-help underline decoration-muted-foreground decoration-dotted underline-offset-2"
            aria-describedby={tooltipId}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent id={tooltipId} role="tooltip" className="max-w-xs text-sm">
          <span className="font-medium capitalize">{term}</span>: {definition}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
