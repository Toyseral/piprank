import type { CanonicalRoute } from './types';
import { CANONICAL_BEST_FOR, CANONICAL_BEST_FOR_BY_SLUG } from './registry';
import { fetchContentDocument, fetchCountry } from '../api';

function cleanPath(path: string): string {
  const normalized = `/${path.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '/' : normalized;
}

function route(path: string, input: Omit<CanonicalRoute, 'path' | 'canonicalPath'>): CanonicalRoute {
  return { ...input, path, canonicalPath: path };
}

export function resolveStaticCanonicalPath(pathname: string): CanonicalRoute | null {
  const path = cleanPath(pathname);
  const first = path.slice(1);

  if (CANONICAL_BEST_FOR[first]) {
    return route(path, {
      type: 'global-best-for',
      slug: CANONICAL_BEST_FOR[first],
      indexable: true,
      published: true,
    });
  }

  if (path === '/guides') return route(path, { type: 'guide', indexable: true, published: true });
  if (path === '/countries') return route(path, { type: 'country', indexable: true, published: true });
  if (path === '/brokers') return route(path, { type: 'broker', indexable: true, published: true });
  if (path === '/compare') return route(path, { type: 'compare', indexable: true, published: true });

  return null;
}

export async function resolveCanonicalPath(pathname: string): Promise<CanonicalRoute | null> {
  const path = cleanPath(pathname);
  const staticRoute = resolveStaticCanonicalPath(path);
  if (staticRoute) return staticRoute;

  const segments = path.slice(1).split('/').filter(Boolean).map(decodeURIComponent);

  if (segments.length === 2 && segments[0] === 'countries') {
    const slug = segments[1];
    const country = await fetchCountry(slug).catch(() => null);
    if (!country) return null;
    return route(path, {
      type: 'country',
      slug,
      indexable: true,
      published: country.publishing_state !== 'closed',
    });
  }

  if (segments.length === 2 && segments[0] === 'guides') {
    const slug = segments[1];
    const document = await fetchContentDocumentByTypeAndSlug('guide', slug);
    if (!document || document.content_type !== 'guide' || document.published === false) return null;
    return route(path, {
      type: 'guide',
      slug,
      contentKey: document.content_key,
      indexable: document.indexable !== false,
      published: document.published,
      document,
    });
  }

  if (segments.length === 3 && segments[1] === 'guides') {
    const [countrySlug, , slug] = segments;
    const document = await fetchContentDocumentByTypeAndSlug('country-guide', slug, countrySlug);
    if (!document || document.content_type !== 'country-guide' || document.published === false) return null;
    return route(path, {
      type: 'country-guide',
      countrySlug,
      slug,
      contentKey: document.content_key,
      indexable: document.indexable !== false,
      published: document.published,
      document,
    });
  }

  if (segments.length === 2 && segments[0] === 'brokers') {
    return route(path, {
      type: 'broker',
      slug: segments[1],
      indexable: true,
      published: true,
    });
  }

  if (segments.length === 3 && segments[1] === 'brokers') {
    return route(path, {
      type: 'broker',
      countrySlug: segments[0],
      slug: segments[2],
      indexable: true,
      published: true,
    });
  }

  if (segments.length === 2 && segments[0] === 'compare') {
    return route(path, {
      type: 'compare',
      slug: segments[1],
      indexable: true,
      published: true,
    });
  }

  if (segments.length === 3) {
    return route(path, {
      type: 'localized-seo',
      countrySlug: segments[0],
      slug: segments[2],
      topicSlug: segments[2],
      indexable: true,
      published: true,
    });
  }

  if (segments.length === 2) {
    const [countrySlug, topicSlug] = segments;
    const document = await fetchContentDocumentByKey(`country-topic:${countrySlug}:${topicSlug}`);
    if (!document || document.content_type !== 'country-topic' || document.published === false) return null;
    return route(path, {
      type: 'country-topic',
      countrySlug,
      topicSlug,
      slug: topicSlug,
      contentKey: document.content_key,
      indexable: document.indexable !== false,
      published: document.published,
      document,
    });
  }

  if (segments.length === 1) {
    const slug = segments[0];
    const country = await fetchCountry(slug).catch(() => null);
    if (!country) return null;
    return route(path, {
      type: 'country',
      slug,
      indexable: true,
      published: country.publishing_state !== 'closed',
    });
  }

  return null;
}

async function fetchContentDocumentByKey(key: string) {
  return fetchContentDocument(key).catch(() => null);
}

async function fetchContentDocumentByTypeAndSlug(type: string, slug: string, countrySlug?: string) {
  const params = new URLSearchParams({ type, slug });
  if (countrySlug) params.set('country', countrySlug);
  const res = await fetch(`/api/content-documents?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export function globalBestForPath(slug: string): string | null {
  return CANONICAL_BEST_FOR_BY_SLUG[slug] ?? null;
}

export function globalBestForSlugs(): string[] {
  return Object.values(CANONICAL_BEST_FOR);
}

export function canonicalCountryTopicPath(countrySlug: string, topicSlug: string): string {
  return `/${encodeURIComponent(countrySlug)}/${encodeURIComponent(topicSlug)}`;
}

export function canonicalCountryGuidePath(countrySlug: string, slug: string): string {
  return `/${encodeURIComponent(countrySlug)}/guides/${encodeURIComponent(slug)}`;
}
