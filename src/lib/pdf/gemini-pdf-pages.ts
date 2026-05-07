import "server-only";

import { createPartFromUri, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
import { clonePdfBytes } from "@/lib/pdf/clone-pdf-bytes";

export type GeminiPageText = { page: number; text: string };

function parsePagesJson(raw: string): { pages: GeminiPageText[] } {
  const trimmed = raw.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(unfenced) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("pages" in parsed) ||
    !Array.isArray((parsed as { pages: unknown }).pages)
  ) {
    throw new Error("Gemini response missing pages array.");
  }
  const pages = (parsed as { pages: GeminiPageText[] }).pages;
  for (const p of pages) {
    if (typeof p.page !== "number" || typeof p.text !== "string") {
      throw new Error("Invalid page entry from Gemini.");
    }
  }
  return { pages };
}

async function waitForFileReady(
  ai: GoogleGenAI,
  name: string,
): Promise<{ uri: string; mimeType: string }> {
  let file = await ai.files.get({ name });
  while (file.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 1500));
    file = await ai.files.get({ name });
  }
  if (file.state === "FAILED") {
    throw new Error("Gemini file processing failed.");
  }
  if (!file.uri) {
    throw new Error("Gemini file has no URI.");
  }
  return { uri: file.uri, mimeType: file.mimeType ?? "application/pdf" };
}

export async function extractPagesWithGemini(params: {
  pdfBytes: Uint8Array;
  filename: string;
  pageStart: number;
  pageEnd: number;
  fileResourceName?: string | null;
}): Promise<{ pages: GeminiPageText[]; fileResourceName: string }> {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  let resourceName: string;
  let uri: string;
  let mimeType: string;

  if (params.fileResourceName) {
    resourceName = params.fileResourceName;
    const ready = await waitForFileReady(ai, resourceName);
    uri = ready.uri;
    mimeType = ready.mimeType;
  } else {
    const bytes = clonePdfBytes(params.pdfBytes);
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const blob = new Blob([ab], { type: "application/pdf" });
    const uploaded = await ai.files.upload({
      file: blob,
      config: {
        mimeType: "application/pdf",
        displayName: params.filename,
      },
    });
    if (!uploaded.name) {
      throw new Error("Gemini file upload returned no name.");
    }
    resourceName = uploaded.name;
    const ready = await waitForFileReady(ai, resourceName);
    uri = ready.uri;
    mimeType = ready.mimeType;
  }

  const instruction = `Extract text from the attached PDF. Reply with ONLY valid JSON (no markdown fences) of this shape:
{"pages":[{"page":number,"text":string},...]}
Include one entry for every page from ${params.pageStart} through ${params.pageEnd} inclusive, in ascending page order. Use plain UTF-8 text; use "" for blank pages.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [createPartFromUri(uri, mimeType), { text: instruction }],
  });

  const body = response.text;
  if (!body) {
    throw new Error("Empty Gemini response.");
  }
  const { pages } = parsePagesJson(body);
  for (const p of pages) {
    if (p.page < params.pageStart || p.page > params.pageEnd) {
      throw new Error(`Gemini returned out-of-range page ${p.page}.`);
    }
  }
  return { pages, fileResourceName: resourceName };
}

export async function deleteGeminiFileResource(resourceName: string): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  await ai.files.delete({ name: resourceName });
}
