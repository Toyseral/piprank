-- Canonical content ownership constraints
-- Run after reviewing the migration audit. Existing legacy rows remain readable
-- during migration, but new writes to legacy content types are blocked.

create unique index if not exists content_documents_content_key_uidx
  on public.content_documents (content_key);

create or replace function public.reject_legacy_content_document_type()
returns trigger
language plpgsql
as $$
begin
  if new.content_type in ('country-topic', 'country-best-for') then
    raise exception 'Legacy content type % is retired; use canonical content_documents ownership instead.', new.content_type
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists content_documents_reject_legacy_type on public.content_documents;
create trigger content_documents_reject_legacy_type
before insert or update of content_type on public.content_documents
for each row
execute function public.reject_legacy_content_document_type();

-- After all legacy rows have been migrated, run this stronger constraint:
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
