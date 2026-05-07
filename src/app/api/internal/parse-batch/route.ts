import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { env } from "@/lib/env";
import { runParseBatch } from "@/lib/ingest/parse-document-batch";

/**
 * Internal ingestion worker. Authenticated via `INTERNAL_PARSE_SECRET` using either:
 * - `Authorization: Bearer <secret>` (server `after()`), or
 * - `?secret=<secret>` (Vercel Cron — GET by default, cannot send custom headers).
 */

function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ba, bb);
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

async function handleParseBatch(request: Request): Promise<Response> {
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
      .eq("status", "parsing")
      .order("updated_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pick.error || !pick.data) {
      return NextResponse.json({ ok: true, done: false, doc_id: null });
    }
    docId = pick.data.id;
  }

  const result = await runParseBatch({ docId });
  return NextResponse.json({ ok: true, doc_id: docId, done: result.done });
}

export function GET(request: Request): Promise<Response> {
  return handleParseBatch(request);
}

export function POST(request: Request): Promise<Response> {
  return handleParseBatch(request);
}
