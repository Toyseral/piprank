alter table public.redirect_clicks
  add column if not exists click_id uuid,
  add column if not exists country_code text,
  add column if not exists country_source text,
  add column if not exists resolved_url_type text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists session_id text;

create index if not exists idx_redirect_clicks_click_id
  on public.redirect_clicks (click_id);

create index if not exists idx_redirect_clicks_broker_created_at
  on public.redirect_clicks (broker_id, created_at desc);

create index if not exists idx_redirect_clicks_country_created_at
  on public.redirect_clicks (country_code, created_at desc);

create index if not exists idx_redirect_clicks_utm_campaign
  on public.redirect_clicks (utm_campaign)
  where utm_campaign is not null;
