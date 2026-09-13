-- Canonical content ownership constraints
-- Run only after the migration audit reports zero duplicate content_key values.

-- Every content document must have one unique identity.
create unique index if not exists content_documents_content_key_uidx
  on public.content_documents (content_key);

-- Canonical documents may only use the approved content types.
-- Legacy rows should be migrated before enabling this constraint.
-- This is intentionally NOT added as a CHECK constraint yet because existing
-- production rows may still contain legacy types during the migration window.

-- Recommended post-migration hard constraint:
-- alter table public.content_documents
--   add constraint content_documents_canonical_type_chk
--   check (content_type in (
--     'country',
--     'country-guide',
--     'global-best-for',
--     'guide',
--     'broker',
--     'compare'
--   ));
