-- PipRank Phase 17 — Canonical content ownership migration
--
-- Country Best-For pages are canonical and migrate into content_documents
-- using content_type='country-best-for'. Only country-topic and the old
-- localized-seo-page ownership remain legacy here.

-- 1. Legacy page ownership that must be migrated/removed.
select content_type, count(*) as row_count
from public.content_documents
where content_type in ('country-topic', 'localized-seo-page')
group by content_type
order by content_type;

-- 2. Duplicate content keys. These must be zero before the unique index is
-- enforced on content_documents.content_key.
select content_key, count(*) as row_count
from public.content_documents
group by content_key
having count(*) > 1
order by row_count desc, content_key;

-- 3. Published/indexable legacy documents are especially important because
-- they can still compete with canonical URLs in search engines.
select id, content_key, content_type, country_slug, topic_slug, slug,
       published, indexable, updated_at
from public.content_documents
where content_type in ('country-topic', 'localized-seo-page')
  and published = true
  and indexable = true
order by updated_at desc;

-- 4. Canonical document inventory.
select content_type, count(*) as row_count
from public.content_documents
where content_type in (
  'country',
  'country-guide',
  'country-best-for',
  'global-best-for',
  'guide',
  'broker',
  'compare'
)
group by content_type
order by content_type;

-- 5. Country Best-For migration source inventory.
select count(*) as legacy_country_best_for_rows
from public.country_best_for;

-- The old country_best_for table is a migration source only. New canonical
-- pages must be written to content_documents with keys:
--   country-best-for:{country_slug}:{slug}
--
-- Do not drop the legacy table until all required rows have been migrated and
-- the canonical routes resolve through CanonicalHub.
