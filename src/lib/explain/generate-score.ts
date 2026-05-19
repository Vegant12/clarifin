import "server-only";

import { createPartFromUri, GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";
import { isIndonesianDoc, uploadFresh, waitForFileReady } from "@/lib/explain/generate-explanation";
import {
  SCORE_RESPONSE_SCHEMA,
  scoreSchema,
  type ScoreResult,
} from "@/lib/explain/score-schema";
import {
  SCORE_MODEL_ID,
  buildScorePrompt,
  scanForInvestmentAdvice,
} from "@/lib/explain/score-prompts";

export interface GenerateScoreParams {
  docId: string;
  pdfBytes: Uint8Array | null;
  filename: string;
  totalPages: number;
  extractionSource: string | null;
  fileResourceName: string | null;
  firstPageText: string;
}

export interface GenerateScoreResult {
  result: ScoreResult;
  fileResourceName: string;
}

export async function generateScore(params: GenerateScoreParams): Promise<GenerateScoreResult> {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  let resourceName: string;
  let uri: string;
  let mimeType: string;

  // 1. Resolve Files API resource — try cached, fall back to re-upload (mirrors generate-explanation.ts lines 143-167)
  try {
    if (params.fileResourceName) {
      const ready = await waitForFileReady(ai, params.fileResourceName);
      resourceName = params.fileResourceName;
      uri = ready.uri;
      mimeType = ready.mimeType;
    } else {
      if (!params.pdfBytes) {
        throw new Error("generateScore: no fileResourceName and no pdfBytes.");
      }
      const fresh = await uploadFresh(ai, params.pdfBytes, params.filename);
      resourceName = fresh.resourceName;
      uri = fresh.uri;
      mimeType = fresh.mimeType;
    }
  } catch (err) {
    // FAILED / expired path — re-upload if bytes available
    if (!params.pdfBytes) throw err;
    const fresh = await uploadFresh(ai, params.pdfBytes, params.filename);
    resourceName = fresh.resourceName;
    uri = fresh.uri;
    mimeType = fresh.mimeType;
  }

  // 2. Build prompt
  const isIndonesian = isIndonesianDoc(params.extractionSource, params.firstPageText);
  const prompt = buildScorePrompt(params.totalPages, isIndonesian);

  // 3. Stream + accumulate — never JSON.parse per chunk
  const stream = await ai.models.generateContentStream({
    model: SCORE_MODEL_ID,
    contents: [createPartFromUri(uri, mimeType), { text: prompt }],
    config: {
      responseMimeType: "application/json",
      responseSchema: SCORE_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let accumulated = "";
  for await (const chunk of stream) {
    accumulated += (chunk as { text?: string }).text ?? "";
  }

  if (!accumulated) {
    throw new Error("Empty Gemini score response.");
  }

  // 4. Strip markdown fences + JSON.parse + Zod validate
  const stripped = accumulated
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(stripped) as unknown;
  const result = scoreSchema.parse(parsed); // ZodError on invalid shape

  // 5. Compliance guardrail — pre-persist scan (D-05 prompt rule defense in depth)
  for (const dim of result.dimensions) {
    const reasoningViolation = scanForInvestmentAdvice(dim.reasoning);
    if (reasoningViolation) {
      throw new Error(`Compliance violation: blocked term "${reasoningViolation}" in ${dim.name} reasoning.`);
    }
    for (const snip of dim.snippets) {
      const snipViolation = scanForInvestmentAdvice(snip.text);
      if (snipViolation) {
        throw new Error(`Compliance violation: blocked term "${snipViolation}" in ${dim.name} snippet.`);
      }
    }
  }

  return { result, fileResourceName: resourceName };
}
