import { Navigate, useParams } from 'react-router-dom';

/**
 * Compatibility redirect for the retired /countries/:countrySlug/guides/:slug
 * namespace. Country guides are now canonical at /:countrySlug/guides/:slug.
 */
export default function LegacyCountryGuideRedirect() {
  const { countrySlug, slug } = useParams<{ countrySlug: string; slug: string }>();

  if (!countrySlug || !slug) return <Navigate to="/" replace />;

  return <Navigate to={`/${encodeURIComponent(countrySlug)}/guides/${encodeURIComponent(slug)}`} replace />;
}
