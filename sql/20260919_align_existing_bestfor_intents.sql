-- Align existing Best-For data with canonical long-slug intent identities.
-- Legacy short intents remain for backward compatibility, while canonical owners
-- receive canonical intent rows and ranking copies.

WITH owners AS (
  SELECT id, slug, title, topic_slug
  FROM public.content_documents
  WHERE content_type='global-best-for' AND slug IS NOT NULL
)
INSERT INTO public.intents (slug,label,title,icon,sort_order)
SELECT o.slug,
       COALESCE(NULLIF(regexp_replace(COALESCE(o.title,''),'\\s*\\|.*$',''),''),
                initcap(replace(o.slug,'-',' '))),
       COALESCE(NULLIF(o.title,''),initcap(replace(o.slug,'-',' '))),
       COALESCE(o.topic_slug,'beginners'),
       0
FROM owners o
WHERE NOT EXISTS (SELECT 1 FROM public.intents i WHERE i.slug=o.slug);

WITH mapping(old_slug,canonical_slug) AS (
 VALUES ('beginners','forex-brokers-for-beginners'),('low-spread','low-spread-forex-brokers'),
 ('mt4','mt4-forex-brokers'),('mt5','mt5-forex-brokers'),('gold','gold-forex-brokers'),
 ('ecn','ecn-forex-brokers'),('copy-trading','copy-trading-forex-brokers'),
 ('scalping','forex-brokers-for-scalping'),('swing-trading','forex-brokers-for-swing-trading'),
 ('high-leverage','high-leverage-forex-brokers'),('islamic','islamic-forex-brokers')
), pairs AS (
 SELECT oldi.id old_id,newi.id new_id FROM mapping m
 JOIN public.intents oldi ON oldi.slug=m.old_slug JOIN public.intents newi ON newi.slug=m.canonical_slug
)
INSERT INTO public.country_intent_broker_rankings
(country_id,intent_id,broker_id,rank,score,eligibility_status,score_breakdown,featured,created_at,updated_at)
SELECT r.country_id,p.new_id,r.broker_id,r.rank,r.score,r.eligibility_status,
 r.score_breakdown || jsonb_build_object('canonicalized_from_intent_id',r.intent_id),
 r.featured,r.created_at,r.updated_at
FROM public.country_intent_broker_rankings r JOIN pairs p ON p.old_id=r.intent_id
WHERE NOT EXISTS (SELECT 1 FROM public.country_intent_broker_rankings x
 WHERE x.country_id=r.country_id AND x.intent_id=p.new_id AND x.broker_id=r.broker_id);

WITH mapping(old_slug,canonical_slug) AS (
 VALUES ('beginners','forex-brokers-for-beginners'),('low-spread','low-spread-forex-brokers'),
 ('mt4','mt4-forex-brokers'),('mt5','mt5-forex-brokers'),('gold','gold-forex-brokers'),
 ('ecn','ecn-forex-brokers'),('copy-trading','copy-trading-forex-brokers'),
 ('scalping','forex-brokers-for-scalping'),('swing-trading','forex-brokers-for-swing-trading'),
 ('high-leverage','high-leverage-forex-brokers'),('islamic','islamic-forex-brokers')
), pairs AS (
 SELECT oldi.id old_id,newi.id new_id FROM mapping m
 JOIN public.intents oldi ON oldi.slug=m.old_slug JOIN public.intents newi ON newi.slug=m.canonical_slug
)
INSERT INTO public.country_intent_broker_overrides
(country_id,intent_id,broker_id,force_include,force_exclude,manual_rank,score_adjustment,featured_override,editorial_note,created_at,updated_at)
SELECT o.country_id,p.new_id,o.broker_id,o.force_include,o.force_exclude,o.manual_rank,o.score_adjustment,o.featured_override,o.editorial_note,o.created_at,o.updated_at
FROM public.country_intent_broker_overrides o JOIN pairs p ON p.old_id=o.intent_id
WHERE NOT EXISTS (SELECT 1 FROM public.country_intent_broker_overrides x
 WHERE x.country_id=o.country_id AND x.intent_id=p.new_id AND x.broker_id=o.broker_id);

UPDATE public.content_documents d
SET topic_slug=g.slug,
 settings=COALESCE(d.settings,'{}'::jsonb) || jsonb_build_object('intent_slug',g.slug,'canonicalIntentSlug',g.slug,'source_best_for_id',g.id)
