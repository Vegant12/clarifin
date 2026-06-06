"use client";

/**
 * Phase 13 T1 — overlay-toggles.tsx
 * Four chip-style toggle buttons for candlestick chart overlay series:
 * Bollinger Bands / EMA 20 / EMA 50 / EMA 200.
 *
 * On-state visual: variant="outline" + 3px left border in series color (borderLeftColor) + bg-muted.
 * Off-state: variant="ghost", no colored border.
 * Defaults (EMA-50/200 on, BB/EMA-20 off) are managed by the parent.
 *
 * This component only reports toggle intent — overlay visibility is applied
 * by the parent calling series.applyOptions({ visible }) on refs from CandlestickChart.
 */

import { Button } from "@/components/ui/button";
import { CHART_COLORS, type OverlayKey } from "./chart-types";

const OVERLAY_OPTIONS: { key: OverlayKey; label: string; color: string }[] = [
  { key: "BB", label: "Bollinger Bands", color: "#71717a" },
  { key: "EMA20", label: "EMA 20", color: CHART_COLORS.ema20 },
  { key: "EMA50", label: "EMA 50", color: CHART_COLORS.ema50 },
  { key: "EMA200", label: "EMA 200", color: CHART_COLORS.ema200 },
];

interface OverlayTogglesProps {
  active: Record<OverlayKey, boolean>;
  onToggle: (k: OverlayKey) => void;
  className?: string;
}

export function OverlayToggles({ active, onToggle, className }: OverlayTogglesProps) {
  return (
    <div
      role="group"
      aria-label="Chart overlay indicators"
      className={`flex flex-wrap gap-1 ${className ?? ""}`}
    >
      {OVERLAY_OPTIONS.map(({ key, label, color }) => {
        const isOn = active[key];
        return (
          <Button
            key={key}
            size="sm"
            variant={isOn ? "outline" : "ghost"}
            aria-pressed={isOn}
            onClick={() => onToggle(key)}
            className={isOn ? "bg-muted border-l-[3px]" : ""}
            style={
              isOn
                ? {
                    borderLeftColor: color,
                  }
                : undefined
            }
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
