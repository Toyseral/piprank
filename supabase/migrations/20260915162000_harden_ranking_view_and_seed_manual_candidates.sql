-- Harden the country × intent final ranking view so it uses the caller's RLS context.
ALTER VIEW public.country_intent_broker_final_rankings SET (security_invoker = true);

-- Support lookups by intent as the ranking configuration grows.
CREATE INDEX IF NOT EXISTS idx_circ_intent ON public.country_intent_ranking_config(intent_id);

-- Manual mode must be usable even when an automatic ranking set has not yet
-- been materialized for a country + intent. Seed the pair from the country's
-- existing recommended broker pool, restricted to brokers whose stored
-- capabilities match the selected intent. This does not invent a new ranking
-- engine; it creates the editable candidate rows that the existing manual
-- override/final-ranking pipeline already owns.
CREATE OR REPLACE FUNCTION public.set_country_intent_ranking_mode(
  p_country_id BIGINT,
  p_intent_id BIGINT,
  p_ranking_mode TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT := lower(trim(coalesce(p_ranking_mode, '')));
  v_existing_count INTEGER := 0;
BEGIN
  IF NOT public.can_manage_ranking() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_mode NOT IN ('automatic', 'manual') THEN
    RAISE EXCEPTION 'Invalid ranking mode';
  END IF;

  INSERT INTO public.country_intent_ranking_config(country_id, intent_id, ranking_mode)
  VALUES (p_country_id, p_intent_id, v_mode)
  ON CONFLICT (country_id, intent_id)
  DO UPDATE SET ranking_mode = EXCLUDED.ranking_mode, updated_at = NOW();

  IF v_mode = 'manual' THEN
    SELECT count(*) INTO v_existing_count
    FROM public.country_intent_broker_rankings
    WHERE country_id = p_country_id AND intent_id = p_intent_id;

    IF v_existing_count = 0 THEN
      WITH country_pool AS (
        SELECT DISTINCT trim(btrim(CASE
          WHEN jsonb_typeof(item.value) = 'object' THEN item.value ->> 'slug'
          WHEN jsonb_typeof(item.value) = 'string' THEN trim(both '"' from item.value::text)
          ELSE NULL
        END)) AS broker_slug
        FROM public.countries c
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.recommended, '[]'::jsonb)) item(value)
        WHERE c.id = p_country_id
      ),
      intent_row AS (
        SELECT lower(slug) AS slug
        FROM public.intents
        WHERE id = p_intent_id
      ),
      candidates AS (
        SELECT
          p_country_id AS country_id,
          p_intent_id AS intent_id,
          b.id AS broker_id,
          b.rating,
          b.trust_score,
          b.spread_eurusd,
          b.commission_value,
          b.min_deposit,
          b.health,
          b.featured,
          i.slug AS intent_slug,
          b.best_for,
          b.platforms,
          b.assets,
          b.copy_trading,
          b.scalping,
          b.islamic_account,
          b.leverage_value
        FROM country_pool cp
        JOIN public.brokers b ON lower(b.slug) = lower(cp.broker_slug)
        CROSS JOIN intent_row i
        WHERE CASE i.slug
          WHEN 'mt4' THEN coalesce(b.best_for, '[]'::jsonb) ? 'mt4' OR coalesce(b.platforms, '[]'::jsonb) ? 'MT4'
          WHEN 'mt5' THEN coalesce(b.best_for, '[]'::jsonb) ? 'mt5' OR coalesce(b.platforms, '[]'::jsonb) ? 'MT5'
          WHEN 'gold' THEN coalesce(b.best_for, '[]'::jsonb) ? 'gold' OR coalesce((b.assets ->> 'commodities')::numeric, 0) > 0
          WHEN 'copy-trading' THEN coalesce(b.best_for, '[]'::jsonb) ? 'copy-trading' OR coalesce(b.copy_trading, false)
          WHEN 'scalping' THEN coalesce(b.best_for, '[]'::jsonb) ? 'scalping' OR coalesce(b.scalping, false)
          WHEN 'swing-trading' THEN coalesce(b.best_for, '[]'::jsonb) ? 'swing-trading'
          WHEN 'high-leverage' THEN coalesce(b.best_for, '[]'::jsonb) ? 'high-leverage' OR coalesce(b.leverage_value, 0) >= 200
          WHEN 'islamic' THEN coalesce(b.islamic_account, false)
          WHEN 'ecn' THEN coalesce(b.best_for, '[]'::jsonb) ? 'ecn'
          WHEN 'low-spread' THEN coalesce(b.best_for, '[]'::jsonb) ? 'low-spread'
          WHEN 'beginners' THEN coalesce(b.best_for, '[]'::jsonb) ? 'beginners'
          ELSE TRUE
        END
      ),
      scored AS (
        SELECT *,
          round((
            coalesce(trust_score, 0) * 0.28
            + (
              coalesce((health ->> 'regulation')::numeric, 0) * 0.30
              + coalesce((health ->> 'withdrawals')::numeric, 0) * 0.20
              + coalesce((health ->> 'execution')::numeric, 0) * 0.15
              + coalesce((health ->> 'longevity')::numeric, 0) * 0.15
              + coalesce((health ->> 'support')::numeric, 0) * 0.10
              + coalesce((health ->> 'sentiment')::numeric, 0) * 0.10
            ) * 0.28
            + greatest(0, 100 - (coalesce(spread_eurusd, 0) + coalesce(commission_value, 0) / 10) * 12) * 0.18
            + greatest(0, 100 - least(coalesce(min_deposit, 0), 500) / 5) * 0.08
            + least(100, coalesce(rating, 0) * 20) * 0.18
          ))::numeric AS seed_score
        FROM candidates
      )
      INSERT INTO public.country_intent_broker_rankings (
        country_id, intent_id, broker_id, rank, score, eligibility_status,
        score_breakdown, featured, created_at, updated_at
      )
      SELECT
        country_id,
        intent_id,
        broker_id,
        row_number() OVER (ORDER BY seed_score DESC, broker_id)::integer,
        seed_score,
        'eligible',
        jsonb_build_object('source', 'manual_seed', 'reason', 'country_recommended_pool', 'intent', intent_slug),
        coalesce(featured, false),
        now(),
        now()
      FROM scored;
    END IF;

    -- Always seed manual ranks from the current resolved automatic order.
    WITH ranked AS (
      SELECT r.country_id, r.intent_id, r.broker_id,
        row_number() OVER (
          ORDER BY coalesce(o.force_exclude, false) ASC,
                   (r.score + coalesce(o.score_adjustment, 0)) DESC,
                   r.broker_id
        )::integer AS next_manual_rank
      FROM public.country_intent_broker_rankings r
      LEFT JOIN public.country_intent_broker_overrides o
        ON o.country_id = r.country_id
       AND o.intent_id = r.intent_id
       AND o.broker_id = r.broker_id
      WHERE r.country_id = p_country_id
        AND r.intent_id = p_intent_id
        AND coalesce(o.force_exclude, false) = false
    )
    INSERT INTO public.country_intent_broker_overrides(country_id, intent_id, broker_id, manual_rank)
    SELECT country_id, intent_id, broker_id, next_manual_rank
    FROM ranked
    ON CONFLICT (country_id, intent_id, broker_id)
    DO UPDATE SET manual_rank = EXCLUDED.manual_rank, updated_at = NOW();
  END IF;

  RETURN v_mode;
END;
$$;

REVOKE ALL ON FUNCTION public.set_country_intent_ranking_mode(BIGINT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_country_intent_ranking_mode(BIGINT, BIGINT, TEXT) TO authenticated;