FROM public.content_documents g
WHERE d.content_type='country-best-for' AND g.content_type='global-best-for' AND g.slug=d.slug;

WITH mapping(topic_slug,owner_slug) AS (
 VALUES ('beginners','forex-brokers-for-beginners'),('low-spread','low-spread-forex-brokers'),
 ('mt4','mt4-forex-brokers'),('mt5','mt5-forex-brokers'),('gold','gold-forex-brokers'),
 ('ecn','ecn-forex-brokers'),('copy-trading','copy-trading-forex-brokers'),
 ('scalping','forex-brokers-for-scalping'),('swing-trading','forex-brokers-for-swing-trading'),
 ('high-leverage','high-leverage-forex-brokers'),('islamic','islamic-forex-brokers')
)
UPDATE public.content_documents d
SET settings=COALESCE(d.settings,'{}'::jsonb) || jsonb_build_object('intent_slug',g.slug,'canonicalIntentSlug',g.slug,'source_best_for_id',g.id),
 topic_slug=g.slug
FROM mapping m JOIN public.content_documents g ON g.content_type='global-best-for' AND g.slug=m.owner_slug
WHERE d.content_type='localized-best-for' AND d.topic_slug=m.topic_slug;

CREATE OR REPLACE FUNCTION public.sync_country_intent_broker_rankings(p_intent_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_intent_slug text; v_taxonomy_slug text;
BEGIN
 SELECT slug INTO v_intent_slug FROM public.intents WHERE id=p_intent_id;
 IF v_intent_slug IS NULL THEN RETURN; END IF;
 v_taxonomy_slug := CASE v_intent_slug
  WHEN 'forex-brokers-for-beginners' THEN 'beginners'
  WHEN 'low-spread-forex-brokers' THEN 'low-spread'
  WHEN 'mt4-forex-brokers' THEN 'mt4'
  WHEN 'mt5-forex-brokers' THEN 'mt5'
  WHEN 'gold-forex-brokers' THEN 'gold'
  WHEN 'ecn-forex-brokers' THEN 'ecn'
  WHEN 'copy-trading-forex-brokers' THEN 'copy-trading'
  WHEN 'forex-brokers-for-scalping' THEN 'scalping'
  WHEN 'forex-brokers-for-swing-trading' THEN 'swing-trading'
  WHEN 'high-leverage-forex-brokers' THEN 'high-leverage'
  WHEN 'islamic-forex-brokers' THEN 'islamic'
  ELSE v_intent_slug END;
 INSERT INTO public.country_intent_broker_rankings
 (country_id,intent_id,broker_id,rank,score,eligibility_status,score_breakdown,featured)
 SELECT c.id,p_intent_id,b.id,
  ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY (COALESCE(b.trust_score,0)+COALESCE(b.rating,0)*10+COALESCE(b.support_score,0)*0.15) DESC,b.id),
  (COALESCE(b.trust_score,0)+COALESCE(b.rating,0)*10+COALESCE(b.support_score,0)*0.15),
  'eligible',jsonb_build_object('intent_match',v_intent_slug,'taxonomy_slug',v_taxonomy_slug,'bootstrap',true),false
 FROM public.countries c CROSS JOIN public.brokers b
 WHERE COALESCE(b.best_for,'[]'::jsonb) ? v_taxonomy_slug
 AND NOT EXISTS (SELECT 1 FROM public.country_intent_broker_rankings r WHERE r.country_id=c.id AND r.intent_id=p_intent_id AND r.broker_id=b.id);
 DELETE FROM public.country_intent_broker_rankings r
 WHERE r.intent_id=p_intent_id
 AND NOT EXISTS (SELECT 1 FROM public.brokers b WHERE b.id=r.broker_id AND COALESCE(b.best_for,'[]'::jsonb) ? v_taxonomy_slug)
 AND NOT EXISTS (SELECT 1 FROM public.country_intent_broker_overrides o WHERE o.country_id=r.country_id AND o.intent_id=r.intent_id AND o.broker_id=r.broker_id);
END; $$;

REVOKE EXECUTE ON FUNCTION public.sync_country_intent_broker_rankings(bigint) FROM PUBLIC, anon, authenticated;
