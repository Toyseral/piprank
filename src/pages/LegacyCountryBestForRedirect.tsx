import { Navigate, useParams } from 'react-router-dom';

const LEGACY_TO_CANONICAL: Record<string, string> = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  mt5: 'mt5-forex-brokers',
  gold: 'gold-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  islamic: 'islamic-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
};

export default function LegacyCountryBestForRedirect() {
  const { countrySlug, slug } = useParams<{ countrySlug: string; slug: string }>();
  const canonical = slug ? LEGACY_TO_CANONICAL[slug] : undefined;
  if (!countrySlug || !canonical) return <Navigate to="/countries" replace />;
  return <Navigate to={`/${countrySlug}/${canonical}`} replace />;
}
