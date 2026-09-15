create or replace function public.get_country_intent_ranking_mode(p_country_id bigint, p_intent_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select ranking_mode
      from public.country_intent_ranking_config
      where country_id = p_country_id
        and intent_id = p_intent_id
    ),
    'automatic'
  );
$$;

revoke execute on function public.get_country_intent_ranking_mode(bigint, bigint) from public, anon;
grant execute on function public.get_country_intent_ranking_mode(bigint, bigint) to authenticated;
