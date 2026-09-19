-- Canonicalize Best-For / intent ownership.
-- Canonical intent identity is the long-form slug used by the global Best-For owner.
-- The short taxonomy rows were compatibility aliases and duplicated country rankings.

begin;

create or replace view public.country_intent_broker_final_rankings as
with config as (
  select country_id,intent_id,ranking_mode
  from public.country_intent_ranking_settings
),
base as (
  select r.id,r.country_id,r.intent_id,r.broker_id,r.rank,r.score,r.eligibility_status,
         r.score_breakdown,r.featured,r.created_at,r.updated_at,
         o.force_include,o.force_exclude,o.manual_rank,o.score_adjustment,
         o.featured_override,o.editorial_note,
         coalesce(c.ranking_mode,'automatic') as ranking_mode
  from public.country_intent_broker_rankings r
  left join public.country_intent_broker_overrides o
    on o.country_id=r.country_id and o.intent_id=r.intent_id and o.broker_id=r.broker_id
  left join config c
    on c.country_id=r.country_id and c.intent_id=r.intent_id
),
resolved as (
  select base.*,
         base.score + coalesce(base.score_adjustment,0::numeric) as final_score
  from base
  where coalesce(base.force_exclude,false)=false
),
ordered as (
  select resolved.*,
         row_number() over (
           partition by resolved.country_id,resolved.intent_id
           order by
             case when resolved.ranking_mode='manual' then resolved.manual_rank end,
             case when resolved.ranking_mode='automatic' then resolved.final_score end desc nulls last,
             resolved.final_score desc,
             resolved.broker_id
         )::integer as final_rank
  from resolved
)
select id,country_id,intent_id,broker_id,final_rank,final_score,eligibility_status,
       score_breakdown,coalesce(featured_override,featured) as featured,
       force_include,force_exclude,manual_rank,score_adjustment,
       featured_override,editorial_note
from ordered;

delete from public.country_intent_broker_overrides o
using public.intents i
where o.intent_id=i.id
  and i.slug in ('beginners','low-spread','mt4','mt5','ecn','copy-trading','scalping','swing-trading','high-leverage','islamic');

delete from public.country_intent_broker_rankings r
using public.intents i
where r.intent_id=i.id
  and i.slug in ('beginners','low-spread','mt4','mt5','ecn','copy-trading','scalping','swing-trading','high-leverage','islamic');

delete from public.content_documents
where content_type in ('country-best-for','localized-best-for')
  and coalesce(settings->>'source_best_for_id','')=''
  and published=false
  and indexable=false;

drop function if exists public.get_country_intent_ranking_mode(bigint,bigint);
drop function if exists public.set_country_intent_ranking_mode(bigint,bigint,text);
drop table public.country_intent_ranking_config;

delete from public.intents
where slug in ('beginners','low-spread','mt4','mt5','ecn','copy-trading','scalping','swing-trading','high-leverage','islamic');

alter table public.content_documents
  drop constraint if exists content_documents_not_localized_seo;
alter table public.content_documents
  add constraint content_documents_not_localized_seo
  check (content_type <> 'localized-seo');

alter table public.intents
  drop constraint if exists intents_slug_not_legacy_alias;
alter table public.intents
  add constraint intents_slug_not_legacy_alias
  check (slug not in ('beginners','low-spread','mt4','mt5','ecn','copy-trading','scalping','swing-trading','high-leverage','islamic'));

commit;
