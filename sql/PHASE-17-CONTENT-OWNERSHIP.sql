-- PipRank Phase 17 — Canonical content ownership migration
--
-- This migration is intentionally non-destructive. Run the diagnostic queries
-- first and resolve their results before adding/enforcing final constraints.

-- 1. Legacy page ownership that must be migrated before removal.
select content_type, count(*) as row_count
from public.content_documents
where content_type in ('country-topic', 'country-best-for', 'localized-seo-page')
group by content_type
order by content_type;

-- 2. Duplicate content keys. These must be zero before a unique index is
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
where content_type in ('country-topic', 'country-best-for', 'localized-seo-page')
  and published = true
  and indexable = true
order by updated_at desc;

-- 4. Canonical document inventory.
select content_type, count(*) as row_count
from public.content_documents
where content_type in (
  'country',
  'country-guide',
  'global-best-for',
  'guide',
  'broker',
  'compare'
)
group by content_type
order by content_type;

-- DO NOT add the final CHECK constraint or unique index until the migration
-- report is clean and all required legacy pages have been redirected/migrated.
-- The existing Phase 16 unique-index migration can be applied after duplicate
-- content keys have been resolved.
