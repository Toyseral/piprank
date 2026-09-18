-- Keep country + intent ranking contexts synchronized with canonical broker intent tags.
-- New intents do not get a standalone ranking dataset; candidates are derived from
-- broker.best_for and then become editable through country_intent_broker_overrides.

CREATE OR REPLACE FUNCTION public.sync_country_intent_broker_rankings(p_intent_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE intent_slug text;
BEGIN
  SELECT slug INTO intent_slug FROM public.intents WHERE id = p_intent_id;
  IF intent_slug IS NULL THEN RETURN; END IF;

  INSERT INTO public.country_intent_broker_rankings (
    country_id, intent_id, broker_id, rank, score, eligibility_status,
    score_breakdown, featured, created_at, updated_at
  )
  SELECT
    candidate.country_id,
    p_intent_id,
    candidate.broker_id,
    candidate.base_rank + candidate.new_rank,
    candidate.score,
    'eligible',
    candidate.score_breakdown,
    false,
    now(),
    now()
  FROM (
    SELECT
      scored.*,
      COALESCE(existing.max_rank, 0) AS base_rank,
      ROW_NUMBER() OVER (
        PARTITION BY scored.country_id
        ORDER BY scored.score DESC, scored.broker_id
      )::integer AS new_rank
    FROM (
      SELECT
        c.id AS country_id,
        b.id AS broker_id,
        ROUND(
          COALESCE(b.trust_score, 0)
          + COALESCE(b.rating, 0) * 10
          + COALESCE(b.support_score, 0) * 0.15
        , 2) AS score,
        jsonb_build_object(
          'intent_match', true,
          'bootstrap', true,
          'rating', COALESCE(b.rating, 0),
          'trust_score', COALESCE(b.trust_score, 0),
          'support_score', COALESCE(b.support_score, 0)
        ) AS score_breakdown
      FROM public.countries c
      CROSS JOIN public.brokers b
      WHERE COALESCE(c.publishing_state, 'published') <> 'closed'
        AND jsonb_typeof(COALESCE(b.best_for, '[]'::jsonb)) = 'array'
        AND COALESCE(b.best_for, '[]'::jsonb) ? intent_slug
        AND NOT EXISTS (
          SELECT 1 FROM public.country_intent_broker_rankings r
          WHERE r.country_id = c.id AND r.intent_id = p_intent_id AND r.broker_id = b.id
        )
    ) scored
    LEFT JOIN LATERAL (
      SELECT MAX(r.rank)::integer AS max_rank
      FROM public.country_intent_broker_rankings r
      WHERE r.country_id = scored.country_id AND r.intent_id = p_intent_id
    ) existing ON true
  ) candidate;

  DELETE FROM public.country_intent_broker_rankings r
  WHERE r.intent_id = p_intent_id
    AND NOT EXISTS (
      SELECT 1 FROM public.brokers b
      WHERE b.id = r.broker_id
        AND jsonb_typeof(COALESCE(b.best_for, '[]'::jsonb)) = 'array'
        AND COALESCE(b.best_for, '[]'::jsonb) ? intent_slug
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.country_intent_broker_overrides o
      WHERE o.country_id = r.country_id AND o.intent_id = r.intent_id AND o.broker_id = r.broker_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_intent_country_rankings_on_intent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_country_intent_broker_rankings(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_intent_country_rankings_on_broker()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE intent_row record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.best_for IS NOT DISTINCT FROM OLD.best_for THEN RETURN NEW; END IF;

  FOR intent_row IN
    SELECT id FROM public.intents
    WHERE jsonb_typeof(COALESCE(NEW.best_for, '[]'::jsonb)) = 'array'
      AND COALESCE(NEW.best_for, '[]'::jsonb) ? slug
  LOOP
    PERFORM public.sync_country_intent_broker_rankings(intent_row.id);
  END LOOP;

  IF TG_OP = 'UPDATE' THEN
    FOR intent_row IN
      SELECT id FROM public.intents
      WHERE jsonb_typeof(COALESCE(OLD.best_for, '[]'::jsonb)) = 'array'
        AND COALESCE(OLD.best_for, '[]'::jsonb) ? slug
        AND NOT (
          jsonb_typeof(COALESCE(NEW.best_for, '[]'::jsonb)) = 'array'
          AND COALESCE(NEW.best_for, '[]'::jsonb) ? slug
        )
    LOOP
      PERFORM public.sync_country_intent_broker_rankings(intent_row.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_intent_country_rankings_on_intent ON public.intents;
CREATE TRIGGER sync_intent_country_rankings_on_intent
AFTER INSERT OR UPDATE OF slug ON public.intents
FOR EACH ROW EXECUTE FUNCTION public.sync_intent_country_rankings_on_intent();

DROP TRIGGER IF EXISTS sync_intent_country_rankings_on_broker ON public.brokers;
CREATE TRIGGER sync_intent_country_rankings_on_broker
AFTER INSERT OR UPDATE OF best_for ON public.brokers
FOR EACH ROW EXECUTE FUNCTION public.sync_intent_country_rankings_on_broker();

DO $$
DECLARE intent_row record;
BEGIN
  FOR intent_row IN SELECT id FROM public.intents LOOP
    PERFORM public.sync_country_intent_broker_rankings(intent_row.id);
  END LOOP;
END;
$$;
