-- Localized pages are related to the same country/topic, but each language
-- can target a different search keyword and therefore needs independent SEO
-- targeting data.

ALTER TABLE public.localized_seo_pages
  ADD COLUMN IF NOT EXISTS primary_keyword text,
  ADD COLUMN IF NOT EXISTS secondary_keywords jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS localized_seo_pages_keyword_idx
  ON public.localized_seo_pages(country_id, language_id, primary_keyword);

-- A localized language/topic may have one primary keyword. Do not allow two
-- indexable pages in the same country/language to compete for the same term.
CREATE UNIQUE INDEX IF NOT EXISTS localized_seo_pages_indexable_keyword_unique
  ON public.localized_seo_pages(country_id, language_id, lower(trim(primary_keyword)))
  WHERE indexable = true AND primary_keyword IS NOT NULL AND length(trim(primary_keyword)) > 0;

-- Indexable localized pages need an explicit target keyword. Drafts may remain
-- keyword-less while editors are still preparing them.
ALTER TABLE public.localized_seo_pages
  ADD CONSTRAINT localized_seo_pages_indexable_requires_keyword
  CHECK (
    NOT indexable
    OR length(trim(coalesce(primary_keyword, ''))) > 0
  );
