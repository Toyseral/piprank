import { Navigate, useParams } from 'react-router-dom';
import CountrySeoTopic from './CountrySeoTopic';
import { getCountrySeoTopic } from '../data/countrySeoTopics';

/**
 * Two-segment country URLs are reserved for country commercial topics.
 * Older admin guide previews used /:country/:guide-slug, so unknown topic
 * slugs are redirected to the canonical country guide namespace instead of
 * rendering an empty/404 commercial page.
 */
export default function CountryPathRouter() {
  const { countrySlug, topicSlug } = useParams<{ countrySlug: string; topicSlug: string }>();
  if (topicSlug && getCountrySeoTopic(topicSlug)) return <CountrySeoTopic />;
  if (countrySlug && topicSlug) return <Navigate to={`/${countrySlug}/guides/${topicSlug}`} replace />;
  return <Navigate to="/countries" replace />;
}
