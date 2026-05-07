import "server-only";

import type { StructuredTextItem } from "unpdf";
import { extractText, extractTextItems, getDocumentProxy } from "unpdf";

/**
 * Per-page plain text (one string per PDF page, index 0 = page 1).
 */
export async function extractPdfTextPerPage(pdfBytes: Uint8Array): Promise<{
  totalPages: number;
  texts: string[];
}> {
  const pdf = await getDocumentProxy(pdfBytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return { totalPages, texts: text };
}

/**
 * Per-page structured text items (PDF.js-style positions).
 */
export async function extractPdfTextItemsPerPage(pdfBytes: Uint8Array): Promise<{
  totalPages: number;
  items: StructuredTextItem[][];
}> {
  const pdf = await getDocumentProxy(pdfBytes);
  const { totalPages, items } = await extractTextItems(pdf);
  return { totalPages, items };
}
