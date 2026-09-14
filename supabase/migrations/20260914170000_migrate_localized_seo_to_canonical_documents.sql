-- Migrate legacy localized_seo_pages into the canonical content_documents model.
-- Commercial localized pages become localized-best-for documents.
-- Existing publication/indexability state is preserved; malformed/legacy rows remain
-- unpublished until reviewed by the canonical CMS.

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
  settings,
  published,
  indexable
)
select
  'localized-best-for:' || c.slug || ':' || lower(coalesce(cl.locale, cl.code, '')) || ':' || l.slug,
  'localized-best-for',
  c.slug,
  l.topic_key,
  l.slug,
  coalesce(l.title, l.h1, l.slug),
  coalesce(l.meta_description, ''),
  case
    when coalesce(l.content, '') = '' then ''
    else '<p>' || replace(replace(replace(l.content, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>'
  end,
  '[]'::jsonb,
  jsonb_build_object(
    'locale', coalesce(cl.locale, cl.code, ''),
    'languageCode', coalesce(cl.code, ''),
    'languageId', l.language_id,
    'topicKey', l.topic_key,
    'legacySourceId', l.id,
    'workflowStatus', coalesce(l.workflow_status, 'draft'),
    'faqs', coalesce(l.faqs, '[]'::jsonb),
    'legacyContentDocumentId', l.content_document_id
  ),
  coalesce(l.published, false),
  coalesce(l.indexable, false)
from public.localized_seo_pages l
join public.countries c on c.id = l.country_id
join public.country_languages cl on cl.id = l.language_id
where coalesce(cl.locale, cl.code, '') <> ''
on conflict (content_key) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  html = case when public.content_documents.html is null or public.content_documents.html = '' then excluded.html else public.content_documents.html end,
  settings = public.content_documents.settings || excluded.settings,
  published = excluded.published,
  indexable = excluded.indexable,
  updated_at = now();

-- If a legacy row already pointed at a Content Studio document, keep that rich
-- content instead of replacing it with the legacy text payload.
update public.content_documents d
set
  blocks = source.blocks,
  html = source.html,
  title = coalesce(nullif(source.title, ''), d.title),
  excerpt = coalesce(nullif(source.excerpt, ''), d.excerpt),
  published = source.published,
  indexable = source.indexable,
  updated_at = now()
from public.localized_seo_pages l
join public.countries c on c.id = l.country_id
join public.country_languages cl on cl.id = l.language_id
join public.content_documents source on source.id = l.content_document_id
where d.content_key = 'localized-best-for:' || c.slug || ':' || lower(coalesce(cl.locale, cl.code, '')) || ':' || l.slug;

-- Normalize any canonical localized-guide keys that predate locale-aware ownership.
update public.content_documents d
set content_key = 'localized-guide:' || d.country_slug || ':' || lower(coalesce(d.settings->>'locale', d.settings->>'languageCode', '')) || ':' || d.slug,
    updated_at = now()
where d.content_type = 'localized-guide'
  and d.country_slug is not null
  and d.slug is not null
  and coalesce(d.settings->>'locale', d.settings->>'languageCode', '') <> ''
  and d.content_key <> 'localized-guide:' || d.country_slug || ':' || lower(coalesce(d.settings->>'locale', d.settings->>'languageCode', '')) || ':' || d.slug;
