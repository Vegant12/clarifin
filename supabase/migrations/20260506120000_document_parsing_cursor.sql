-- Phase 3: resumable parsing cursor and extraction routing (INGEST-03)
-- parse_next_page: 1-based next page to process in batch runs
-- extraction_source: unpdf vs gemini_files OCR path
-- gemini_file_resource_name: Files API resource name for TTL cleanup

alter table public.documents
  add column if not exists parse_next_page integer not null default 1;

alter table public.documents
  add column if not exists extraction_source text;

alter table public.documents
  add column if not exists gemini_file_resource_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_extraction_source_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_extraction_source_check
      check (
        extraction_source is null
        or extraction_source in ('unpdf', 'gemini_files')
      );
  end if;
end $$;
