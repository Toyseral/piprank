import type { ContentDocument } from '../types';
import type { CanonicalRoute } from './types';
import { CANONICAL_BEST_FOR, CANONICAL_BEST_FOR_BY_SLUG } from './registry';
import { fetchBroker, fetchContentDocument, fetchCountry, fetchLocalizedSeoPage } from '../api';

function cleanPath(path: string): string {
  const normalized = `/${path.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '/' : normalized;
}

function route(path: string, input: Omit<CanonicalRoute, 'path' | 'canonicalPath'>): CanonicalRoute {
  return { ...input, path, canonicalPath: path };
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

/** Single source of truth for how an editable content document maps to a public URL. */
export function canonicalPathForDocument(document: Pick<ContentDocument, 'content_type' | 'country_slug' | 'topic_slug' | 'slug'>): string | null {
  const country = document.country_slug ? encode(document.country_slug) : null;
  const topic = document.topic_slug ? encode(document.topic_slug) : null;
  const slug = document.slug ? encode(document.slug) : null;

  switch (document.content_type) {
    case 'guide':
      return slug && !country ? `/guides/${slug}` : null;
    case 'country-guide':
      return country && slug ? `/${country}/guides/${slug}` : null;
    case 'country-topic':
      return country && (topic || slug) ? `/${country}/${topic || slug}` : null;
    case 'broker':
      return slug ? `/brokers/${slug}` : null;
    case 'country':
      return country ? `/${country}` : slug ? `/${slug}` : null;
    case 'compare':
      return slug ? `/compare/${slug}` : null;
    default:
      return null;
  }
}

/** Single source of truth for content identity when creating a new canonical document. */
export function canonicalContentKeyForDocument(document: Pick<ContentDocument, 'content_type' | 'country_slug' | 'topic_slug' | 'slug'>): string | null {
  const country = document.country_slug || '';
  const topic = document.topic_slug || document.slug || '';
  const slug = document.slug || '';

  switch (document.content_type) {
    case 'guide':
      return slug ? `guide:${slug}` : null;
    case 'country-guide':
      return country && slug ? `country-guide:${country}:${slug}` : null;
    case 'country-topic':
      return country && topic ? `country-topic:${country}:${topic}` : null;
    case 'broker':
      return slug ? `broker:${slug}:main` : null;
    case 'country':
      return country || slug ? `country:${country || slug}:hub` : null;
    case 'compare':
      return slug ? `compare:${slug}` : null;
    default:
      return null;
  }
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
    const slug = segments[1];
    const broker = await fetchBroker(slug).catch(() => null);
    if (!broker) return null;
    return route(path, {
      type: 'broker',
      slug,
      indexable: true,
      published: true,
    });
  }

  if (segments.length === 3 && segments[1] === 'brokers') {
    const [countrySlug, , slug] = segments;
    const [country, broker] = await Promise.all([
      fetchCountry(countrySlug).catch(() => null),
      fetchBroker(slug).catch(() => null),
    ]);
    if (!country || !broker) return null;
    return route(path, {
      type: 'broker',
      countrySlug,
      slug,
      indexable: true,
      published: country.publishing_state !== 'closed',
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
    const [countrySlug, locale, topicSlug] = segments;
    const localized = await fetchLocalizedSeoPage(countrySlug, locale, topicSlug).catch(() => null);
    const legacyVietnamese = countrySlug === 'vietnam' && locale === 'vi';
    if (!localized && !legacyVietnamese) return null;
    return route(path, {
      type: 'localized-seo',
      countrySlug,
      slug: topicSlug,
      topicSlug,
      indexable: localized?.indexable !== false,
      published: localized?.published !== false,
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
  return `/${encode(countrySlug)}/${encode(topicSlug)}`;
}

export function canonicalCountryGuidePath(countrySlug: string, slug: string): string {
  return `/${encode(countrySlug)}/guides/${encode(slug)}`;
}
