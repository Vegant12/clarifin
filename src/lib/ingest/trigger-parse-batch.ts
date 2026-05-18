import "server-only";

import { after } from "next/server";

import { env } from "@/lib/env";

/**
 * Base URL for server-to-server calls.
 * Order: `CLARIFIN_APP_URL` → `VERCEL_URL` → localhost.
 */
export function getInternalAppBaseUrl(): string {
  if (env.CLARIFIN_APP_URL) {
    return env.CLARIFIN_APP_URL.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return `https://${vercel}`;
  }
  return "http://localhost:3000";
}

/** Fire-and-forget first parse batch after upload handoff (Phase 3). */
export function scheduleParseBatchesForDoc(docId: string): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  after(async () => {
    try {
      const base = getInternalAppBaseUrl();
      await fetch(`${base}/api/internal/parse-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.INTERNAL_PARSE_SECRET}`,
        },
        body: JSON.stringify({ doc_id: docId }),
      });
    } catch (e) {
      console.error("scheduleParseBatchesForDoc", e);
    }
  });
}

/** Chain embedding batches after parsing → embedding (Phase 4). */
export function scheduleEmbedBatchesForDoc(docId: string): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  after(async () => {
    try {
      const base = getInternalAppBaseUrl();
      await fetch(`${base}/api/internal/embed-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.INTERNAL_PARSE_SECRET}`,
        },
        body: JSON.stringify({ doc_id: docId }),
      });
    } catch (e) {
      console.error("scheduleEmbedBatchesForDoc", e);
    }
  });
}

/** Chain analyze batch after embedding → analyzing (Phase 6). */
export function scheduleAnalyzeBatchForDoc(docId: string): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  after(async () => {
    try {
      const base = getInternalAppBaseUrl();
      await fetch(`${base}/api/internal/analyze-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.INTERNAL_PARSE_SECRET}`,
        },
        body: JSON.stringify({ doc_id: docId }),
      });
    } catch (e) {
      console.error("scheduleAnalyzeBatchForDoc", e);
    }
  });
}
