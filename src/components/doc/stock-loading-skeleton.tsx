"use client";

export function StockLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading market data…"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      <div className="h-[108px] w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-[268px] w-full animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
