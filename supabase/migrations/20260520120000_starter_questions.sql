-- Phase 10: CHAT-05 — cache generated starter questions per document.
-- Generated once at chat session start (Plan 03); read by Plan 05 RSC.

ALTER TABLE public.document_analysis
  ADD COLUMN IF NOT EXISTS starter_questions jsonb;

COMMENT ON COLUMN public.document_analysis.starter_questions IS
  'Phase 10 CHAT-05: array of 5 starter chat questions (string[]) generated from the explanation summary. Schema enforced at app layer via StarterQuestionsSchema (Zod).';
