"use client";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

/** Browser Supabase client (anon key) for Storage uploads via signed URLs. */
export function getBrowserSupabase() {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  browserClient = createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return browserClient;
}
