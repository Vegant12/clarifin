export type ExtractionSource = "unpdf" | "gemini_files";

function printableLen(s: string): number {
  return s.replace(/\s+/g, "").length;
}

/**
 * Classify PDF extraction path from the first up-to-five page text samples.
 * Roadmap: ≥3 weak pages (&lt;50 printable chars) ⇒ scanned / image-heavy ⇒ Gemini Files OCR.
 */
export function classifyExtractionSource(samplePageTexts: string[]): ExtractionSource {
  const n = Math.min(5, samplePageTexts.length);
  if (n === 0) {
    return "gemini_files";
  }
  let weak = 0;
  for (let i = 0; i < n; i++) {
    if (printableLen(samplePageTexts[i] ?? "") < 50) {
      weak++;
    }
  }
  return weak >= 3 ? "gemini_files" : "unpdf";
}
