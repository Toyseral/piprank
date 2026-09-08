revoke execute on function public.sync_legacy_broker_content_to_canonical() from public, anon, authenticated;
revoke execute on function public.sync_legacy_country_best_for_to_canonical_topic_content() from public, anon, authenticated;

alter function public.sync_legacy_broker_content_to_canonical() set search_path = public;
alter function public.sync_legacy_country_best_for_to_canonical_topic_content() set search_path = public;
alter function public.sync_intents_to_canonical_best_for_docs() set search_path = public;

drop index if exists public.content_documents_content_key_uidx;
drop index if exists public.idx_country_best_for_country;
drop index if exists public.idx_country_best_for_intent;

create index if not exists country_intent_broker_overrides_broker_id_idx on public.country_intent_broker_overrides (broker_id);
create index if not exists country_intent_broker_overrides_intent_id_idx on public.country_intent_broker_overrides (intent_id);
create index if not exists country_intent_broker_rankings_intent_id_idx on public.country_intent_broker_rankings (intent_id);
