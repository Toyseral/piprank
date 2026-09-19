-- Ranking views are queried through server APIs, so they should respect caller RLS.
-- Keep SECURITY DEFINER helpers non-RPC-callable.
REVOKE EXECUTE ON FUNCTION public.can_manage_ranking() FROM PUBLIC, anon, authenticated;
ALTER VIEW public.country_broker_final_rankings SET (security_invoker = true);
ALTER VIEW public.country_intent_broker_final_rankings SET (security_invoker = true);
