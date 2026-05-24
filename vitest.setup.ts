/**
 * Defaults so Vitest can import `@/lib/env` / `@/db/client` without a real `.env`.
 * Does not override variables the runner already set.
 */
const defaults = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-20-characters-min",
  GEMINI_API_KEY: "test-gemini-api-key-min-20-characters",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key-20-characters-minimum-x",
  INTERNAL_PARSE_SECRET: "01234567890123456789012345678901",
  LANGFUSE_SECRET_KEY: "sk-lf-test-secret-key-min-20-chars",
  LANGFUSE_PUBLIC_KEY: "pk-lf-test-public-key-min-20-chars",
};

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
