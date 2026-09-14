-- PipRank canonical ownership safeguards.
-- Run only after auditing duplicate content_key values.
-- This migration intentionally does not delete legacy content; it prevents new
-- rows from reintroducing the retired country-topic owner.

create unique index if not exists content_documents_content_key_uidx
  on public.content_documents (content_key);

create or replace function public.validate_canonical_content_document()
returns trigger
language plpgsql
as $$
begin
  -- country-topic and localized-seo are legacy/generated systems and must not
  -- become canonical editorial page owners.
  if new.content_type = 'country-topic' then
    raise exception 'country-topic is retired; use country-guide or country-best-for';
  end if;

  if new.content_type = 'country-guide' then
    if nullif(trim(new.country_slug), '') is null or nullif(trim(new.slug), '') is null then
      raise exception 'country-guide requires country_slug and slug';
    end if;
    if nullif(trim(new.topic_slug), '') is not null then
      raise exception 'country-guide must not use topic_slug';
    end if;
  elsif new.content_type = 'country-best-for' then
    if nullif(trim(new.country_slug), '') is null or nullif(trim(new.slug), '') is null then
      raise exception 'country-best-for requires country_slug and slug';
    end if;
  elsif new.content_type in ('global-best-for', 'guide', 'broker', 'compare') then
    if nullif(trim(new.slug), '') is null then
      raise exception '% requires slug', new.content_type;
    end if;
  elsif new.content_type = 'country' then
    if nullif(trim(coalesce(new.country_slug, new.slug)), '') is null then
      raise exception 'country requires country_slug or slug';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_canonical_content_document on public.content_documents;
create trigger trg_validate_canonical_content_document
before insert or update on public.content_documents
for each row execute function public.validate_canonical_content_document();

create index if not exists content_documents_canonical_lookup_idx
  on public.content_documents(content_type, country_slug, slug, published, indexable);
