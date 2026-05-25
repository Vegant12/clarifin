"use client";

import { useState } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

import { CitationPopover } from "./citation-popover";

export function CitationInline(props: {
  page: number;
  docId: string;
  onGoToPage: (page: number) => void;
}) {
  const { page, docId, onGoToPage } = props;
  // Bug 4 fix: HoverCard manages its own hover-open/close lifecycle AND bridges
  // the trigger → content gap so moving the cursor onto the content does not
  // close the card (which is why the old Popover + manual onMouseLeave handlers
  // flickered). Keeping a controlled open prop because CitationPopover reads it
  // to gate its page-text fetch (D-07 module-cache pattern).
  const [open, setOpen] = useState(false);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={150} closeDelay={200}>
      <HoverCardTrigger asChild>
        {/* biome-ignore lint/a11y/useSemanticElements: span needed for inline text flow inside HoverCardTrigger asChild */}
        <span
          role="button"
          tabIndex={0}
          aria-label={`View source for page ${page}`}
          className={cn(
            "inline-flex cursor-pointer items-center rounded-full bg-primary px-1.5 py-0.5",
            "text-primary-foreground text-xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "hover:shadow-sm",
          )}
          onClick={() => onGoToPage(page)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onGoToPage(page);
            }
          }}
        >
          {`[p.${page}]`}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="z-50 w-80 p-3">
        <CitationPopover docId={docId} page={page} open={open} onGoToPage={onGoToPage} />
      </HoverCardContent>
    </HoverCard>
  );
}
