import "server-only";

import { GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
import { IDX_TICKER_BLOCKLIST } from "./detect-ticker";

const TICKER_MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT = `You are extracting the IDX stock ticker code from an Indonesian financial document.
The IDX ticker is always exactly 4 uppercase letters (e.g. BBCA, TLKM, GOTO, ASII, BBRI).
Return ONLY the 4-letter ticker code. If you cannot find an IDX ticker, return the word null.
Do not include ".JK", punctuation, explanation, or any other text.`;

/**
 * AI-powered IDX ticker extraction from page text.
 * Uses Gemini for documents where the regex in detect-ticker.ts returns null.
 * Soft-fail: any exception or invalid response → null.
 */
export async function detectTickerWithAI(pageTexts: string[]): Promise<string | null> {
  try {
    const sample = pageTexts
      .slice(0, 5)
      .filter((t) => typeof t === "string" && t.length > 0)
      .join("\n\n---\n\n")
      .slice(0, 6000);

    if (!sample.trim()) return null;

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: TICKER_MODEL,
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 16, temperature: 0 },
      contents: [
        {
          role: "user",
          parts: [{ text: `Extract the IDX stock ticker from this document text:\n\n${sample}` }],
        },
      ],
    });

    const raw = response.text?.trim() ?? "";
    if (!raw || raw.toLowerCase() === "null") return null;

    // Accept only 4 uppercase letters not in the blocklist.
    const candidate = raw.toUpperCase().replace(/[^A-Z]/g, "");
    if (candidate.length !== 4 || IDX_TICKER_BLOCKLIST.has(candidate)) return null;

    return candidate;
  } catch (err) {
    console.error("[detectTickerWithAI] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
