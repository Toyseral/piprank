-- Phase 12 broker CMS uses the Phase 11 content_documents table.
-- Add indexes that make broker-document lookups fast and predictable.
create index if not exists content_documents_broker_idx
  on public.content_documents(content_type, slug, published);

create index if not exists content_documents_broker_key_idx
  on public.content_documents(content_key);
