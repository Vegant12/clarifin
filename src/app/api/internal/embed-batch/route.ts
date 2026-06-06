import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { env } from "@/lib/env";
import { timingSafeStringEq, resolveCandidate } from "@/lib/internal-auth";
import { runEmbedBatch } from "@/lib/ingest/embed-document-batch";

export const maxDuration = 60;

/**
 * Internal embedding worker. Same auth model as parse-batch (`INTERNAL_PARSE_SECRET`).
 * Loops `runEmbedBatch` internally until done or out of time. We do NOT self-fetch
 * via `after()` — Vercel returns 508 INFINITE_LOOP_DETECTED on same-URL chains.
 */

const bodySchema = z.object({
  doc_id: z.string().uuid().optional(),
});

async function handleEmbedBatch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const candidate = resolveCandidate(request);
  if (!timingSafeStringEq(candidate, env.INTERNAL_PARSE_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let json: unknown = {};
  if (request.method === "POST") {
    json = await request.json().catch(() => ({}));
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  let docId: string | undefined = parsed.data.doc_id;
  if (!docId) {
    const q = url.searchParams.get("doc_id");
    const uuid = z.string().uuid().safeParse(q);
    if (uuid.success) {
      docId = uuid.data;
    }
  }
  if (!docId) {
    const pick = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("status", "embedding")
      .order("updated_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pick.error || !pick.data) {
      return NextResponse.json({ ok: true, done: false, doc_id: null });
    }
    docId = pick.data.id;
  }

  // Loop batches inside this single invocation — see parse-batch route for
  // the rationale (Vercel 508 INFINITE_LOOP_DETECTED on self-fetch chains).
  const overallDeadline = Date.now() + 55_000;
  let result = await runEmbedBatch({ docId });
  while (!result.done && Date.now() < overallDeadline) {
    result = await runEmbedBatch({ docId });
  }
  return NextResponse.json({ ok: true, doc_id: docId, done: result.done });
}

export function GET(request: Request): Promise<Response> {
  return handleEmbedBatch(request);
}

export function POST(request: Request): Promise<Response> {
  return handleEmbedBatch(request);
}
