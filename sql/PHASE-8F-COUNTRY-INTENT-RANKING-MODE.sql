-- Explicit ranking mode for each country + intent pair.
-- Automatic is the default; manual means the admin-selected 1–9 order is authoritative.
CREATE TABLE IF NOT EXISTS public.country_intent_ranking_settings (
  id BIGSERIAL PRIMARY KEY,
  country_id BIGINT NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  intent_id BIGINT NOT NULL REFERENCES public.intents(id) ON DELETE CASCADE,
  ranking_mode TEXT NOT NULL DEFAULT 'automatic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT country_intent_ranking_settings_unique UNIQUE(country_id, intent_id),
  CONSTRAINT country_intent_ranking_settings_mode_check CHECK (ranking_mode IN ('automatic','manual'))
);

CREATE INDEX IF NOT EXISTS idx_cirs_country_intent
  ON public.country_intent_ranking_settings(country_id, intent_id);

ALTER TABLE public.country_intent_ranking_settings ENABLE ROW LEVEL SECURITY;
