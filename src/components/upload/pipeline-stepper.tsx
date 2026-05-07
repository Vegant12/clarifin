"use client";

import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = ["Parsing", "Embedding", "Analyzing"] as const;

export type PipelineDocumentStatus =
  | "uploaded"
  | "parsing"
  | "embedding"
  | "analyzing"
  | "ready"
  | "failed";

/** Maps DB status to linear step index (Parsing = 0). */
function activeStepIndex(status: PipelineDocumentStatus): number {
  switch (status) {
    case "uploaded":
    case "parsing":
      return 0;
    case "embedding":
      return 1;
    case "analyzing":
    case "ready":
    case "failed":
      return 2;
    default:
      return 0;
  }
}

function completedBefore(stepIdx: number, status: PipelineDocumentStatus): boolean {
  if (status === "ready") {
    return true;
  }
  if (status === "failed") {
    return false;
  }
  const active = activeStepIndex(status);
  return stepIdx < active;
}

function isActiveStep(stepIdx: number, status: PipelineDocumentStatus): boolean {
  if (status === "failed") {
    return stepIdx === 0;
  }
  if (status === "ready") {
    return false;
  }
  return stepIdx === activeStepIndex(status);
}

function isFailureStep(stepIdx: number, status: PipelineDocumentStatus): boolean {
  return status === "failed" && stepIdx === 0;
}

export function PipelineStepper(props: { status: PipelineDocumentStatus }) {
  const { status } = props;

  return (
    <ol
      aria-label="Processing steps"
      className="flex w-full flex-wrap items-start justify-between gap-4 gap-y-6 text-sm md:flex-nowrap"
    >
      {STEPS.map((label, idx) => {
        const done = completedBefore(idx, status);
        const active = isActiveStep(idx, status);
        const failedHere = isFailureStep(idx, status);

        return (
          <li
            aria-current={active ? "step" : undefined}
            className={cn("flex min-w-[5.5rem] flex-col items-center gap-2 md:flex-1")}
            key={label}
          >
            {done ? <span className="sr-only">{`Completed: ${label}`}</span> : null}
            <span
              aria-hidden
              className={cn(
                "flex size-11 items-center justify-center rounded-full border-2 font-mono tabular-nums",
                failedHere &&
                  "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30",
                done && !failedHere && "border-primary bg-primary text-primary-foreground",
                active &&
                  !failedHere &&
                  !done &&
                  "border-primary bg-primary/10 ring-2 ring-primary/30",
                !done && !active && !failedHere && "border-muted bg-muted text-muted-foreground",
              )}
            >
              {failedHere ? (
                <span aria-hidden className="font-bold text-xs">
                  !
                </span>
              ) : done ? (
                <Check aria-hidden className="size-5" strokeWidth={2.5} />
              ) : active ? (
                <Loader2 aria-hidden className="size-5 animate-spin text-primary" />
              ) : (
                <span aria-hidden>{idx + 1}</span>
              )}
            </span>
            <span
              className={cn(
                "text-center font-medium",
                failedHere && "text-destructive",
                active && !failedHere && "text-foreground",
                !active &&
                  completedBefore(idx, status) &&
                  status !== "failed" &&
                  "text-muted-foreground",
                status === "ready" && "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
