import "server-only";

import { supabaseAdmin } from "@/db/client";

/** Maximum number of uploads allowed per IP address within a rolling 24-hour window. */
const DAILY_UPLOAD_LIMIT = 5;

/**
 * Extracts the client IP address from the request.
 * Vercel sets the x-forwarded-for header; the leftmost IP is the client.
 * Falls back to "unknown" for local development environments.
 */
export function extractClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

/**
 * Returns true if the given IP has reached the daily upload limit.
 * Counts documents rows for this IP created within the last 24 hours.
 *
 * Fails OPEN on DB error — if the check cannot be performed, the upload proceeds.
 * This prevents a DB outage from locking out all users.
 */
export async function isIpRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);

  if (error) {
    // Fail open: do not block the user if we cannot check the rate limit.
    console.error("[rate-limit] DB error checking upload rate:", error.message);
    return false;
  }

  return (count ?? 0) >= DAILY_UPLOAD_LIMIT;
}
