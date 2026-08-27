CREATE TABLE IF NOT EXISTS public.country_intent_broker_overrides (
  id BIGSERIAL PRIMARY KEY,
  country_id BIGINT NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  intent_id BIGINT NOT NULL REFERENCES public.intents(id) ON DELETE CASCADE,
  broker_id INTEGER NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  force_include BOOLEAN NOT NULL DEFAULT FALSE,
  force_exclude BOOLEAN NOT NULL DEFAULT FALSE,
  manual_rank INTEGER,
  score_adjustment NUMERIC(8,2) NOT NULL DEFAULT 0,
  featured_override BOOLEAN,
  editorial_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT country_intent_broker_overrides_unique UNIQUE(country_id,intent_id,broker_id),
  CONSTRAINT country_intent_broker_overrides_no_conflict CHECK (NOT (force_include AND force_exclude))
);
CREATE INDEX IF NOT EXISTS idx_cibo_country_intent ON public.country_intent_broker_overrides(country_id,intent_id);

-- Final resolver: automatic rankings + editorial overrides.
CREATE OR REPLACE VIEW public.country_intent_broker_final_rankings AS
WITH base AS (
 SELECT r.*, o.force_include, o.force_exclude, o.manual_rank, o.score_adjustment,
        o.featured_override, o.editorial_note
 FROM public.country_intent_broker_rankings r
 LEFT JOIN public.country_intent_broker_overrides o
   ON o.country_id=r.country_id AND o.intent_id=r.intent_id AND o.broker_id=r.broker_id
), resolved AS (
 SELECT *, (score + COALESCE(score_adjustment,0)) AS final_score
 FROM base
 WHERE COALESCE(force_exclude,FALSE)=FALSE
), ordered AS (
 SELECT *, ROW_NUMBER() OVER (
   PARTITION BY country_id,intent_id
   ORDER BY manual_rank NULLS LAST, final_score DESC, broker_id
 )::INTEGER AS final_rank
 FROM resolved
)
SELECT id,country_id,intent_id,broker_id,final_rank,final_score,
       eligibility_status,score_breakdown,
       COALESCE(featured_override, featured) AS featured,
       force_include,force_exclude,manual_rank,score_adjustment,featured_override,editorial_note
FROM ordered;
