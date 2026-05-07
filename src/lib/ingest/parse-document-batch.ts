import "server-only";

import { supabaseAdmin } from "@/db/client";
import { chunkSinglePage } from "@/lib/pdf/chunk-page";
import { classifyExtractionSource } from "@/lib/pdf/classify-extraction-source";
import { deleteGeminiFileResource, extractPagesWithGemini } from "@/lib/pdf/gemini-pdf-pages";
import { extractPdfTextItemsPerPage, extractPdfTextPerPage } from "@/lib/pdf/unpdf-extract";

/** Gemini / OCR path uses page-level text only → usually one prose chunk per page; table-atomic heuristics apply to unpdf + text items. */
export const MAX_PAGES_PER_BATCH = 8;
export const MAX_BATCH_WALL_MS = 45_000;

async function failDocument(docId: string, message: string): Promise<void> {
  await supabaseAdmin.from("chunks").delete().eq("doc_id", docId);
  await supabaseAdmin
    .from("documents")
    .update({
      status: "failed",
      error_message: message,
      failed_at: new Date().toISOString(),
    })
    .eq("id", docId);
}

export async function runParseBatch({ docId }: { docId: string }): Promise<{ done: boolean }> {
  const deadline = Date.now() + MAX_BATCH_WALL_MS;

  const docRes = await supabaseAdmin
    .from("documents")
    .select(
      "id, storage_path, status, extraction_source, gemini_file_resource_name, parse_next_page, total_pages, filename",
    )
    .eq("id", docId)
    .maybeSingle();

  if (docRes.error || !docRes.data) {
    return { done: false };
  }

  const doc = docRes.data;
  if (doc.status !== "parsing") {
    return { done: true };
  }

  const download = await supabaseAdmin.storage.from("pdfs").download(doc.storage_path);
  if (download.error || !download.data) {
    await failDocument(docId, "Could not download the PDF. Try uploading again.");
    return { done: false };
  }

  const pdfBytes = new Uint8Array(await download.data.arrayBuffer());

  let extractionSource = doc.extraction_source;
  let totalPages = doc.total_pages ?? 0;
  let geminiName = doc.gemini_file_resource_name;
  const parseStart = doc.parse_next_page;

  if (extractionSource == null) {
    const extracted = await extractPdfTextPerPage(pdfBytes);
    totalPages = extracted.totalPages;
    const sample = extracted.texts.slice(0, Math.min(5, extracted.texts.length));
    extractionSource = classifyExtractionSource(sample);
    const up = await supabaseAdmin
      .from("documents")
      .update({
        total_pages: totalPages,
        extraction_source: extractionSource,
      })
      .eq("id", docId);
    if (up.error) {
      await failDocument(docId, "Could not update document while parsing.");
      return { done: false };
    }
  }

  if (!totalPages) {
    await failDocument(docId, "This PDF has no readable pages.");
    return { done: false };
  }

  const maxIdxRes = await supabaseAdmin
    .from("chunks")
    .select("chunk_index")
    .eq("doc_id", docId)
    .order("chunk_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  let chunkIndex = (maxIdxRes.data?.chunk_index ?? -1) + 1;

  const windowEnd = Math.min(parseStart + MAX_PAGES_PER_BATCH - 1, totalPages);
  let lastInclusive = parseStart - 1;

  try {
    if (extractionSource === "unpdf") {
      const textsR = await extractPdfTextPerPage(pdfBytes);
      const itemsR = await extractPdfTextItemsPerPage(pdfBytes);

      for (let page = parseStart; page <= windowEnd; page++) {
        if (Date.now() > deadline) {
          break;
        }
        const plain = textsR.texts[page - 1] ?? "";
        const items = itemsR.items[page - 1] ?? [];
        const rows = chunkSinglePage({ pageNumber: page, plainText: plain, items });

        const del = await supabaseAdmin
          .from("chunks")
          .delete()
          .eq("doc_id", docId)
          .eq("page_number", page);
        if (del.error) {
          await failDocument(docId, "Could not update parsed text. Try again later.");
          return { done: false };
        }

        for (const row of rows) {
          const ins = await supabaseAdmin.from("chunks").insert({
            doc_id: docId,
            page_number: row.page_number,
            source_page_start: row.source_page_start,
            source_page_end: row.source_page_end,
            chunk_type: row.chunk_type,
            chunk_index: chunkIndex,
            content: row.content,
            token_count: Math.max(1, Math.ceil(row.content.length / 4)),
          });
          if (ins.error) {
            await failDocument(docId, "Could not save parsed text. Try again later.");
            return { done: false };
          }
          chunkIndex++;
        }
        lastInclusive = page;
      }
    } else {
      const pageStart = parseStart;
      const pageEnd = windowEnd;
      const gem = await extractPagesWithGemini({
        pdfBytes,
        filename: doc.filename || "document.pdf",
        pageStart,
        pageEnd,
        fileResourceName: geminiName,
      });
      geminiName = gem.fileResourceName;

      const metaUp = await supabaseAdmin
        .from("documents")
        .update({ gemini_file_resource_name: geminiName })
        .eq("id", docId);
      if (metaUp.error) {
        await failDocument(docId, "Could not update document while uploading to the OCR service.");
        return { done: false };
      }

      for (let pageNum = pageStart; pageNum <= pageEnd; pageNum++) {
        if (Date.now() > deadline) {
          break;
        }
        const found = gem.pages.find((x) => x.page === pageNum);
        const plain = found?.text ?? "";
        const rows = chunkSinglePage({ pageNumber: pageNum, plainText: plain, items: [] });

        const del = await supabaseAdmin
          .from("chunks")
          .delete()
          .eq("doc_id", docId)
          .eq("page_number", pageNum);
        if (del.error) {
          await failDocument(docId, "Could not update parsed text. Try again later.");
          return { done: false };
        }

        for (const row of rows) {
          const ins = await supabaseAdmin.from("chunks").insert({
            doc_id: docId,
            page_number: row.page_number,
            source_page_start: row.source_page_start,
            source_page_end: row.source_page_end,
            chunk_type: row.chunk_type,
            chunk_index: chunkIndex,
            content: row.content,
            token_count: Math.max(1, Math.ceil(row.content.length / 4)),
          });
          if (ins.error) {
            await failDocument(docId, "Could not save parsed text. Try again later.");
            return { done: false };
          }
          chunkIndex++;
        }
        lastInclusive = pageNum;
      }
    }
  } catch {
    await failDocument(docId, "Parsing failed. Try uploading again or use a different file.");
    return { done: false };
  }

  if (lastInclusive >= parseStart) {
    const nextPage = lastInclusive + 1;
    await supabaseAdmin.from("documents").update({ parse_next_page: nextPage }).eq("id", docId);

    if (nextPage > totalPages) {
      if (geminiName) {
        try {
          await deleteGeminiFileResource(geminiName);
        } catch {
          /* best-effort */
        }
      }
      await supabaseAdmin
        .from("documents")
        .update({ gemini_file_resource_name: null, status: "embedding" })
        .eq("id", docId);
      return { done: true };
    }
  }

  return { done: false };
}
