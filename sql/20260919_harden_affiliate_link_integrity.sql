-- Enforce the same invariants used by affiliate routing and broker-country compliance.
-- A broker may have at most one active/configured affiliate row per country,
-- and at most one global affiliate row. Availability status has exactly three
-- supported states; "unknown" is no longer a valid persisted state.

ALTER TABLE public.broker_country_availability
  DROP CONSTRAINT IF EXISTS broker_country_availability_status_check;

ALTER TABLE public.broker_country_availability
  ADD CONSTRAINT broker_country_availability_status_check
  CHECK (status = ANY (ARRAY['available'::text, 'restricted'::text, 'unavailable'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_links_broker_country_unique
  ON public.affiliate_links (broker_id, country_code)
  WHERE country_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_links_broker_global_unique
  ON public.affiliate_links (broker_id)
  WHERE country_code IS NULL;
