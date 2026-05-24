import "server-only";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/db/client";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * INFRA-05: Weekly Vercel Cron keep-alive.
 *
 * Runs a trivial `SELECT id FROM documents LIMIT 1` against Supabase to
 * prevent the project from pausing after 1 week of inactivity (Supabase
 * Feb 2026 policy).
 *
 * Scheduled in vercel.json at `0 0 * * 0` (Sunday 00:00 UTC, weekly).
 * Public route — no auth gate in v1 (the query is read-only and trivial).
 */
export async function GET(): Promise<Response> {
  try {
    const { error } = await supabaseAdmin
      .from("documents")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
