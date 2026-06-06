import { timingSafeEqual } from "node:crypto";

/**
 * Shared internal-route auth helpers. Extracted from parse-batch / embed-batch /
 * analyze-batch in Phase 13 Wave 0. All three existing routes import from here.
 *
 * Dual-path auth (Bearer header OR ?secret= query param) is REQUIRED because
 * Vercel Cron GET requests cannot send custom headers.
 */
export function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  const len = Math.max(ba.length, bb.length);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  ba.copy(padA);
  bb.copy(padB);
  return timingSafeEqual(padA, padB) && ba.length === bb.length;
}

export function extractBearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) {
    return null;
  }
  return h.slice(7);
}

export function resolveCandidate(request: Request): string {
  const url = new URL(request.url);
  return extractBearer(request) ?? url.searchParams.get("secret") ?? "";
}
