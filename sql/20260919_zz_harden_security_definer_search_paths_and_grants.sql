-- Harden SECURITY DEFINER functions against search_path hijacking and
-- prevent trigger-only/internal helpers from being callable through PostgREST RPC.

ALTER FUNCTION public.sync_legacy_broker_content_to_canonical()
  SET search_path = '';
ALTER FUNCTION public.sync_guide_to_canonical_content_document()
  SET search_path = '';
ALTER FUNCTION public.increment_review_helpful(integer, text, text)
  SET search_path = '';
ALTER FUNCTION public.can_manage_ranking()
  SET search_path = '';
ALTER FUNCTION public.sync_country_intent_broker_rankings(bigint)
  SET search_path = '';
ALTER FUNCTION public.sync_intent_country_rankings_on_intent()
  SET search_path = '';
ALTER FUNCTION public.sync_intent_country_rankings_on_broker()
  SET search_path = '';
ALTER FUNCTION public.guard_country_intent_broker_override_availability()
  SET search_path = '';
ALTER FUNCTION public.cleanup_country_ranking_overrides_on_availability_change()
  SET search_path = '';
ALTER FUNCTION public.guard_country_ranking_override_availability()
  SET search_path = '';
ALTER FUNCTION public.sync_country_intent_rankings_on_availability()
  SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.sync_legacy_broker_content_to_canonical() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_guide_to_canonical_content_document() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_ranking() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_country_intent_broker_rankings(bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_intent_country_rankings_on_intent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_intent_country_rankings_on_broker() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_country_intent_broker_override_availability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_country_ranking_overrides_on_availability_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_country_ranking_override_availability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.replace_broker_country_availability(bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_country_intent_rankings_on_availability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rename_broker_content_documents(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_broker_content_documents_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rename_broker_content_documents_on_slug_change() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.replace_broker_country_availability(bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rename_broker_content_documents(text, text) TO service_role;
