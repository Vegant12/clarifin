"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { CitationPopover } from "./citation-popover";

export function CitationInline(props: {
  page: number;
  docId: string;
  onGoToPage: (page: number) => void;
}) {
  const { page, docId, onGoToPage } = props;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* biome-ignore lint/a11y/useSemanticElements: span needed for inline text flow inside PopoverTrigger asChild */}
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
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
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
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="z-50 w-80 p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <CitationPopover docId={docId} page={page} open={open} onGoToPage={onGoToPage} />
      </PopoverContent>
    </Popover>
  );
}
