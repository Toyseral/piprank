-- Legacy SEO/content tables are no longer content sources.
-- Canonical editorial ownership is content_documents.

DROP TRIGGER IF EXISTS enforce_legacy_country_best_for_state ON public.country_best_for;
DROP TRIGGER IF EXISTS trg_country_best_for_updated_at ON public.country_best_for;
DROP TRIGGER IF EXISTS set_country_best_for_updated_at ON public.country_best_for;
DROP TRIGGER IF EXISTS guides_set_updated_at ON public.guides;

DROP FUNCTION IF EXISTS public.sync_legacy_country_best_for_to_topic_content();
DROP FUNCTION IF EXISTS public.enforce_legacy_country_best_for_state();

DROP TABLE IF EXISTS public.country_best_for;
DROP TABLE IF EXISTS public.localized_seo_pages;
DROP TABLE IF EXISTS public.guides;
