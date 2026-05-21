"use client";

/**
 * Phase 10 CHAT-06 deflection bubble.
 * Neutral info box — NOT destructive coloring (UI-SPEC Guardrail Deflection Message).
 */
export function GuardrailDeflection(props: { message: string }) {
  const { message } = props;
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-lg border border-border bg-muted/30 px-4 py-3 flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">I can&apos;t help with that</p>
        <p className="text-sm text-foreground leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
