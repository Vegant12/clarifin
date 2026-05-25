import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { scheduleParseBatchesForDoc } from "@/lib/ingest/trigger-parse-batch";
import { validatePdfMagicBytes } from "@/lib/upload-validation";

const bodySchema = z.object({
  doc_id: z.string().uuid(),
  session_token: z.string().uuid(),
  file_head_base64: z.string().min(12),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }

    const { doc_id, session_token, file_head_base64 } = parsed.data;

    let raw: Uint8Array;
    try {
      raw = Uint8Array.from(Buffer.from(file_head_base64, "base64"));
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid file data." },
        {
          status: 400,
        },
      );
    }

    const sessionRow = await supabaseAdmin
      .from("chat_sessions")
      .select("id")
      .eq("session_token", session_token)
      .maybeSingle();

    if (sessionRow.error || !sessionRow.data) {
      return NextResponse.json(
        { ok: false, error: "Document not found." },
        {
          status: 404,
        },
      );
    }

    const docRes = await supabaseAdmin
      .from("documents")
      .select("id, session_id, storage_path")
      .eq("id", doc_id)
      .maybeSingle();

    if (docRes.error || !docRes.data || docRes.data.session_id !== sessionRow.data.id) {
      return NextResponse.json(
        { ok: false, error: "Document not found." },
        {
          status: 404,
        },
      );
    }

    const storageCheck = await supabaseAdmin.storage
      .from("pdfs")
      .createSignedUrl(docRes.data.storage_path, 60);
    if (storageCheck.error || !storageCheck.data?.signedUrl) {
      console.error(
        "[upload-complete] storage object missing for",
        doc_id,
        storageCheck.error,
      );
      const incompleteMessage =
        "Upload incomplete — the PDF was not stored. Please try uploading again.";
      await supabaseAdmin
        .from("documents")
        .update({
          status: "failed",
          error_message: incompleteMessage,
          failed_at: new Date().toISOString(),
        })
        .eq("id", doc_id);
      return NextResponse.json(
        { ok: false, error: incompleteMessage },
        { status: 400 },
      );
    }

    const magic = validatePdfMagicBytes(raw);
    if (!magic.ok) {
      await supabaseAdmin.storage
        .from("pdfs")
        .remove([docRes.data.storage_path])
        .catch(() => {});

      await supabaseAdmin
        .from("documents")
        .update({
          status: "failed",
          error_message: "This file does not appear to be a valid PDF.",
          failed_at: new Date().toISOString(),
        })
        .eq("id", doc_id);

      return NextResponse.json({
        ok: false,
        error: "This file does not appear to be a valid PDF.",
      });
    }

    const patch = await supabaseAdmin
      .from("documents")
      .update({
        status: "parsing",
        error_message: null,
        failed_at: null,
      })
      .eq("id", doc_id);

    if (patch.error) {
      return NextResponse.json({ ok: false, error: "Could not finalize upload." }, { status: 500 });
    }

    scheduleParseBatchesForDoc(doc_id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      {
        status: 400,
      },
    );
  }
}
