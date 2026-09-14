import type { ContentDocument } from '../types';
import type { CanonicalRoute } from './types';
import { CANONICAL_BEST_FOR, CANONICAL_BEST_FOR_BY_SLUG } from './registry';
import { fetchBroker, fetchCountry, fetchLocalizedSeoPage } from '../api';

function cleanPath(path: string): string {
  const normalized = `/${path.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '/' : normalized;
}

function route(path: string, input: Omit<CanonicalRoute, 'path' | 'canonicalPath'> & { canonicalPath?: string }): CanonicalRoute {
  return { ...input, path, canonicalPath: input.canonicalPath ?? path };
}

function encode(value: string): string { return encodeURIComponent(value); }

export function canonicalPathForDocument(document: Pick<ContentDocument, 'content_type' | 'country_slug' | 'topic_slug' | 'slug' | 'settings'>): string | null {
  const country = document.country_slug ? encode(document.country_slug) : null;
  const topic = document.topic_slug ? encode(document.topic_slug) : null;
  const slug = document.slug ? encode(document.slug) : null;
  switch (document.content_type) {
    case 'global-best-for': return slug ? `/${slug}` : null;
    case 'country-best-for': return country && slug ? `/${country}/${slug}` : null;
    case 'guide': return slug && !country ? `/guides/${slug}` : null;
    case 'country-guide': return country && slug ? `/${country}/guides/${slug}` : null;
    case 'localized-guide': return country && slug ? `/${country}/${encode(String((document.settings as any)?.locale || (document.settings as any)?.languageCode || ''))}/guides/${slug}` : null;
    case 'broker': return slug ? `/brokers/${slug}` : null;
    case 'country': return country ? `/${country}` : slug ? `/${slug}` : null;
    case 'compare': return slug ? `/compare/${slug}` : null;
    default: return null;
  }
}

export function canonicalContentKeyForDocument(document: Pick<ContentDocument, 'content_type' | 'country_slug' | 'topic_slug' | 'slug'>): string | null {
  const country = document.country_slug || '';
  const slug = document.slug || '';
  switch (document.content_type) {
    case 'global-best-for': return slug ? `best-for:${slug}` : null;
    case 'country-best-for': return country && slug ? `country-best-for:${country}:${slug}` : null;
    case 'guide': return slug ? `guide:${slug}` : null;
    case 'country-guide': return country && slug ? `country-guide:${country}:${slug}` : null;
    case 'localized-guide': return country && slug ? `localized-guide:${country}:${slug}` : null;
    case 'broker': return slug ? `broker:${slug}:main` : null;
    case 'country': return country || slug ? `country:${country || slug}:hub` : null;
    case 'compare': return slug ? `compare:${slug}` : null;
    default: return null;
  }
}

export function resolveStaticCanonicalPath(pathname: string): CanonicalRoute | null {
  const path = cleanPath(pathname);
  const first = path.slice(1);
  const bestForSlug = CANONICAL_BEST_FOR[first as keyof typeof CANONICAL_BEST_FOR];
  if (bestForSlug) return route(path, { type: 'global-best-for', slug: bestForSlug, indexable: true, published: true });
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
    return route(path, { type: 'country', slug, indexable: true, published: country.publishing_state !== 'closed', canonicalPath: `/${encode(slug)}` });
  }

  if (segments.length === 2 && segments[0] === 'guides') {
    const slug = segments[1];
    const document = await fetchPublicContentDocumentByTypeAndSlug('guide', slug);
    if (!document || document.content_type !== 'guide') return null;
    return route(path, { type: 'guide', slug, contentKey: document.content_key, indexable: document.indexable !== false, published: document.published, document });
  }

  if (segments.length === 3 && segments[1] === 'guides') {
    const [countrySlug, , slug] = segments;
    const document = await fetchPublicContentDocumentByTypeAndSlug('country-guide', slug, countrySlug);
    if (!document || document.content_type !== 'country-guide') return null;
    return route(path, { type: 'country-guide', countrySlug, slug, contentKey: document.content_key, indexable: document.indexable !== false, published: document.published, document });
  }

  if (segments.length === 4 && segments[2] === 'guides') {
    const [countrySlug, locale, , slug] = segments;
    const document = await fetchPublicContentDocumentByTypeAndSlug('localized-guide', slug, countrySlug);
    const languageMatches = document && String((document.settings as any)?.languageCode || (document.settings as any)?.locale || '').toLowerCase() === locale.toLowerCase();
    if (!document || document.content_type !== 'localized-guide' || !languageMatches) return null;
    return route(path, { type: 'localized-guide', countrySlug, locale, slug, contentKey: document.content_key, indexable: document.indexable !== false, published: document.published, document });
  }

  if (segments.length === 2 && segments[0] === 'brokers') {
    const slug = segments[1];
    const broker = await fetchBroker(slug).catch(() => null);
    if (!broker) return null;
    return route(path, { type: 'broker', slug, indexable: true, published: true });
  }

  if (segments.length === 3 && segments[1] === 'brokers') {
    const [countrySlug, , slug] = segments;
    const [country, broker] = await Promise.all([fetchCountry(countrySlug).catch(() => null), fetchBroker(slug).catch(() => null)]);
    if (!country || !broker) return null;
    return route(path, { type: 'broker', countrySlug, slug, indexable: true, published: country.publishing_state !== 'closed' });
  }

  if (segments.length === 2 && segments[0] === 'compare') return route(path, { type: 'compare', slug: segments[1], indexable: true, published: true });

  if (segments.length === 3) {
    const [countrySlug, locale, topicSlug] = segments;
    const localized = await fetchLocalizedSeoPage(countrySlug, locale, topicSlug).catch(() => null);
    if (!localized || localized.published === false) return null;
    return route(path, { type: 'localized-seo', countrySlug, slug: topicSlug, topicSlug, locale, indexable: localized.indexable !== false, published: true });
  }

  if (segments.length === 2) {
    const [countrySlug, slug] = segments;
    const countryBestFor = await fetchPublicContentDocumentByKey(`country-best-for:${countrySlug}:${slug}`);
    if (countryBestFor && countryBestFor.content_type === 'country-best-for') {
      return route(path, { type: 'country-best-for', countrySlug, slug, contentKey: countryBestFor.content_key, indexable: countryBestFor.indexable !== false, published: countryBestFor.published, document: countryBestFor });
    }

    const countryGuide = await fetchPublicContentDocumentByKey(`country-guide:${countrySlug}:${slug}`);
    if (countryGuide && countryGuide.content_type === 'country-guide') {
      return route(path, { type: 'country-guide', countrySlug, slug, contentKey: countryGuide.content_key, indexable: countryGuide.indexable !== false, published: countryGuide.published, document: countryGuide, canonicalPath: `/${encode(countrySlug)}/guides/${encode(slug)}` });
    }

    // country-topic is retired and must never own a public URL.
    return null;
  }

  if (segments.length === 1) {
    const slug = segments[0];
    const country = await fetchCountry(slug).catch(() => null);
    if (!country) return null;
    return route(path, { type: 'country', slug, indexable: true, published: country.publishing_state !== 'closed' });
  }
  return null;
}

async function fetchPublicContentDocumentByKey(key: string): Promise<ContentDocument | null> {
  const params = new URLSearchParams({ key });
  const res = await fetch(`/api/public-content?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || Array.isArray(data)) return null;
  return data as ContentDocument;
}

async function fetchPublicContentDocumentByTypeAndSlug(type: string, slug: string, countrySlug?: string): Promise<ContentDocument | null> {
  const params = new URLSearchParams({ type, slug });
  if (countrySlug) params.set('country', countrySlug);
  const res = await fetch(`/api/public-content?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) return null;
  return (Array.isArray(data) ? data[0] : data) as ContentDocument | null;
}

export function globalBestForPath(slug: string): string | null { return CANONICAL_BEST_FOR_BY_SLUG[slug] ?? null; }
export function globalBestForSlugs(): string[] { return Object.values(CANONICAL_BEST_FOR); }
export function canonicalCountryGuidePath(countrySlug: string, slug: string): string { return `/${encode(countrySlug)}/guides/${encode(slug)}`; }
