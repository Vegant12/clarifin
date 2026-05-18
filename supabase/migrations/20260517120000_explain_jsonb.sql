-- Phase 6: explanation column text -> jsonb (EXPLAIN-04 storage shape)
-- D-06 (CONTEXT.md): structured JSON (5 sections) requires jsonb so Supabase JS
-- client accepts plain JS objects without manual JSON.stringify (Pitfall 6).
-- Safe: document_analysis.explanation is NULL for all existing rows
-- (no document_analysis row currently has an explanation written).
-- The USING clause handles the type conversion; NULL casts to NULL in jsonb.

alter table public.document_analysis
  alter column explanation type jsonb using explanation::jsonb;
