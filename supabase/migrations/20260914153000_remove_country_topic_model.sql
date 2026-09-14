-- Permanently remove the retired country-topic content model.
-- Public country content has exactly two document types:
--   country-guide     -> /:country/guides/:slug
--   country-best-for  -> /:country/:slug
-- country-topic is not a valid content type and must never be recreated.

-- Remove any remaining legacy rows. They have already been made non-public by
-- the previous retirement migration and any real commercial pages were seeded
-- as country-best-for documents there.
delete from public.content_documents
where content_type = 'country-topic'
   or content_key like 'country-topic:%';

-- Enforce the retirement at the database boundary so legacy code cannot
-- accidentally recreate country-topic documents.
alter table public.content_documents
  drop constraint if exists content_documents_not_country_topic;

alter table public.content_documents
  add constraint content_documents_not_country_topic
  check (content_type <> 'country-topic');

-- Remove the retired sync trigger/function again defensively. This migration
-- is intentionally idempotent for environments where the earlier migration
-- has already been applied.
drop trigger if exists sync_legacy_country_best_for_to_topic_content on public.country_best_for;
drop function if exists public.sync_legacy_country_best_for_to_canonical_topic_content();
