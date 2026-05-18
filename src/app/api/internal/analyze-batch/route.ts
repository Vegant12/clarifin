import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { env } from "@/lib/env";
import { runAnalyzeBatch } from "@/lib/ingest/analyze-document-batch";

/**
 * Internal analyze worker. Same auth model as embed-batch (`INTERNAL_PARSE_SECRET`).
 * Triggered via after() from embed-document-batch when a doc transitions to "analyzing".
 * Does NOT self-chain — runAnalyzeBatch is a single Gemini call per invocation.
 */

export const maxDuration = 300;

function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Pad both to the same length so the timingSafeEqual call always runs.
  const len = Math.max(ba.length, bb.length);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  ba.copy(padA);
  bb.copy(padB);
  // Still do explicit length check, but only AFTER constant-time compare.
  return timingSafeEqual(padA, padB) && ba.length === bb.length;
}

function extractBearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) {
    return null;
  }
  return h.slice(7);
}

const bodySchema = z.object({
  doc_id: z.string().uuid().optional(),
});

async function handleAnalyzeBatch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headerSecret = extractBearer(request);
  const querySecret = url.searchParams.get("secret");
  const candidate = headerSecret ?? querySecret ?? "";
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
      .eq("status", "analyzing")
      .order("updated_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pick.error || !pick.data) {
      return NextResponse.json({ ok: true, done: false, doc_id: null });
    }
    docId = pick.data.id;
  }

  const result = await runAnalyzeBatch({ docId });
  return NextResponse.json({ ok: true, doc_id: docId, done: result.done });
}

export function GET(request: Request): Promise<Response> {
  return handleAnalyzeBatch(request);
}

export function POST(request: Request): Promise<Response> {
  return handleAnalyzeBatch(request);
}
