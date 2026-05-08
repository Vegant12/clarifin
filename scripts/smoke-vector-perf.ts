#!/usr/bin/env npx tsx
/**
 * Destructive local-only HNSW smoke: inserts ~10k embedded chunks for a throwaway document,
 * times one `match_document_chunks` call, then deletes the document (cascade).
 *
 * Prerequisites: `supabase start` + migrations applied (`pnpm exec supabase db reset`).
 * Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same as dev `.env.local`).
 *
 * Run: `pnpm exec tsx scripts/smoke-vector-perf.ts`
 * After failure or polluted state: `pnpm exec supabase db reset --yes`.
 */

import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} must be set (use .env.local or export before running)`);
  }
  return v;
}

function randVecString(): string {
  const xs = Array.from({ length: 768 }, () => Number((Math.random() * 2 - 1).toFixed(6)));
  return `[${xs.join(",")}]`;
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const total = 10_000;
  const batch = 250;

  const { data: docRow, error: docErr } = await supabase
    .from("documents")
    .insert({
      filename: "__smoke_vector_perf__.pdf",
      storage_path: "__smoke_vector_perf__",
      size_bytes: 1,
      status: "ready",
    })
    .select("id")
    .single();

  if (docErr || !docRow) {
    throw new Error(docErr?.message ?? "could not insert smoke document");
  }

  const docId = docRow.id;
  console.log(`smoke-vector-perf: doc_id=${docId}, inserting ${total} chunks…`);

  const t0Insert = Date.now();
  for (let i = 0; i < total; i += batch) {
    const n = Math.min(batch, total - i);
    const rows = Array.from({ length: n }, (_, j) => {
      const chunkIndex = i + j + 1;
      return {
        doc_id: docId,
        page_number: 1,
        source_page_start: 1,
        source_page_end: 1,
        chunk_type: "prose" as const,
        chunk_index: chunkIndex,
        content: `perf_chunk_${chunkIndex}`,
        embedding: randVecString(),
        token_count: 4,
      };
    });

    const { error: insErr } = await supabase.from("chunks").insert(rows);
    if (insErr) {
      await supabase.from("documents").delete().eq("id", docId);
      throw new Error(insErr.message);
    }
    if ((i + batch) % 2000 === 0) {
      process.stdout.write(`  …${Math.min(i + batch, total)} rows\r`);
    }
  }
  const insertMs = Date.now() - t0Insert;

  console.log(
    "Optional: ANALYZE public.chunks in psql/`supabase db shell` before timing if results look pessimistic.",
  );

  const queryEmb = randVecString();

  const t1 = performance.now();
  const { data, error } = await supabase.rpc("match_document_chunks", {
    p_doc_id: docId,
    p_query_embedding: queryEmb,
    p_match_count: 5,
  });
  const elapsed = performance.now() - t1;

  if (error) {
    await supabase.from("documents").delete().eq("id", docId);
    throw new Error(error.message);
  }

  console.log(`insert_wall_ms=${insertMs}`);
  console.log(`match_document_chunks_ms=${elapsed.toFixed(2)}`);
  console.log(`rows_returned=${data?.length ?? 0}`);

  await supabase.from("documents").delete().eq("id", docId);
  console.log("smoke-vector-perf: cleaned up smoke document.");

  console.log(`
Target from ROADMAP / D4-08: <500ms wall time on ~10k local HNSW for one query (hardware-dependent).
Record your observed match_document_chunks_ms in 04-UAT.md after running this against local Supabase.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
