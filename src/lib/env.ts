import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Single source of truth for environment variables.
 *
 * Server schema validates secrets that must NEVER reach the browser bundle.
 * Client schema validates browser-safe public values (must start with NEXT_PUBLIC_).
 *
 * Importing this module on the server triggers Zod validation at module-load
 * time — if any required var is missing or malformed, the process throws before
 * serving any request. This satisfies Phase 1 Success Criterion 4
 * ("app fails fast with a clear error if any [env vars] are missing at startup").
 */
export const env = createEnv({
  server: {
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    GEMINI_API_KEY: z.string().min(20),
    /**
     * Shared secret for cron + server `after()` to call internal parse-batch.
     * Min 32 chars; set in Vercel env. Never `NEXT_PUBLIC_*`.
     */
    INTERNAL_PARSE_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Dev-only: auto-advance document_status for Phase 2 UI testing */
    STUB_PIPELINE_TICK: z.string().optional(),
    /** Optional public site URL for server-side fetch (else VERCEL_URL, localhost) */
    CLARIFIN_APP_URL: z.string().url().optional(),
  },

  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  },

  /**
   * Spread keys explicitly so Next.js can statically replace NEXT_PUBLIC_*
   * at build time (passing process.env wholesale would defeat that).
   */
  runtimeEnv: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    INTERNAL_PARSE_SECRET: process.env.INTERNAL_PARSE_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    STUB_PIPELINE_TICK: process.env.STUB_PIPELINE_TICK,
    CLARIFIN_APP_URL: process.env.CLARIFIN_APP_URL,
  },

  /**
   * Set SKIP_ENV_VALIDATION=true only in CI build-only contexts where secrets
   * are intentionally absent. Production / dev should always validate.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Treat empty strings as undefined so missing-but-set env vars (e.g.,
   * `GEMINI_API_KEY=` in .env.local) trigger the same "Required" error as
   * fully unset vars.
   */
  emptyStringAsUndefined: true,
});
