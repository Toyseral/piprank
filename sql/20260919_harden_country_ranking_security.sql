-- Harden canonical country ranking control tables and RPC exposure.
-- All ranking-control reads/writes go through the authenticated server API
-- using the Supabase service role; browser clients must not access these
-- control tables or the legacy ranking-mode RPC directly.

ALTER TABLE public.country_broker_ranking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_broker_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_intent_ranking_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_public_country_broker_ranking_settings" ON public.country_broker_ranking_settings;
CREATE POLICY "deny_public_country_broker_ranking_settings"
  ON public.country_broker_ranking_settings
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_public_country_broker_overrides" ON public.country_broker_overrides;
CREATE POLICY "deny_public_country_broker_overrides"
  ON public.country_broker_overrides
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_public_country_intent_ranking_settings" ON public.country_intent_ranking_settings;
CREATE POLICY "deny_public_country_intent_ranking_settings"
  ON public.country_intent_ranking_settings
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

ALTER VIEW public.country_broker_final_rankings SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.set_country_intent_ranking_mode(bigint, bigint, text)
  FROM PUBLIC, anon, authenticated;
