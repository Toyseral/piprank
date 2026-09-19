-- Reviews must be created and moderated through api/reviews.js.
-- Direct PostgREST writes bypass API validation, spam controls and moderation.

DROP POLICY IF EXISTS reviews_public_insert ON public.reviews;
DROP POLICY IF EXISTS reviews_public_update ON public.reviews;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.reviews FROM anon, authenticated;
GRANT SELECT ON TABLE public.reviews TO anon, authenticated;

-- This helper is evaluated by authenticated ranking RLS policies.
GRANT EXECUTE ON FUNCTION public.can_manage_ranking() TO authenticated;
