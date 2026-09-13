-- Migrate legacy country_best_for editorial rows into the canonical content_documents store.
-- Run in Supabase after reviewing the diagnostic output from PHASE-17-CONTENT-OWNERSHIP.sql.
-- This is intentionally idempotent: rerunning updates the canonical document.

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
  updated_at
)
select
  'country-best-for:' || c.slug || ':' || cbf.slug as content_key,
  'country-best-for' as content_type,
  c.slug as country_slug,
  null as topic_slug,
  cbf.slug as slug,
  coalesce(nullif(cbf.title, ''), cbf.h1, cbf.label, cbf.slug) as title,
  coalesce(
    nullif(cbf.introduction, ''),
    nullif(cbf.meta_description, ''),
    ''
  ) as excerpt,
  coalesce(nullif(cbf.content, ''), '') as html,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'migrated-' || cbf.id,
      'type', 'richtext',
      'title', coalesce(nullif(cbf.h1, ''), nullif(cbf.title, ''), cbf.label, cbf.slug),
      'html', coalesce(nullif(cbf.content, ''), nullif(cbf.introduction, ''), '')
    )
  ) as blocks,
  coalesce(nullif(cbf.meta_title, ''), nullif(cbf.title, ''), cbf.label) as seo_title,
  coalesce(nullif(cbf.meta_description, ''), nullif(cbf.introduction, ''), '') as seo_description,
  coalesce(cbf.indexable, true) as indexable,
  coalesce(cbf.published, false) as published,
  now() as updated_at
from public.country_best_for cbf
join public.countries c on c.id = cbf.country_id
where cbf.slug is not null
on conflict (content_key) do update set
  content_type = excluded.content_type,
  country_slug = excluded.country_slug,
  topic_slug = excluded.topic_slug,
  slug = excluded.slug,
  title = excluded.title,
  excerpt = excluded.excerpt,
  html = excluded.html,
  blocks = excluded.blocks,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  indexable = excluded.indexable,
  published = excluded.published,
  updated_at = now();

-- Verification: every migrated row must have the canonical type and key.
select
  country_slug,
  slug,
  content_key,
  published,
  indexable
from public.content_documents
where content_type = 'country-best-for'
order by country_slug, slug;

-- IMPORTANT:
-- Do not drop public.country_best_for yet. It remains a migration source until:
-- 1) all required rows are verified in content_documents;
-- 2) Admin creates/edits country Best-For pages through ContentDocumentEditor;
-- 3) sitemap/prerender no longer read country_best_for for URL ownership;
-- 4) legacy country Best-For URLs redirect to the canonical /{country}/{slug} URL.
