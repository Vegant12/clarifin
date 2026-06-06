import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { env } from "@/lib/env";
import { timingSafeStringEq, resolveCandidate } from "@/lib/internal-auth";
import { runParseBatch } from "@/lib/ingest/parse-document-batch";
import { runEmbedBatch } from "@/lib/ingest/embed-document-batch";
import { runAnalyzeBatch } from "@/lib/ingest/analyze-document-batch";
import { runTaRefreshOhlcv } from "@/lib/ta/jobs/refresh-ohlcv";

/**
 * Phase 13 Plan 07 — TA-INFRA-02: Single cron dispatcher.
 *
 * Replaces the v1.0 per-route crons (parse-batch, embed-batch) with a single
 * dispatcher that routes to "daily" or "weekly" jobs via ?job= query param.
 *
 * CRITICAL: Uses direct function imports ONLY — never fetch() self-calls.
 * Vercel detects same-URL chains and returns 508 INFINITE_LOOP_DETECTED.
 * (See parse-batch/route.ts lines 13-22 for the original documentation.)
 *
 * Auth: dual-path — Bearer header OR ?secret= query param (same as all internal routes).
 * The cron paths in vercel.json do NOT embed the secret. The dispatcher accepts
 * Vercel's Authorization: Bearer ${CRON_SECRET} header (resolveCandidate handles Bearer).
 * If CRON_SECRET is not set, the secret can also be appended as ?secret= by the caller.
 *
 * Security:
 *   T-13-25: resolveCandidate + timingSafeStringEq(env.INTERNAL_PARSE_SECRET) → 401 on mismatch
 *   T-13-26: direct function imports — no fetch() self-call (508 guard)
 *   T-13-27: 55s deadline budget; each job checks deadline before execution
 *   T-13-28: secret never in vercel.json (committed file)
 */

export const maxDuration = 60;
export const runtime = "nodejs";

// ─── Job schema ───────────────────────────────────────────────────────────────

const jobSchema = z.enum(["daily", "weekly"]);

// ─── Adapter sweeps for v1.0 jobs ────────────────────────────────────────────
// The v1.0 job functions (runParseBatch, runEmbedBatch, runAnalyzeBatch) take
// { docId } and process one document per call. The dispatcher wraps them in
// sweep functions that iterate pending documents until done or deadline hit.

async function runParseSweep(deadline: number): Promise<Record<string, unknown>> {
  let processed = 0;
  let iterations = 0;
  const MAX_ITER = 20; // safety cap against unexpected tight loops

  while (Date.now() < deadline && iterations < MAX_ITER) {
    iterations++;
    // Pick the oldest document still in "parsing" status
    const pick = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("status", "parsing")
      .order("updated_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pick.error || !pick.data) {
      break; // no pending documents
    }

    const docId = pick.data.id;
    try {
      const result = await runParseBatch({ docId });
      processed++;
      if (result.done) {
        // document is done parsing — continue to look for more
        continue;
      }
    } catch (err) {
      console.error("[dispatch:parse-sweep] error", docId, err instanceof Error ? err.message : err);
    }
    break; // stop after one doc per invocation to respect deadline
  }

  return { sweep: "parse", processed };
}

async function runEmbedSweep(deadline: number): Promise<Record<string, unknown>> {
  let processed = 0;
  let iterations = 0;
  const MAX_ITER = 20;

  while (Date.now() < deadline && iterations < MAX_ITER) {
    iterations++;
    const pick = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("status", "embedding")
      .order("updated_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pick.error || !pick.data) {
      break;
    }

    const docId = pick.data.id;
    try {
      const result = await runEmbedBatch({ docId });
      processed++;
      if (result.done) {
        continue;
      }
    } catch (err) {
      console.error("[dispatch:embed-sweep] error", docId, err instanceof Error ? err.message : err);
    }
    break;
  }

  return { sweep: "embed", processed };
}

async function runAnalyzeSweep(deadline: number): Promise<Record<string, unknown>> {
  let processed = 0;
  let iterations = 0;
  const MAX_ITER = 10; // analyze calls Gemini — more expensive; fewer iterations

  while (Date.now() < deadline && iterations < MAX_ITER) {
    iterations++;
    const pick = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("status", "analyzing")
      .order("updated_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pick.error || !pick.data) {
      break;
    }

    const docId = pick.data.id;
    try {
      const result = await runAnalyzeBatch({ docId });
      processed++;
      if (result.done) {
        continue;
      }
    } catch (err) {
      console.error("[dispatch:analyze-sweep] error", docId, err instanceof Error ? err.message : err);
    }
    break;
  }

  return { sweep: "analyze", processed };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleDaily(deadline: number): Promise<Response> {
  // Run v1.0 sweeps and TA refresh; each is guarded by the deadline.
  const results: Record<string, unknown>[] = [];

  // T-13-27: check deadline before each job
  if (Date.now() < deadline) {
    results.push(await runParseSweep(deadline).catch((e: unknown) => ({
      sweep: "parse",
      error: e instanceof Error ? e.message : String(e),
    })));
  }

  if (Date.now() < deadline) {
    results.push(await runEmbedSweep(deadline).catch((e: unknown) => ({
      sweep: "embed",
      error: e instanceof Error ? e.message : String(e),
    })));
  }

  if (Date.now() < deadline) {
    results.push(await runAnalyzeSweep(deadline).catch((e: unknown) => ({
      sweep: "analyze",
      error: e instanceof Error ? e.message : String(e),
    })));
  }

  if (Date.now() < deadline) {
    results.push(
      await runTaRefreshOhlcv({ deadline: new Date(deadline) }).catch(
        (e: unknown) => ({
          job: "runTaRefreshOhlcv",
          error: e instanceof Error ? e.message : String(e),
        }),
      ),
    );
  } else {
    results.push({ job: "runTaRefreshOhlcv", skipped: "deadline" });
  }

  return NextResponse.json({ ok: true, kind: "daily", results });
}

async function handleWeekly(): Promise<Response> {
  // Keep-alive ping — a trivial DB read to keep Supabase warm.
  // Covers v1.0 R3 keep-alive intent partially (full R3 stays in backlog).
  const { error } = await supabaseAdmin
    .from("ticker_metadata")
    .select("ticker")
    .limit(1);

  if (error) {
    console.warn("[dispatch:weekly] keep-alive query failed", error.message);
  }

  return NextResponse.json({ ok: true, kind: "weekly" });
}

async function handleDispatch(request: Request): Promise<Response> {
  // T-13-25: auth check
  const candidate = resolveCandidate(request);
  if (!timingSafeStringEq(candidate, env.INTERNAL_PARSE_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const jobParsed = jobSchema.safeParse(url.searchParams.get("job"));
  if (!jobParsed.success) {
    return NextResponse.json({ error: "Unknown job. Use ?job=daily or ?job=weekly." }, { status: 400 });
  }

  // T-13-27: 55s deadline leaves 5s for function teardown within Vercel's 60s cap.
  const deadline = Date.now() + 55_000;

  if (jobParsed.data === "daily") {
    return handleDaily(deadline);
  }
  return handleWeekly();
}

export function GET(request: Request): Promise<Response> {
  return handleDispatch(request);
}
