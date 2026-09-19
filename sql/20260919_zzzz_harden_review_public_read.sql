-- Public clients must not read unmoderated reviews directly from Supabase.
-- api/reviews.js already exposes only verified reviews to public GET requests.

DROP POLICY IF EXISTS reviews_public_read ON public.reviews;
CREATE POLICY reviews_public_read
  ON public.reviews
  FOR SELECT
  TO public
  USING (verified = true);
