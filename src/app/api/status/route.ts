import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { env } from "@/lib/env";

const querySchema = z.object({
  doc_id: z.string().uuid(),
  session_token: z.string().uuid(),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawDocId = url.searchParams.get("doc_id");
  const rawSession = url.searchParams.get("session_token");

  if (rawDocId === null || rawSession === null) {
    return NextResponse.json(
      {
        error: "Missing query parameters. Required: doc_id and session_token (UUIDs).",
        missing: {
          doc_id: rawDocId === null,
          session_token: rawSession === null,
        },
      },
      { status: 400 },
    );
  }

  const parsed = querySchema.safeParse({
    doc_id: rawDocId,
    session_token: rawSession,
  });

  if (!parsed.success) {
    const docOk = z.string().uuid().safeParse(rawDocId);
    const sessOk = z.string().uuid().safeParse(rawSession);
    const parts: string[] = [];
    if (!docOk.success) {
      parts.push("doc_id must be a valid UUID");
    }
    if (!sessOk.success) {
      parts.push("session_token must be a valid UUID");
    }
    return NextResponse.json(
      {
        error: parts.length > 0 ? parts.join("; ") : "Invalid query parameters.",
      },
      { status: 400 },
    );
  }

  const { doc_id, session_token } = parsed.data;

  const sessionRes = await supabaseAdmin
    .from("chat_sessions")
    .select("id")
    .eq("session_token", session_token)
    .maybeSingle();

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  let docQuery = await supabaseAdmin
    .from("documents")
    .select("status, updated_at, error_message")
    .eq("id", doc_id)
    .eq("session_id", sessionRes.data.id)
    .maybeSingle();

  if (docQuery.error || !docQuery.data) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  let row = docQuery.data;

  if (env.STUB_PIPELINE_TICK === "true") {
    const staleMs = Date.now() - new Date(row.updated_at).getTime();
    const stale = staleMs >= 3000;

    if (stale && row.status === "parsing") {
      await supabaseAdmin.from("documents").update({ status: "embedding" }).eq("id", doc_id);
      docQuery = await supabaseAdmin
        .from("documents")
        .select("status, updated_at, error_message")
        .eq("id", doc_id)
        .single();
      if (!docQuery.error && docQuery.data) {
        row = docQuery.data;
      }
    } else if (stale && row.status === "embedding") {
      await supabaseAdmin.from("documents").update({ status: "analyzing" }).eq("id", doc_id);
      docQuery = await supabaseAdmin
        .from("documents")
        .select("status, updated_at, error_message")
        .eq("id", doc_id)
        .single();
      if (!docQuery.error && docQuery.data) {
        row = docQuery.data;
      }
    }
  }

  return NextResponse.json({
    status: row.status,
    updated_at: row.updated_at,
    error_message: row.error_message,
  });
}
