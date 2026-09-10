alter table public.countries
  add column if not exists publishing_state text not null default 'published'
  check (publishing_state in ('draft','published','closed'));

create index if not exists countries_publishing_state_idx
  on public.countries(publishing_state);
