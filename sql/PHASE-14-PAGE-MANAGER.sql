alter table public.content_documents add column if not exists settings jsonb not null default '{}'::jsonb;
create index if not exists content_documents_settings_gin_idx on public.content_documents using gin(settings);
