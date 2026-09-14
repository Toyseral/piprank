-- Retire the legacy country-topic content model.
-- Country guides own /:country/guides/:slug.
-- Country commercial pages own /:country/:slug through country-best-for documents.

drop trigger if exists sync_legacy_country_best_for_to_topic_content on public.country_best_for;
drop function if exists public.sync_legacy_country_best_for_to_canonical_topic_content();

-- country-topic documents are no longer public content. Keep them for audit/history,
-- but make them permanently non-public so old migrations cannot create indexable URLs.
update public.content_documents
set published = false,
    indexable = false,
    updated_at = now()
where content_type = 'country-topic';

-- Seed canonical country-best-for documents from the legacy table without making
-- unpublished legacy pages live. Existing canonical documents win on conflict.
insert into public.content_documents (
  content_key,
  content_type,
  country_slug,
  topic_slug,
  slug,
  title,
  excerpt,
  html,
  blocks,
  seo_title,
  seo_description,
  indexable,
  published,
  settings,
  created_at,
  updated_at
)
select
  'country-best-for:' || c.slug || ':' || cbf.slug,
  'country-best-for',
  c.slug,
  null,
  cbf.slug,
  cbf.title,
  coalesce(cbf.intro->>0, ''),
  '',
  coalesce(cbf.blocks, '[]'::jsonb),
  cbf.meta_title,
  cbf.meta_description,
  coalesce(cbf.indexable, false),
  coalesce(cbf.published, false),
  jsonb_build_object(
    'label', coalesce(cbf.label, cbf.title),
    'intro', coalesce(cbf.intro, '[]'::jsonb),
    'criteria', coalesce(cbf.criteria, '[]'::jsonb),
    'sections', coalesce(cbf.sections, '[]'::jsonb),
    'faqs', coalesce(cbf.faqs, '[]'::jsonb),
    'legacyCountryBestForId', cbf.id
  ),
  coalesce(cbf.created_at, now()),
  now()
from public.country_best_for cbf
join public.countries c on c.id = cbf.country_id
where not exists (
  select 1
  from public.content_documents d
  where d.content_key = 'country-best-for:' || c.slug || ':' || cbf.slug
);
