/**
 * Raw Node smoke test for unpdf (not bundled by Vitest — avoids pdf.js worker clone issues).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractText, extractTextItems, getDocumentProxy } from "unpdf";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(dir, "__fixtures__", "one-page.pdf");
const buf = readFileSync(fixture);
const pdfBytes = new Uint8Array(buf.byteLength);
pdfBytes.set(buf);

const pdf = await getDocumentProxy(pdfBytes);
const textResult = await extractText(pdf, { mergePages: false });
const itemsResult = await extractTextItems(pdf);

assert.ok(textResult.totalPages > 0);
assert.equal(textResult.text.length, textResult.totalPages);
assert.equal(itemsResult.totalPages, textResult.totalPages);
assert.equal(itemsResult.items.length, itemsResult.totalPages);

console.log("unpdf-smoke: OK", { pages: textResult.totalPages });
