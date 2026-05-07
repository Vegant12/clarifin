import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";

const bodySchema = z.object({
  session_token: z.string().uuid(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request. Provide a UUID session_token." },
        { status: 400 },
      );
    }

    const { session_token } = parsed.data;

    const existing = await supabaseAdmin
      .from("chat_sessions")
      .select("id")
      .eq("session_token", session_token)
      .maybeSingle();

    if (existing.error) {
      return NextResponse.json({ error: "Could not verify session." }, { status: 500 });
    }

    if (existing.data) {
      return NextResponse.json({ session_id: existing.data.id });
    }

    const created = await supabaseAdmin
      .from("chat_sessions")
      .insert({ session_token })
      .select("id")
      .single();

    if (created.error || !created.data) {
      return NextResponse.json({ error: "Could not create session." }, { status: 500 });
    }

    return NextResponse.json({ session_id: created.data.id });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
