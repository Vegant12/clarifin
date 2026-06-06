-- ============================================================
-- Phase 13 T1: ohlcv_cache + ticker_metadata (TA-INGEST-01, TA-DATA-01, TA-TICKER-01)
-- D-06: 5yr backfill writes here; T2/T3 both read these tables.
-- UNIQUE(ticker, date) on ohlcv_cache is NON-NEGOTIABLE — concurrent cron
-- runs create duplicate rows without it (PITFALLS.md P2 — T1-OWNED).
-- Extensions (pgcrypto, pg_trgm) — enable defensively; init.sql may already have them.
-- ============================================================

create extension if not exists pg_trgm;

create table if not exists public.ohlcv_cache (
  id          uuid primary key default gen_random_uuid(),
  ticker      text not null,
  date        date not null,
  open        numeric(18, 4) not null,
  high        numeric(18, 4) not null,
  low         numeric(18, 4) not null,
  close       numeric(18, 4) not null,
  adj_close   numeric(18, 4) not null,
  volume      bigint not null,
  fetched_at  timestamptz not null default now(),
  constraint ohlcv_cache_ticker_date_unique unique (ticker, date)
);

create index if not exists idx_ohlcv_ticker_date_desc
  on public.ohlcv_cache (ticker, date desc);

create table if not exists public.ticker_metadata (
  id           uuid primary key default gen_random_uuid(),
  ticker       text not null unique,
  name_en      text not null,
  name_id      text,
  sector       text,
  market_cap   bigint,
  first_trade_date date,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ticker_metadata_ticker
  on public.ticker_metadata (ticker);
create index if not exists idx_ticker_metadata_name_en_trgm
  on public.ticker_metadata using gin (name_en gin_trgm_ops);

-- RLS: service_role only (no anon access). Reads happen via supabaseAdmin server-side.
alter table public.ohlcv_cache enable row level security;
alter table public.ticker_metadata enable row level security;
