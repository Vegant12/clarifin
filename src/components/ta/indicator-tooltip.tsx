"use client";

/**
 * Phase 13 T1 — indicator-tooltip.tsx
 * Wraps any child element with a shadcn Tooltip that displays a plain-English
 * definition for a given indicator key (TA-IND-06).
 *
 * INDICATOR_DEFINITIONS: plain-English explanations for each indicator key
 * present in the IndicatorSnapshotStrip. Accessible on hover + focus.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const INDICATOR_DEFINITIONS: Record<string, string> = {
  rsi: "Relative Strength Index — momentum oscillator from 0–100. Under 30 often signals oversold conditions; over 70 often signals overbought.",
  macd: "Moving Average Convergence/Divergence — shows the relationship between two moving averages. Crossovers above zero are often bullish signals.",
  bollingerBands:
    "Bollinger Bands — envelope of price volatility. Price near the upper band may be extended; near the lower band may be compressed.",
  bb: "Bollinger Bands — envelope of price volatility. Price near the upper band may be extended; near the lower band may be compressed.",
  ema20:
    "20-day Exponential Moving Average — short-term trend indicator. Price above EMA-20 suggests near-term upward momentum.",
  ema50:
    "50-day Exponential Moving Average — medium-term trend indicator. Price above EMA-50 suggests a healthy intermediate uptrend.",
  ema200:
    "200-day Exponential Moving Average — long-term trend indicator. Price above EMA-200 is generally considered a bullish signal.",
  sma50:
    "50-day Simple Moving Average — medium-term trend baseline. Similar to EMA-50 but gives equal weight to all 50 days.",
  atr: "Average True Range — measures daily price volatility in currency terms. Higher ATR means larger typical daily swings.",
  stochastic:
    "Stochastic Oscillator — compares a close price to its range over a period. Over 80 is often overbought; under 20 often oversold.",
  obv: "On-Balance Volume — running total of volume that rises on up days and falls on down days. Rising OBV with rising price confirms the trend.",
};

interface IndicatorTooltipProps {
  /** Indicator key matching INDICATOR_DEFINITIONS, e.g. "rsi", "macd", "ema50" */
  indicatorKey: string;
  /** Visible name for the screen-reader label, e.g. "RSI" */
  indicatorName: string;
  children: React.ReactNode;
}

export function IndicatorTooltip({
  indicatorKey,
  indicatorName,
  children,
}: IndicatorTooltipProps) {
  const definition =
    INDICATOR_DEFINITIONS[indicatorKey.toLowerCase()] ??
    `${indicatorName} indicator`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          asChild
          aria-label={`What is ${indicatorName}?`}
        >
          <span tabIndex={0} className="cursor-default focus-visible:outline-none">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {definition}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
