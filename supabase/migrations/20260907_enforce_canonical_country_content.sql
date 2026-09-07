-- Canonical country commercial pages are owned by the SEO matrix.
-- Legacy country_best_for and country-best-for content_documents remain as
-- editorial/source data but can never become indexable public pages.

CREATE OR REPLACE FUNCTION public.enforce_legacy_country_best_for_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.indexable := false;
  NEW.published := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_legacy_country_best_for_state ON public.country_best_for;
CREATE TRIGGER enforce_legacy_country_best_for_state
BEFORE INSERT OR UPDATE ON public.country_best_for
FOR EACH ROW
EXECUTE FUNCTION public.enforce_legacy_country_best_for_state();

CREATE OR REPLACE FUNCTION public.enforce_legacy_country_document_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content_type = 'country-best-for' THEN
    NEW.indexable := false;
    NEW.published := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_legacy_country_document_state ON public.content_documents;
CREATE TRIGGER enforce_legacy_country_document_state
BEFORE INSERT OR UPDATE ON public.content_documents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_legacy_country_document_state();

-- Defense in depth: indexable records must have usable identity fields.
ALTER TABLE public.content_documents
  ADD CONSTRAINT content_documents_indexable_requires_slug
  CHECK (NOT indexable OR length(trim(coalesce(slug, ''))) > 0);

ALTER TABLE public.country_best_for
  ADD CONSTRAINT country_best_for_indexable_requires_slug
  CHECK (NOT indexable OR length(trim(slug)) > 0),
  ADD CONSTRAINT country_best_for_indexable_requires_title
  CHECK (NOT indexable OR length(trim(coalesce(title, label, ''))) > 0);

-- Normalize legacy rows after the enforcement layer is installed.
UPDATE public.country_best_for
SET indexable = false,
    published = false,
    updated_at = now()
WHERE indexable = true OR published = true;

UPDATE public.content_documents
SET indexable = false,
    published = false,
    updated_at = now()
WHERE content_type = 'country-best-for'
  AND (indexable = true OR published = true);
