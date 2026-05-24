import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { extractClientIp, isIpRateLimited } from "@/lib/rate-limit";
import { validatePdfUpload } from "@/lib/upload-validation";

const bodySchema = z.object({
  session_token: z.string().uuid(),
  filename: z.string().min(1).max(500),
  size_bytes: z.number().int().positive(),
  content_type: z.string().min(1).max(200),
});

function sanitizeFilename(raw: string): string {
  const basename = raw.replace(/\\/g, "/").split("/").pop() ?? "document.pdf";
  const safe = basename.trim();
  if (!safe || safe.includes("..")) {
    return "document.pdf";
  }
  return safe;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }

    const { session_token, filename: rawFilename, size_bytes, content_type } = parsed.data;

    const clientIp = extractClientIp(request);
    if (await isIpRateLimited(clientIp)) {
      return NextResponse.json(
        { error: "Daily upload limit reached. Come back tomorrow." },
        { status: 429 },
      );
    }

    const sessionRes = await supabaseAdmin
      .from("chat_sessions")
      .select("id")
      .eq("session_token", session_token)
      .maybeSingle();

    if (sessionRes.error || !sessionRes.data) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const sessionId = sessionRes.data.id;
    const safeName = sanitizeFilename(rawFilename);

    const validation = validatePdfUpload({
      size: size_bytes,
      type: content_type,
      name: safeName,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    const documentId = randomUUID();
    const storage_path = `${sessionId}/${documentId}/${safeName}`;

    const insertRes = await supabaseAdmin.from("documents").insert({
      id: documentId,
      session_id: sessionId,
      filename: safeName,
      storage_path,
      size_bytes,
      status: "uploaded",
      ip_address: clientIp,
    });

    if (insertRes.error) {
      return NextResponse.json({ error: "Could not create document record." }, { status: 500 });
    }

    const signedRes = await supabaseAdmin.storage.from("pdfs").createSignedUploadUrl(storage_path);

    if (signedRes.error || !signedRes.data) {
      await supabaseAdmin.from("documents").delete().eq("id", documentId);
      return NextResponse.json({ error: "Could not prepare upload. Try again." }, { status: 502 });
    }

    const { signedUrl, token, path } = signedRes.data;

    return NextResponse.json({
      doc_id: documentId,
      token,
      path,
      signed_url: signedUrl,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
