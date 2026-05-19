import { z } from "zod";

// -----------------------------------------------------------------------
// Zod schema — TypeScript type inference and runtime validation
// -----------------------------------------------------------------------

const snippetSchema = z.object({
  text: z.string().min(1), // verbatim quoted text from the document
  page: z.number().int().positive(), // 1-based page number
});

const dimensionSchema = z.object({
  name: z.string().min(1), // e.g. "Profitability"
  score: z.number().int().min(1).max(10),
  reasoning: z.string().min(1), // one sentence, neutral language, no buy/sell
  snippets: z.array(snippetSchema).min(1).max(3),
});

export const scoreSchema = z.object({
  overall_score: z.number().int().min(1).max(10),
  dimensions: z.array(dimensionSchema).length(4),
});

export type ScoreResult = z.infer<typeof scoreSchema>;
// ScoreResult shape:
// {
//   overall_score: number;
//   dimensions: Array<{
//     name: string;
//     score: number;
//     reasoning: string;
//     snippets: Array<{ text: string; page: number }>;
//   }>;
// }

// -----------------------------------------------------------------------
// Raw JSON Schema — passed directly to @google/genai responseSchema config
// Field ordering mirrors scoreSchema above. Both must be updated together.
// -----------------------------------------------------------------------

export const SCORE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overall_score: {
      type: "integer",
      minimum: 1,
      maximum: 10,
      description: "Overall assessment score from 1 (very poor) to 10 (excellent).",
    },
    dimensions: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "One of: Profitability, Balance Sheet, Growth Trend, Valuation Context.",
          },
          score: {
            type: "integer",
            minimum: 1,
            maximum: 10,
          },
          reasoning: {
            type: "string",
            description:
              "One sentence of neutral analytical reasoning. Must not contain buy, sell, or investment recommendations.",
          },
          snippets: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  description: "Verbatim quoted text from the document.",
                },
                page: {
                  type: "integer",
                  minimum: 1,
                  description: "1-based page number where this text appears.",
                },
              },
              required: ["text", "page"],
            },
          },
        },
        required: ["name", "score", "reasoning", "snippets"],
      },
    },
  },
  required: ["overall_score", "dimensions"],
} as const;
