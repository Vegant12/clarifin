import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS (D-12: RLS is disabled in v1; access
 * control is enforced at API route boundaries via session_token filtering).
 *
 * The `import "server-only"` directive at the top of this module causes a
 * build error if any client component imports this file — Next.js's primary
 * defense against accidental service-role-key leaks to the browser.
 */
export const supabaseAdmin = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
