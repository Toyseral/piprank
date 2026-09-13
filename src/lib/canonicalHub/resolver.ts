import type { CanonicalRoute } from './types';

const GLOBAL_BEST_FOR: Record<string, string> = {
  'forex-brokers-for-beginners': 'beginners',
  'low-spread-forex-brokers': 'low-spread',
  'mt4-forex-brokers': 'mt4',
  'mt5-forex-brokers': 'mt5',
  'gold-forex-brokers': 'gold',
  'forex-brokers-for-scalping': 'scalping',
  'islamic-forex-brokers': 'islamic',
  'ecn-forex-brokers': 'ecn',
  'copy-trading-forex-brokers': 'copy-trading',
  'forex-brokers-for-swing-trading': 'swing-trading',
  'high-leverage-forex-brokers': 'high-leverage',
};

const GLOBAL_BEST_FOR_BY_SLUG = Object.fromEntries(
  Object.entries(GLOBAL_BEST_FOR).map(([path, slug]) => [slug, path]),
);

function cleanPath(path: string): string {
  const normalized = `/${path.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '/' : normalized;
}

function route(path: string, input: Omit<CanonicalRoute, 'path' | 'canonicalPath'>): CanonicalRoute {
  return { ...input, path, canonicalPath: path };
}

export function resolveStaticCanonicalPath(pathname: string): CanonicalRoute | null {
  const path = cleanPath(pathname);

  if (GLOBAL_BEST_FOR[path.slice(1)]) {
    const slug = GLOBAL_BEST_FOR[path.slice(1)];
    return route(path, {
      type: 'global-best-for',
      slug,
      indexable: true,
      published: true,
    });
  }

  if (path === '/guides') {
    return route(path, { type: 'guide', indexable: true, published: true });
  }

  if (path === '/countries') {
    return route(path, { type: 'country', indexable: true, published: true });
  }

  if (path === '/brokers') {
    return route(path, { type: 'broker', indexable: true, published: true });
  }

  if (path === '/compare') {
    return route(path, { type: 'compare', indexable: true, published: true });
  }

  return null;
}

export function globalBestForPath(slug: string): string | null {
  return GLOBAL_BEST_FOR_BY_SLUG[slug] ?? null;
}

export function globalBestForSlugs(): string[] {
  return Object.values(GLOBAL_BEST_FOR);
}

export function canonicalCountryTopicPath(countrySlug: string, topicSlug: string): string {
  return `/${encodeURIComponent(countrySlug)}/${encodeURIComponent(topicSlug)}`;
}

export function canonicalCountryGuidePath(countrySlug: string, slug: string): string {
  return `/${encodeURIComponent(countrySlug)}/guides/${encodeURIComponent(slug)}`;
}
