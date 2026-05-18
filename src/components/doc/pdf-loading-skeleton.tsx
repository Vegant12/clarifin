"use client";

export function PdfLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading PDF document…"
      aria-busy="true"
      className="flex flex-col gap-3 p-4"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-48 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
