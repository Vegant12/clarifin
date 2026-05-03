-- ============================================================
-- Clarifin v1 init migration (Phase 1)
-- ============================================================
-- Citation safety: chunks ships with source_page_start / source_page_end /
-- page_number from day one. Mandated by PITFALLS.md "Pitfall 4: Citation
-- Drift" — post-hoc retrofit hits only 58.9% F1 citation accuracy.
-- Do NOT remove these columns; do NOT make them nullable.
-- ============================================================

-- Extensions ---------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Enums --------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type document_status as enum (
      'uploaded', 'parsing', 'embedding', 'analyzing', 'ready', 'failed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'chunk_type_enum') then
    create type chunk_type_enum as enum ('prose', 'table', 'heading', 'list');
  end if;
end $$;

-- chat_sessions ------------------------------------------------
-- Anonymous browser-keyed sessions. session_token = crypto.randomUUID() in
-- the browser, stored in localStorage (D-06).
create table if not exists chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_token text unique not null,
  created_at    timestamptz not null default now(),
  last_active   timestamptz not null default now()
);
create index if not exists chat_sessions_session_token_idx
  on chat_sessions (session_token);

-- documents ----------------------------------------------------
-- One row per uploaded PDF. status enum drives Phase 2 polled UX.
create table if not exists documents (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references chat_sessions(id) on delete cascade,
  filename       text not null,
  storage_path   text not null,
  size_bytes     bigint not null,
  total_pages    integer,
  ticker         text,
  status         document_status not null default 'uploaded',
  error_message  text,
  failed_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists documents_session_id_idx on documents (session_id);
create index if not exists documents_status_idx on documents (status);

-- chunks -------------------------------------------------------
-- CITATION-SAFE FROM DAY ONE. PITFALLS Pitfall 3 + Pitfall 4 prevention.
-- page_number, source_page_start, source_page_end are NOT NULL by design.
create table if not exists chunks (
  id                uuid primary key default gen_random_uuid(),
  doc_id            uuid not null references documents(id) on delete cascade,
  page_number       integer not null,
  source_page_start integer not null,
  source_page_end   integer not null,
  section           text,
  chunk_type        chunk_type_enum not null,
  chunk_index       integer not null,
  content           text not null,
  embedding         vector(768),
  token_count       integer,
  created_at        timestamptz not null default now()
);
create index if not exists chunks_doc_id_idx on chunks (doc_id);
create index if not exists chunks_doc_page_idx on chunks (doc_id, page_number);
-- HNSW index on chunks.embedding is DEFERRED to Phase 4 (D-10).
-- Creating it on an empty table now would only require re-tuning later.

-- document_analysis --------------------------------------------
-- Cache for explanation (Phase 6) + score (Phase 8). One row per document.
create table if not exists document_analysis (
  id              uuid primary key default gen_random_uuid(),
  doc_id          uuid not null references documents(id) on delete cascade,
  explanation     text,
  explanation_at  timestamptz,
  score           integer check (score between 1 and 10),
  score_reasoning text,
  score_breakdown jsonb,
  score_at        timestamptz,
  created_at      timestamptz not null default now(),
  unique (doc_id)
);
create index if not exists document_analysis_doc_id_idx on document_analysis (doc_id);

-- chat_messages ------------------------------------------------
-- Q&A history per session. citations is JSONB for forward-compat (Phase 10).
create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  doc_id      uuid references documents(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  citations   jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_session_id_idx
  on chat_messages (session_id);
create index if not exists chat_messages_doc_id_idx on chat_messages (doc_id);

-- updated_at trigger for documents -----------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists documents_set_updated_at on documents;
create trigger documents_set_updated_at
  before update on documents
  for each row execute function set_updated_at();
