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

const CANONICAL_SLUGS = new Set(Object.values(LEGACY_TO_CANONICAL));

export default function LegacyBestForRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const canonical = slug
    ? LEGACY_TO_CANONICAL[slug] || (CANONICAL_SLUGS.has(slug) ? slug : undefined)
    : undefined;
  if (!canonical) return <Navigate to="/" replace />;
  return <Navigate to={`/${canonical}`} replace />;
}
