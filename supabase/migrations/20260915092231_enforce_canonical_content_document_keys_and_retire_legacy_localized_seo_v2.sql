-- Enforce canonical content-document identity.
-- The legacy Ghana hub duplicate is removed first because the canonical key
-- already belongs to the newer document.

begin;

delete from public.content_documents
where id = 19
  and content_type = 'country-best-for'
  and country_slug = 'ghana'
  and slug = 'best-forex-brokers'
  and content_key = 'best-for:ghana:best-forex-brokers';

-- Preserve legacy localized SEO content by migrating it into the canonical
-- localized-best-for model before retiring the legacy document type.
insert into public.content_documents (
  content_key, content_type, country_slug, topic_slug, slug, title, excerpt,
  html, blocks, settings, published, indexable
)
select
  'localized-best-for:' || c.slug || ':' || lower(coalesce(cl.locale, cl.code, '')) || ':' || l.slug,
  'localized-best-for', c.slug, l.topic_key, l.slug,
  coalesce(l.title, l.h1, l.slug), coalesce(l.meta_description, ''),
  case when coalesce(l.content, '') = '' then ''
       else '<p>' || replace(replace(replace(l.content, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>' end,
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
  coalesce(l.published, false), coalesce(l.indexable, false)
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

update public.content_documents d
set blocks = source.blocks,
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

-- Canonical identity is derived from the document's actual slug, never the
-- legacy intent slug.
update public.content_documents
set content_key = 'best-for:' || slug, updated_at = now()
where content_type = 'global-best-for'
  and country_slug is null and slug is not null
  and content_key <> 'best-for:' || slug;

update public.content_documents
set content_key = 'country-best-for:' || country_slug || ':' || slug, updated_at = now()
where content_type = 'country-best-for'
  and country_slug is not null and slug is not null
  and content_key <> 'country-best-for:' || country_slug || ':' || slug;

update public.content_documents
set content_key = 'country-guide:' || country_slug || ':' || slug, updated_at = now()
where content_type = 'country-guide'
  and country_slug is not null and slug is not null
  and content_key <> 'country-guide:' || country_slug || ':' || slug;

update public.content_documents
set content_key = 'localized-guide:' || country_slug || ':' || lower(coalesce(settings->>'locale', settings->>'languageCode', '')) || ':' || slug,
    updated_at = now()
where content_type = 'localized-guide'
  and country_slug is not null and slug is not null
  and lower(coalesce(settings->>'locale', settings->>'languageCode', '')) <> ''
  and content_key <> 'localized-guide:' || country_slug || ':' || lower(coalesce(settings->>'locale', settings->>'languageCode', '')) || ':' || slug;

-- Legacy localized-seo documents are no longer content owners.
delete from public.content_documents
where content_type = 'localized-seo'
   or content_key like 'localized:%';

commit;
