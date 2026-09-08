export const CANONICAL_GLOBAL_BEST_FOR = [
  '/forex-brokers-for-beginners',
  '/mt4-forex-brokers',
  '/mt5-forex-brokers',
  '/gold-forex-brokers',
  '/low-spread-forex-brokers',
  '/forex-brokers-for-scalping',
  '/islamic-forex-brokers',
  '/ecn-forex-brokers',
  '/copy-trading-forex-brokers',
  '/forex-brokers-for-swing-trading',
  '/high-leverage-forex-brokers',
] as const;

export const LEGACY_GLOBAL_BEST_FOR = CANONICAL_GLOBAL_BEST_FOR.map((path) => `/best/${path.slice(1).replace(/-forex-brokers|-for-beginners/g, '')}`);

export function isCanonicalGlobalBestForPath(pathname: string) {
  return (CANONICAL_GLOBAL_BEST_FOR as readonly string[]).includes(pathname);
}
