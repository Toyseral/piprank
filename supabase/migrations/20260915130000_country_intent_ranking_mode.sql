-- Country + intent ranking mode is configuration for the pair, not a broker override.
CREATE TABLE IF NOT EXISTS public.country_intent_ranking_config (
  id BIGSERIAL PRIMARY KEY,
  country_id BIGINT NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  intent_id BIGINT NOT NULL REFERENCES public.intents(id) ON DELETE CASCADE,
  ranking_mode TEXT NOT NULL DEFAULT 'automatic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT country_intent_ranking_config_unique UNIQUE (country_id, intent_id),
  CONSTRAINT country_intent_ranking_config_mode_check CHECK (ranking_mode IN ('automatic', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_circ_country_intent
  ON public.country_intent_ranking_config(country_id, intent_id);

CREATE OR REPLACE FUNCTION public.can_manage_ranking()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE lower(au.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND au.active = TRUE
      AND au.role IN ('super_admin', 'admin', 'content_admin', 'brokers_admin')
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_ranking() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_ranking() TO authenticated;

ALTER TABLE public.country_intent_ranking_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking config admin read" ON public.country_intent_ranking_config;
CREATE POLICY "ranking config admin read"
  ON public.country_intent_ranking_config
  FOR SELECT TO authenticated
  USING (public.can_manage_ranking());

DROP POLICY IF EXISTS "ranking config admin write" ON public.country_intent_ranking_config;
CREATE POLICY "ranking config admin write"
  ON public.country_intent_ranking_config
  FOR ALL TO authenticated
  USING (public.can_manage_ranking())
  WITH CHECK (public.can_manage_ranking());

CREATE OR REPLACE FUNCTION public.get_country_intent_ranking_mode(
  p_country_id BIGINT,
  p_intent_id BIGINT
)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT ranking_mode
      FROM public.country_intent_ranking_config
      WHERE country_id = p_country_id AND intent_id = p_intent_id
    ),
    'automatic'
  );
$$;

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
BEGIN
  IF NOT public.can_manage_ranking() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_mode NOT IN ('automatic', 'manual') THEN
    RAISE EXCEPTION 'Invalid ranking mode';
  END IF;

  INSERT INTO public.country_intent_ranking_config (country_id, intent_id, ranking_mode)
  VALUES (p_country_id, p_intent_id, v_mode)
  ON CONFLICT (country_id, intent_id)
  DO UPDATE SET ranking_mode = EXCLUDED.ranking_mode, updated_at = NOW();

  -- When entering manual mode for the first time, seed a complete manual order
  -- from the current automatic order. This makes switching modes deterministic
  -- and avoids an apparently empty manual ranking.
  IF v_mode = 'manual' THEN
    WITH ranked AS (
      SELECT
        r.country_id,
        r.intent_id,
        r.broker_id,
        ROW_NUMBER() OVER (
          ORDER BY
            COALESCE(o.force_exclude, FALSE) ASC,
            (r.score + COALESCE(o.score_adjustment, 0)) DESC,
            r.broker_id
        )::INTEGER AS next_manual_rank
      FROM public.country_intent_broker_rankings r
      LEFT JOIN public.country_intent_broker_overrides o
        ON o.country_id = r.country_id
       AND o.intent_id = r.intent_id
       AND o.broker_id = r.broker_id
      WHERE r.country_id = p_country_id
        AND r.intent_id = p_intent_id
        AND COALESCE(o.force_exclude, FALSE) = FALSE
    )
    INSERT INTO public.country_intent_broker_overrides (
      country_id, intent_id, broker_id, manual_rank
    )
    SELECT country_id, intent_id, broker_id, next_manual_rank
    FROM ranked
    ON CONFLICT (country_id, intent_id, broker_id)
    DO UPDATE SET manual_rank = EXCLUDED.manual_rank, updated_at = NOW();
  END IF;

  RETURN v_mode;
END;
$$;

REVOKE ALL ON FUNCTION public.get_country_intent_ranking_mode(BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_country_intent_ranking_mode(BIGINT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.set_country_intent_ranking_mode(BIGINT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_country_intent_ranking_mode(BIGINT, BIGINT, TEXT) TO authenticated;

-- Automatic mode ignores manual_rank. Manual mode uses the explicit broker order.
CREATE OR REPLACE VIEW public.country_intent_broker_final_rankings AS
WITH config AS (
  SELECT country_id, intent_id, ranking_mode
  FROM public.country_intent_ranking_config
),
base AS (
  SELECT
    r.*,
    o.force_include,
    o.force_exclude,
    o.manual_rank,
    o.score_adjustment,
    o.featured_override,
    o.editorial_note,
    COALESCE(c.ranking_mode, 'automatic') AS ranking_mode
  FROM public.country_intent_broker_rankings r
  LEFT JOIN public.country_intent_broker_overrides o
    ON o.country_id = r.country_id
   AND o.intent_id = r.intent_id
   AND o.broker_id = r.broker_id
  LEFT JOIN config c
    ON c.country_id = r.country_id
   AND c.intent_id = r.intent_id
),
resolved AS (
  SELECT *, (score + COALESCE(score_adjustment, 0)) AS final_score
  FROM base
  WHERE COALESCE(force_exclude, FALSE) = FALSE
),
ordered AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY country_id, intent_id
    ORDER BY
      CASE WHEN ranking_mode = 'manual' THEN manual_rank END NULLS LAST,
      CASE WHEN ranking_mode = 'automatic' THEN final_score END DESC NULLS LAST,
      final_score DESC,
      broker_id
  )::INTEGER AS final_rank
  FROM resolved
)
SELECT
  id,
  country_id,
  intent_id,
  broker_id,
  final_rank,
  final_score,
  eligibility_status,
  score_breakdown,
  COALESCE(featured_override, featured) AS featured,
  force_include,
  force_exclude,
  manual_rank,
  score_adjustment,
  featured_override,
  editorial_note
FROM ordered;
