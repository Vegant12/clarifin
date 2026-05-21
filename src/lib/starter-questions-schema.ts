/**
 * Phase 10 CHAT-05 starter questions structured-output schema.
 * Pattern: mirrors src/lib/explain/score-schema.ts (Zod schema + inferred type).
 * Consumed by:
 *   - generateObject({ schema: StarterQuestionsSchema, ... }) in /api/starter-questions/route.ts (Plan 03)
 *   - StarterQuestions React component prop typing (Plan 04)
 *   - document_analysis.starter_questions jsonb column round-trip parse (Plan 05 RSC)
 *
 * No server-only import — pure schema, importable in Vitest tests and in client components.
 */

import { z } from "zod";

export const StarterQuestionsSchema = z.object({
  questions: z.array(z.string().min(1).max(120)).length(5),
});

export type StarterQuestions = z.infer<typeof StarterQuestionsSchema>;
