-- Pin search_path for newly introduced SECURITY DEFINER functions.
alter function public.replace_broker_country_availability(bigint, jsonb)
  set search_path = '';

alter function public.sync_country_intent_rankings_on_availability()
  set search_path = '';
