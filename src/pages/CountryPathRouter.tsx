import { Navigate, useParams } from 'react-router-dom';

/**
 * Compatibility handler for the retired two-segment country-topic route.
 * Canonical resolution now owns published country Best-For URLs; this
 * component must never render the retired CountrySeoTopic template.
 */
export default function CountryPathRouter() {
  const { countrySlug, topicSlug } = useParams<{ countrySlug: string; topicSlug: string }>();
  if (countrySlug && topicSlug) return <Navigate to={`/${countrySlug}/guides/${topicSlug}`} replace />;
  return <Navigate to="/countries" replace />;
}
