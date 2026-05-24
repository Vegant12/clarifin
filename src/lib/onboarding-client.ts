"use client";

export const ONBOARDING_SEEN_KEY = "clarifin_onboarding_seen";

/**
 * Returns true if the user has already dismissed the onboarding modal.
 * Returns false on the server (SSR guard) — safe to call during SSR.
 */
export function getOnboardingSeen(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === "1";
}

/**
 * Marks the onboarding modal as seen. Call after the user dismisses the modal.
 * No-op on the server.
 */
export function setOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
}
