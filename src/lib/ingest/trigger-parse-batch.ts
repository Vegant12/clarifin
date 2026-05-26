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

async function callInternal(path: string, docId: string): Promise<void> {
  const base = getInternalAppBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.INTERNAL_PARSE_SECRET}`,
      },
      body: JSON.stringify({ doc_id: docId }),
    });
  } catch (e) {
    console.error(`[trigger] fetch error → ${path}`, docId, e);
    return;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[trigger] non-2xx from ${path}`, docId, res.status, body);
  }
}

/** Fire-and-forget first parse batch after upload handoff (Phase 3). */
export function scheduleParseBatchesForDoc(docId: string): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  after(() => callInternal("/api/internal/parse-batch", docId));
}

/** Chain embedding batches after parsing → embedding (Phase 4). */
export function scheduleEmbedBatchesForDoc(docId: string): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  after(() => callInternal("/api/internal/embed-batch", docId));
}

/** Chain analyze batch after embedding → analyzing (Phase 6). */
export function scheduleAnalyzeBatchForDoc(docId: string): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  after(() => callInternal("/api/internal/analyze-batch", docId));
}
