/**
 * Shared mapping between internal intent slugs and public URL paths.
 *
 * Internal DB/Admin slugs stay short (e.g. "beginners").
 * Public URLs use descriptive paths (e.g. "forex-brokers-for-beginners").
 * Country-first topic pages already use the same public paths under /:country/.
 */

/** intent slug → public path segment (no leading slash) */
export const INTENT_TO_PATH: Record<string, string> = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  mt5: 'mt5-forex-brokers',
  mt4: 'mt4-forex-brokers',
  gold: 'gold-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  islamic: 'islamic-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
  'low-deposit': 'low-minimum-deposit-forex-brokers',
};

/** public path segment → intent slug */
export const PATH_TO_INTENT: Record<string, string> = Object.fromEntries(
  Object.entries(INTENT_TO_PATH).map(([intent, path]) => [path, intent]),
);

export const GLOBAL_TOPIC_PATHS = Object.values(INTENT_TO_PATH);

export function isGlobalTopicPath(segment: string): boolean {
  return Boolean(PATH_TO_INTENT[segment]);
}

/** Public path for a global intent ranking page */
export function globalIntentPath(intentSlug: string): string {
  const path = INTENT_TO_PATH[intentSlug] ?? intentSlug;
  return `/${path}`;
}

/** Public path for a country topic ranking page */
export function countryTopicPath(countrySlug: string, intentSlug: string): string {
  const path = INTENT_TO_PATH[intentSlug] ?? intentSlug;
  return `/${countrySlug}/${path}`;
}

/**
 * Resolve the internal intent slug from a URL.
 * Supports:
 * - /best/beginners
 * - /forex-brokers-for-beginners
 * - /countries/x/best/beginners (param slug)
 */
export function resolveIntentSlugFromLocation(
  pathname: string,
  paramSlug?: string,
): string | undefined {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);

  if (parts[0] === 'best' && parts[1]) {
    return parts[1];
  }

  if (parts[0] === 'countries' && parts[2] === 'best' && parts[3]) {
    return parts[3];
  }

  // Flat global: /forex-brokers-for-beginners
  if (parts.length === 1 && PATH_TO_INTENT[parts[0]]) {
    return PATH_TO_INTENT[parts[0]];
  }

  // Country-first topic is handled by CountrySeoTopic, not BestFor.
  // Fallback to router param (legacy /best/:slug or country best-for).
  if (paramSlug) {
    return PATH_TO_INTENT[paramSlug] ?? paramSlug;
  }

  return undefined;
}
