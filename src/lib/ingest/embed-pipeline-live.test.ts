/**
 * Live integration test — Phase 4 UAT item 1.
 * Requires real SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY in env.
 * Skipped automatically when env vars are test stubs (contain "test-" prefix).
 *
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... npm test -- embed-pipeline-live
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { runEmbedBatch } from "./embed-document-batch";

const isLive =
	process.env.SUPABASE_URL?.startsWith("https://") &&
	process.env.GEMINI_API_KEY &&
	!process.env.GEMINI_API_KEY.startsWith("test-");

const maybeDescribe = isLive ? describe : describe.skip;

maybeDescribe("embed pipeline — live integration", () => {
	const sb = createClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);
	let docId: string;

	beforeAll(async () => {
		// Insert a test document in embedding state
		const { data: doc, error } = await sb
			.from("documents")
			.insert({
				filename: "live-embed-test.pdf",
				storage_path: "test/live-embed-test.pdf",
				size_bytes: 1024,
				status: "embedding",
			})
			.select("id")
			.single();
		if (error) throw new Error(`doc insert: ${error.message}`);
		docId = doc.id;

		// Insert 5 chunks with null embeddings
		const chunks = Array.from({ length: 5 }, (_, i) => ({
			doc_id: docId,
			page_number: i + 1,
			source_page_start: i + 1,
			source_page_end: i + 1,
			chunk_index: i,
			content:
				"Laba bersih perusahaan pada tahun 2023 adalah Rp 5 triliun, meningkat 20% dari tahun sebelumnya. Aset lancar meningkat signifikan.",
			chunk_type: "prose",
			embedding: null,
		}));
		const { error: chunkErr } = await sb.from("chunks").insert(chunks);
		if (chunkErr) throw new Error(`chunk insert: ${chunkErr.message}`);
	}, 30_000);

	afterAll(async () => {
		// Cascade delete cleans up chunks too
		if (docId) await sb.from("documents").delete().eq("id", docId);
	});

	it("embeds all chunks and transitions document to analyzing", async () => {
		const result = await runEmbedBatch({ docId });
		expect(result.done).toBe(true);

		// Verify zero null embeddings
		const { count } = await sb
			.from("chunks")
			.select("id", { count: "exact", head: true })
			.eq("doc_id", docId)
			.is("embedding", null);
		expect(count).toBe(0);

		// Spot-check metadata completeness on all chunks
		const { data: allChunks } = await sb
			.from("chunks")
			.select("id,page_number,section,chunk_type,content,embedding")
			.eq("doc_id", docId);
		for (const c of allChunks ?? []) {
			expect(c.page_number).toBeGreaterThan(0);
			expect(c.chunk_type).toBeTruthy();
			expect(c.content).toBeTruthy();
			expect(c.embedding).not.toBeNull();
		}

		// Verify document status advanced to 'analyzing'
		const { data: doc } = await sb
			.from("documents")
			.select("status")
			.eq("id", docId)
			.single();
		expect(doc?.status).toBe("analyzing");
	}, 60_000);
});
