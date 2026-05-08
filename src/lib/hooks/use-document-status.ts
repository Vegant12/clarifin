"use client";

import { useEffect, useState } from "react";

import type { PipelineDocumentStatus } from "@/components/upload/pipeline-stepper";

export type DocStatusPayload = {
  status: PipelineDocumentStatus;
  updated_at: string;
  error_message: string | null;
};

const FAST_INITIAL_MS = 2500;
const FAST_MAX_MS = 10000;

/** Backend-heavy phases: poll less aggressively to avoid noisy GET /api/status. */
const HEAVY_PHASE_INITIAL_MS = 6000;
const HEAVY_PHASE_MAX_MS = 30000;
const POLL_WHEN_TAB_HIDDEN_MS = 60_000;

function backoffForStatus(status: PipelineDocumentStatus): {
  initialMs: number;
  maxMs: number;
} {
  if (status === "embedding" || status === "analyzing") {
    return { initialMs: HEAVY_PHASE_INITIAL_MS, maxMs: HEAVY_PHASE_MAX_MS };
  }
  return { initialMs: FAST_INITIAL_MS, maxMs: FAST_MAX_MS };
}

export function useDocumentStatus(opts: {
  docId: string;
  sessionToken: string | null;
  enabled: boolean;
}) {
  const { docId, sessionToken, enabled } = opts;
  const [data, setData] = useState<DocStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !sessionToken || !docId) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    /** Current poll spacing; bumped with stagnation backoff up to phase max. */
    let intervalMs = FAST_INITIAL_MS;
    let lastStatus: PipelineDocumentStatus | null = null;
    /** Upper bound per phase updates when status changes. */
    let phaseMaxMs = FAST_MAX_MS;

    const clearTimer = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const schedulePoll = () => {
      if (cancelled) {
        return;
      }
      const hidden =
        typeof document !== "undefined" && document.visibilityState === "hidden";
      const delay = hidden ? POLL_WHEN_TAB_HIDDEN_MS : intervalMs;
      clearTimer();
      timeoutId = setTimeout(() => void poll(), delay);
    };

    const poll = async () => {
      if (cancelled) {
        return;
      }
      try {
        const qs = new URLSearchParams({
          doc_id: docId,
          session_token: sessionToken,
        });
        const res = await fetch(`/api/status?${qs.toString()}`);
        const body: unknown = await res.json();

        if (cancelled) {
          return;
        }

        if (!res.ok) {
          const errObj = body as { error?: string };
          setError(errObj.error ?? "We couldn't find this document. It may have been removed.");
          clearTimer();
          return;
        }

        const json = body as DocStatusPayload;
        setData(json);
        setError(null);

        const { initialMs: nextInitial, maxMs: nextMax } = backoffForStatus(json.status);
        phaseMaxMs = nextMax;

        if (lastStatus === null || lastStatus !== json.status) {
          intervalMs = nextInitial;
          lastStatus = json.status;
        } else {
          intervalMs = Math.min(Math.round(intervalMs * 1.45), phaseMaxMs);
        }

        if (json.status === "ready" || json.status === "failed") {
          clearTimer();
          return;
        }

        schedulePoll();
      } catch {
        if (cancelled) {
          return;
        }
        setError("We couldn't reach the server. Check your connection and try again.");
        schedulePoll();
      }
    };

    const onVisibility = () => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      clearTimer();
      void poll();
    };

    void poll();

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [docId, sessionToken, enabled]);

  return { data, error };
}
