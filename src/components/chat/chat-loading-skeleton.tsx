"use client";

/**
 * Phase 10 CHAT-03 streaming loading indicator.
 * Three-dot bounce per UI-SPEC Streaming Loading Indicator.
 */
export function ChatLoadingSkeleton() {
  return (
    <div className="flex justify-start gap-3">
      <div className="rounded-2xl rounded-bl-sm bg-background border border-border px-4 py-3">
        <div
          className="flex gap-1 items-center"
          role="status"
          aria-label="Clarifin is thinking"
        >
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
        </div>
      </div>
    </div>
  );
}
