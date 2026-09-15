create schema if not exists legacy_archive;

create table if not exists legacy_archive.country_best_for_20260915 as table public.country_best_for with no data;
insert into legacy_archive.country_best_for_20260915 select * from public.country_best_for;

create table if not exists legacy_archive.localized_seo_pages_20260915 as table public.localized_seo_pages with no data;
insert into legacy_archive.localized_seo_pages_20260915 select * from public.localized_seo_pages;

create table if not exists legacy_archive.guides_20260915 as table public.guides with no data;
insert into legacy_archive.guides_20260915 select * from public.guides;

-- Canonical guide documents already exist for all six real legacy guides.
-- The seventh row is an isolated test guide with no canonical document.
drop trigger if exists sync_guide_to_canonical_content_document on public.guides;

delete from public.guides;
delete from public.localized_seo_pages;
delete from public.country_best_for;

comment on table public.guides is 'RETIRING: canonical guide source is public.content_documents with content_type=guide. Do not add new rows.';
comment on table public.localized_seo_pages is 'RETIRED: localized SEO source is public.content_documents with content_type=localized-guide or localized-best-for. Do not add new rows.';
comment on table public.country_best_for is 'RETIRED: country Best-For source is public.content_documents with content_type=country-best-for. Do not add new rows.';
