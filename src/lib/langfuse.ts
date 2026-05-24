import "server-only";

import { Langfuse } from "langfuse";

import { env } from "@/lib/env";

/**
 * Singleton Langfuse v3 client (D-01).
 *
 * One instance per Node.js process. Every call site MUST import this binding
 * — never `new Langfuse()` per request, which spawns a fresh queue/flush timer
 * (AI-SPEC §3 pitfall 2).
 *
 * `import "server-only"` causes a build error if any client component imports
 * this file, preventing accidental leak of the secret key into the browser
 * bundle.
 *
 * Imported from `"langfuse"` (the classic SDK v3) — DO NOT switch to
 * `@langfuse/otel` or `@langfuse/tracing`, which require OpenTelemetry setup
 * that conflicts with Next.js serverless (AI-SPEC §3 pitfall 3).
 */
export const langfuse = new Langfuse({
  secretKey: env.LANGFUSE_SECRET_KEY,
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  ...(env.LANGFUSE_HOST ? { baseUrl: env.LANGFUSE_HOST } : {}),
});
