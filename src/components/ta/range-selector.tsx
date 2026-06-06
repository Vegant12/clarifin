"use client";

/**
 * Phase 13 T1 — range-selector.tsx
 * Five shadcn Buttons for 1M / 3M / 6M / 1Y / 2Y range selection.
 * Active button uses variant="default" (filled) with aria-pressed="true".
 * Parent owns the default selection (1Y).
 */

import { Button } from "@/components/ui/button";
import { type RangeKey } from "./chart-types";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "2Y", label: "2Y" },
];

interface RangeSelectorProps {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
  className?: string;
}

export function RangeSelector({ value, onChange, className }: RangeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Chart time range"
      className={`flex gap-1 ${className ?? ""}`}
    >
      {RANGE_OPTIONS.map(({ key, label }) => {
        const isActive = key === value;
        return (
          <Button
            key={key}
            size="sm"
            variant={isActive ? "default" : "outline"}
            aria-pressed={isActive}
            onClick={() => onChange(key)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
