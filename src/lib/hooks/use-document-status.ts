"use client";

import { useEffect, useState } from "react";

import type { PipelineDocumentStatus } from "@/components/upload/pipeline-stepper";

export type DocStatusPayload = {
  status: PipelineDocumentStatus;
  updated_at: string;
  error_message: string | null;
};

const INITIAL_INTERVAL_MS = 2500;
const MAX_INTERVAL_MS = 10000;

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
    let intervalMs = INITIAL_INTERVAL_MS;
    let lastStatus: string | null = null;

    const clearTimer = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
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

        if (lastStatus !== null && lastStatus === json.status) {
          intervalMs = Math.min(Math.round(intervalMs * 1.45), MAX_INTERVAL_MS);
        } else {
          intervalMs = INITIAL_INTERVAL_MS;
          lastStatus = json.status;
        }

        if (json.status === "ready" || json.status === "failed") {
          clearTimer();
          return;
        }

        timeoutId = setTimeout(poll, intervalMs);
      } catch {
        if (cancelled) {
          return;
        }
        setError("We couldn't reach the server. Check your connection and try again.");
        timeoutId = setTimeout(poll, intervalMs);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [docId, sessionToken, enabled]);

  return { data, error };
}
