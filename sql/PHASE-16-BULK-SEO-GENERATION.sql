-- PipRank Phase 16 safety migration
-- Run after checking for duplicate content_key values.
create unique index if not exists content_documents_content_key_uidx
  on public.content_documents (content_key);
