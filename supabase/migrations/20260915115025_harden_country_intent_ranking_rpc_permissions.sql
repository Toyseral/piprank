CREATE OR REPLACE FUNCTION public.can_manage_ranking()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE lower(au.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND au.active = TRUE
      AND au.role IN ('super_admin', 'admin', 'content_admin', 'brokers_admin')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_ranking() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_ranking() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_ranking() FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_country_intent_ranking_mode(p_country_id BIGINT, p_intent_id BIGINT)
RETURNS TEXT LANGUAGE SQL STABLE SET search_path = public AS $$
  SELECT COALESCE((SELECT ranking_mode FROM public.country_intent_ranking_config WHERE country_id = p_country_id AND intent_id = p_intent_id), 'automatic');
$$;
REVOKE EXECUTE ON FUNCTION public.get_country_intent_ranking_mode(BIGINT,BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_country_intent_ranking_mode(BIGINT,BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_country_intent_ranking_mode(BIGINT,BIGINT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_country_intent_ranking_mode(BIGINT,BIGINT,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_country_intent_ranking_mode(BIGINT,BIGINT,TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_country_intent_ranking_mode(BIGINT,BIGINT,TEXT) TO authenticated;
