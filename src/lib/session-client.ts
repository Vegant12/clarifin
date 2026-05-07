"use client";

export const SESSION_STORAGE_KEY = "clarifin_session_token";

export function getBrowserSessionToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

/**
 * Ensures `clarifin_session_token` exists in localStorage and a matching
 * `chat_sessions` row exists via `POST /api/session`.
 */
export async function ensureBrowserSession(): Promise<void> {
  let token = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, token);
  }

  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: token }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not start session.");
  }
}
