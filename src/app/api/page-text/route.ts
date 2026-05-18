import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";

const querySchema = z.object({
  doc_id: z.string().uuid(),
  session_token: z.string().uuid(),
  page: z.coerce.number().int().positive(),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawDocId = url.searchParams.get("doc_id");
  const rawSession = url.searchParams.get("session_token");
  const rawPage = url.searchParams.get("page");

  if (rawDocId === null || rawSession === null || rawPage === null) {
    return NextResponse.json(
      {
        error:
          "Missing query parameters. Required: doc_id (UUID), session_token (UUID), and page (positive integer).",
        missing: {
          doc_id: rawDocId === null,
          session_token: rawSession === null,
          page: rawPage === null,
        },
      },
      { status: 400 },
    );
  }

  const parsed = querySchema.safeParse({
    doc_id: rawDocId,
    session_token: rawSession,
    page: rawPage,
  });

  if (!parsed.success) {
    const docOk = z.string().uuid().safeParse(rawDocId);
    const sessOk = z.string().uuid().safeParse(rawSession);
    const pageOk = z.coerce.number().int().positive().safeParse(rawPage);
    const parts: string[] = [];
    if (!docOk.success) parts.push("doc_id must be a valid UUID");
    if (!sessOk.success) parts.push("session_token must be a valid UUID");
    if (!pageOk.success) parts.push("page must be a positive integer");
    return NextResponse.json(
      { error: parts.length > 0 ? parts.join("; ") : "Invalid query parameters." },
      { status: 400 },
    );
  }

  const { doc_id, session_token, page } = parsed.data;

  const sessionRes = await supabaseAdmin
    .from("chat_sessions")
    .select("id")
    .eq("session_token", session_token)
    .maybeSingle();

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const docRes = await supabaseAdmin
    .from("documents")
    .select("id")
    .eq("id", doc_id)
    .eq("session_id", sessionRes.data.id)
    .maybeSingle();

  if (docRes.error || !docRes.data) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const chunkRes = await supabaseAdmin
    .from("chunks")
    .select("content")
    .eq("doc_id", doc_id)
    .eq("page_number", page)
    .limit(1)
    .maybeSingle();

  if (chunkRes.error || !chunkRes.data) {
    return NextResponse.json({ error: "Page text not found." }, { status: 404 });
  }

  return NextResponse.json({ text: chunkRes.data.content });
}
