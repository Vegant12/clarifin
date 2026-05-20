-- Phase 9: stock data 24h cache columns on documents (STOCK-05)
-- D-07 (CONTEXT.md): cache stock quote + historical income data per document.
-- New columns are nullable (NULL until first successful fetch); safe to add to
-- existing rows. JSONB chosen for stock_data so Supabase JS client accepts the
-- StockData object without manual JSON.stringify (mirrors document_analysis.explanation).
-- IF NOT EXISTS guards make the migration idempotent.

alter table public.documents
  add column if not exists stock_data jsonb null,
  add column if not exists stock_fetched_at timestamptz null;
