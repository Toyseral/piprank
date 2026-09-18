-- Canonical country-level broker ranking controls.
-- This ranking is intentionally separate from country + intent rankings.
CREATE TABLE IF NOT EXISTS public.country_broker_ranking_settings (
  id BIGSERIAL PRIMARY KEY,
  country_id BIGINT NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  ranking_mode TEXT NOT NULL DEFAULT 'automatic' CHECK (ranking_mode IN ('automatic','manual')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT country_broker_ranking_settings_unique UNIQUE(country_id)
);

CREATE TABLE IF NOT EXISTS public.country_broker_overrides (
  id BIGSERIAL PRIMARY KEY,
  country_id BIGINT NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  broker_id BIGINT NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  force_include BOOLEAN NOT NULL DEFAULT FALSE,
  force_exclude BOOLEAN NOT NULL DEFAULT FALSE,
  manual_rank INTEGER,
  score_adjustment NUMERIC(8,2) NOT NULL DEFAULT 0,
  featured_override BOOLEAN,
  editorial_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT country_broker_overrides_unique UNIQUE(country_id,broker_id),
  CONSTRAINT country_broker_overrides_no_conflict CHECK (NOT (force_include AND force_exclude))
);

CREATE INDEX IF NOT EXISTS idx_cbo_country ON public.country_broker_overrides(country_id);

-- The base score is the existing broker trust score. Availability is resolved
-- from broker_country_availability; editorial overrides are applied separately.
CREATE OR REPLACE VIEW public.country_broker_final_rankings AS
WITH base AS (
  SELECT
    c.id AS country_id,
    b.id AS broker_id,
    COALESCE(b.trust_score, 0)::NUMERIC AS score,
    COALESCE(a.status, 'available') AS availability_status,
    a.note AS availability_note,
    o.force_include,
    o.force_exclude,
    o.manual_rank,
    o.score_adjustment,
    o.featured_override,
    o.editorial_note
  FROM public.countries c
  CROSS JOIN public.brokers b
  LEFT JOIN public.broker_country_availability a
    ON a.country_id = c.id AND a.broker_id = b.id
  LEFT JOIN public.country_broker_overrides o
    ON o.country_id = c.id AND o.broker_id = b.id
),
resolved AS (
  SELECT *,
    (score + COALESCE(score_adjustment, 0)) AS final_score
  FROM base
  WHERE COALESCE(force_exclude, FALSE) = FALSE
    AND availability_status = 'available'
),
ordered AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY country_id
      ORDER BY manual_rank NULLS LAST, final_score DESC, broker_id
    )::INTEGER AS final_rank
  FROM resolved
)
SELECT
  country_id,
  broker_id,
  final_rank,
  final_score,
  availability_status,
  availability_note,
  force_include,
  force_exclude,
  manual_rank,
  score_adjustment,
  COALESCE(featured_override, FALSE) AS featured,
  featured_override,
  editorial_note
FROM ordered;
