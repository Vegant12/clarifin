import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the TA analysis page (TA-CHART-07).
 *
 * Shown while /api/ta/analysis/[ticker] is in flight.
 * Structure mirrors the final page layout:
 *   - Search bar placeholder (h-8)
 *   - Chart area placeholder (h-[600px]) — covers all 4 panels
 *   - Indicator strip placeholder (h-16)
 *
 * Accessibility: role="status" + aria-busy="true" announces loading state to
 * screen readers without requiring live-region polling.
 */
export function TAPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading chart data…"
      aria-busy="true"
      className="flex flex-col gap-4 w-full"
    >
      {/* Search bar placeholder */}
      <Skeleton className="w-full h-8 rounded-md bg-muted animate-pulse" />

      {/* Chart area placeholder — covers main + volume + RSI + MACD panels */}
      <Skeleton className="w-full h-[600px] rounded-xl bg-muted animate-pulse" />

      {/* Indicator strip placeholder */}
      <Skeleton className="w-full h-16 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}
