/**
 * Canonical intent identity used by content/ranking systems.
 * Broker.best_for historically stores short taxonomy slugs; this map keeps
 * that storage compatible while exposing one canonical identity to editors.
 */
export const BROKER_INTENT_STORAGE_SLUGS: Record<string, string> = {
  'forex-brokers-for-beginners': 'beginners',
  'low-spread-forex-brokers': 'low-spread',
  'mt4-forex-brokers': 'mt4',
  'mt5-forex-brokers': 'mt5',
  'gold-forex-brokers': 'gold',
  'ecn-forex-brokers': 'ecn',
  'copy-trading-forex-brokers': 'copy-trading',
  'forex-brokers-for-scalping': 'scalping',
  'forex-brokers-for-swing-trading': 'swing-trading',
  'high-leverage-forex-brokers': 'high-leverage',
  'islamic-forex-brokers': 'islamic',
  'crypto-brokers': 'crypto-brokers',
  'eur-usd-forex-brokers': 'eur-usd-forex-brokers',
};

export function brokerIntentStorageSlug(canonicalSlug: string): string {
  return BROKER_INTENT_STORAGE_SLUGS[canonicalSlug] ?? canonicalSlug;
}

export function brokerHasIntent(bestFor: string[] | null | undefined, canonicalSlug: string): boolean {
  return (bestFor ?? []).includes(brokerIntentStorageSlug(canonicalSlug));
}
export const CANONICAL_INTENT_SLUGS: Record<string, string> = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  gold: 'gold-forex-brokers',
  crypto: 'crypto-brokers',
  'eur-usd': 'eur-usd-forex-brokers',
  mt4: 'mt4-forex-brokers',
  mt5: 'mt5-forex-brokers',
  gold: 'gold-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
  islamic: 'islamic-forex-brokers',
};

export function canonicalIntentSlug(slug: string): string {
  const normalized = String(slug || '').trim().toLowerCase();
  return CANONICAL_INTENT_SLUGS[normalized] ?? normalized;
}

export function isCanonicalIntentSlug(slug: string): boolean {
  const normalized = String(slug || '').trim().toLowerCase();
  return normalized === canonicalIntentSlug(normalized);
}
