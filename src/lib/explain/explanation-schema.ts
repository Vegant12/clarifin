import { z } from "zod";

/**
 * Five-section explanation Zod schema (EXPLAIN-01).
 * Mirrors the raw JSON Schema below — both must stay in sync.
 */
export const explanationSchema = z.object({
  revenue: z.string().min(1),
  profitability: z.string().min(1),
  balance_sheet: z.string().min(1),
  cash_flow: z.string().min(1),
  key_risks: z.string().min(1),
});

export type ExplanationResult = z.infer<typeof explanationSchema>;

/**
 * Raw JSON Schema for Gemini `responseSchema` config.
 * Gemini's `@google/genai` SDK accepts plain JSON Schema, not Zod.
 * Keep field ordering identical to `explanationSchema`.
 */
export const EXPLANATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    revenue: { type: "string" },
    profitability: { type: "string" },
    balance_sheet: { type: "string" },
    cash_flow: { type: "string" },
    key_risks: { type: "string" },
  },
  required: ["revenue", "profitability", "balance_sheet", "cash_flow", "key_risks"],
} as const;
