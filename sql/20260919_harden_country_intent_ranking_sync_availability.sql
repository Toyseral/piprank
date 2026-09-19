-- Harden country intent ranking synchronization so unavailable/restricted brokers
-- cannot be inserted or retained in country_intent_broker_rankings.

CREATE OR REPLACE FUNCTION public.sync_country_intent_broker_rankings(p_intent_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_intent_slug text;
  v_taxonomy_slug text;
BEGIN
  SELECT slug INTO v_intent_slug
  FROM public.intents
  WHERE id = p_intent_id;

  IF v_intent_slug IS NULL THEN
    RETURN;
  END IF;

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
    ELSE v_intent_slug
  END;

  INSERT INTO public.country_intent_broker_rankings
    (country_id,intent_id,broker_id,rank,score,eligibility_status,score_breakdown,featured)
  SELECT
    c.id,
    p_intent_id,
    b.id,
    ROW_NUMBER() OVER (
      PARTITION BY c.id
      ORDER BY (
        COALESCE(b.trust_score,0) +
        COALESCE(b.rating,0) * 10 +
        COALESCE(b.support_score,0) * 0.15
      ) DESC,
      b.id
    ),
    (
      COALESCE(b.trust_score,0) +
      COALESCE(b.rating,0) * 10 +
      COALESCE(b.support_score,0) * 0.15
    ),
    'eligible',
    jsonb_build_object(
      'intent_match',v_intent_slug,
      'taxonomy_slug',v_taxonomy_slug,
      'bootstrap',true
    ),
    false
  FROM public.countries c
  CROSS JOIN public.brokers b
  LEFT JOIN public.broker_country_availability a
    ON a.country_id = c.id
   AND a.broker_id = b.id
  WHERE COALESCE(b.best_for,'[]'::jsonb) ? v_taxonomy_slug
    AND COALESCE(a.is_available, true) = true
    AND LOWER(COALESCE(a.status, 'available')) NOT IN ('unavailable', 'restricted')
    AND NOT EXISTS (
      SELECT 1
      FROM public.country_intent_broker_rankings r
      WHERE r.country_id = c.id
        AND r.intent_id = p_intent_id
        AND r.broker_id = b.id
    );

  DELETE FROM public.country_intent_broker_rankings r
  WHERE r.intent_id = p_intent_id
    AND (
      NOT EXISTS (
        SELECT 1
        FROM public.brokers b
        WHERE b.id = r.broker_id
          AND COALESCE(b.best_for,'[]'::jsonb) ? v_taxonomy_slug
      )
      OR EXISTS (
        SELECT 1
        FROM public.broker_country_availability a
        WHERE a.country_id = r.country_id
          AND a.broker_id = r.broker_id
          AND (
            a.is_available = false
            OR LOWER(COALESCE(a.status, 'available')) IN ('unavailable', 'restricted')
          )
      )
    );

  DELETE FROM public.country_intent_broker_overrides o
  WHERE o.intent_id = p_intent_id
    AND EXISTS (
      SELECT 1
      FROM public.broker_country_availability a
      WHERE a.country_id = o.country_id
        AND a.broker_id = o.broker_id
        AND (
          a.is_available = false
          OR LOWER(COALESCE(a.status, 'available')) IN ('unavailable', 'restricted')
        )
    );
END;
$function$;

-- Clean existing stale rows and stale overrides immediately.
DO $$
DECLARE
  v_intent_id bigint;
BEGIN
  FOR v_intent_id IN
    SELECT DISTINCT intent_id
    FROM public.country_intent_broker_rankings
  LOOP
    PERFORM public.sync_country_intent_broker_rankings(v_intent_id);
  END LOOP;
END $$;
