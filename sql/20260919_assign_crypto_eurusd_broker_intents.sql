-- Records the explicit broker classifications for the canonical Crypto and EUR/USD intents.
-- Crypto membership comes from existing assets.crypto coverage.
-- EUR/USD membership comes from an existing finite, non-negative spread_eurusd value.
-- Existing broker categories are preserved.

UPDATE public.brokers
SET best_for = (
  SELECT jsonb_agg(DISTINCT value ORDER BY value)
  FROM jsonb_array_elements_text(
    COALESCE(best_for, '[]'::jsonb)
    || CASE WHEN COALESCE((assets->>'crypto')::numeric, 0) > 0
            THEN '["crypto-brokers"]'::jsonb ELSE '[]'::jsonb END
    || CASE WHEN spread_eurusd IS NOT NULL AND spread_eurusd >= 0
            THEN '["eur-usd-forex-brokers"]'::jsonb ELSE '[]'::jsonb END
  ) AS x(value)
)
WHERE COALESCE((assets->>'crypto')::numeric, 0) > 0
   OR (spread_eurusd IS NOT NULL AND spread_eurusd >= 0);

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.intents
           WHERE slug IN ('crypto-brokers','eur-usd-forex-brokers')
  LOOP
    PERFORM public.sync_country_intent_broker_rankings(r.id);
  END LOOP;
END $$;
