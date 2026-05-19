"use client";

export function ScoreLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading AI assessment…"
      aria-busy="true"
      className="flex flex-col gap-3 p-4"
    >
      {/* Score number placeholder */}
      <div className="mx-auto h-12 w-16 animate-pulse rounded-md bg-muted" />
      {/* Disclaimer placeholder */}
      <div className="mx-auto h-4 w-40 animate-pulse rounded bg-muted" />
      {/* 4 dimension row placeholders */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-10 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
