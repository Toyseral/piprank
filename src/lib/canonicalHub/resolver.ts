import type { ContentDocument } from '../types';
import type { CanonicalRoute } from './types';
import { CANONICAL_BEST_FOR, CANONICAL_BEST_FOR_BY_SLUG } from './registry';
import { fetchBroker, fetchCountry } from '../api';
import { canonicalPathForDocument, canonicalKeyForDocument, encodeSegment, localeOf } from '../canonical-route-registry.mjs';

function cleanPath(path: string): string { const normalized = `/${path.replace(/^\\/+|\\/+$/g, '')}`; return normalized === '/' ? '/' : normalized; }
function route(path: string, input: Omit<CanonicalRoute, 'path' | 'canonicalPath'> & { canonicalPath?: string }): CanonicalRoute { return { ...input, path, canonicalPath: input.canonicalPath ?? path }; }
function encode(value: string): string { return encodeSegment(value); }
export { canonicalPathForDocument, canonicalKeyForDocument };
export const canonicalContentKeyForDocument = canonicalKeyForDocument;

function isPublishedCountry(country: any): boolean { return country?.publishing_state === 'published'; }

export function resolveStaticCanonicalPath(pathname: string): CanonicalRoute | null {
  const path = cleanPath(pathname);
  if (path === '/guides') return route(path, { type: 'guide', indexable: true, published: true });
  if (path === '/countries') return route(path, { type: 'country', indexable: true, published: true });
  if (path === '/brokers') return route(path, { type: 'broker', indexable: true, published: true });
  if (path === '/compare') return route(path, { type: 'compare', indexable: true, published: true });
  return null;
}

export async function resolveCanonicalPath(pathname: string): Promise<CanonicalRoute | null> {
  const path = cleanPath(pathname); const staticRoute = resolveStaticCanonicalPath(path); if (staticRoute) return staticRoute;
  const segments = path.slice(1).split('/').filter(Boolean).map(decodeURIComponent);

  if (segments.length === 2 && segments[0] === 'countries') {
    const slug = segments[1]; const country = await fetchCountry(slug).catch(() => null); if (!country || !isPublishedCountry(country)) return null;
    return route(path, { type: 'country', slug, indexable: true, published: true, canonicalPath: `/${encode(slug)}` });
  }
  if (segments.length === 2 && segments[0] === 'guides') {
    const slug = segments[1]; const document = await fetchPublicContentDocumentByTypeAndSlug('guide', slug);
    if (!document || document.content_type !== 'guide' || document.published === false) return null;
    return route(path, { type: 'guide', slug, contentKey: document.content_key, indexable: document.indexable !== false, published: document.published, document });
  }
  if (segments.length === 3 && segments[1] === 'guides') {
    const [countrySlug, , slug] = segments; const [country, document] = await Promise.all([fetchCountry(countrySlug).catch(() => null), fetchPublicContentDocumentByTypeAndSlug('country-guide', slug, countrySlug)]);
    if (!country || !isPublishedCountry(country) || !document || document.content_type !== 'country-guide' || document.published === false) return null;
    return route(path, { type: 'country-guide', countrySlug, slug, contentKey: document.content_key, indexable: document.indexable !== false, published: document.published, document });
  }
  if (segments.length === 4 && segments[2] === 'guides') {
    const [countrySlug, locale, , slug] = segments; const country = await fetchCountry(countrySlug).catch(() => null); const document = await fetchPublicContentDocumentByKey(canonicalKeyForDocument({ content_type: 'localized-guide', country_slug: countrySlug, slug, settings: { locale } })!);
    if (!country || !isPublishedCountry(country) || !document || document.content_type !== 'localized-guide' || localeOf(document).toLowerCase() !== locale.toLowerCase() || document.published === false) return null;
    return route(path, { type: 'localized-guide', countrySlug, locale, slug, contentKey: document.content_key, indexable: document.indexable !== false, published: document.published, document });
  }
  if (segments.length === 3) {
    const [countrySlug, locale, slug] = segments; const country = await fetchCountry(countrySlug).catch(() => null); const document = await fetchPublicContentDocumentByKey(canonicalKeyForDocument({ content_type: 'localized-best-for', country_slug: countrySlug, slug, settings: { locale } })!);
    if (!country || !isPublishedCountry(country) || !document || document.content_type !== 'localized-best-for' || localeOf(document).toLowerCase() !== locale.toLowerCase() || document.published === false) return null;
    return route(path, { type: 'localized-best-for', countrySlug, locale, slug, topicSlug: document.topic_slug || slug, contentKey: document.content_key, indexable: document.indexable !== false, published: document.published, document });
  }
  if (segments.length === 2 && segments[0] === 'brokers') {
    const slug = segments[1]; const broker = await fetchBroker(slug).catch(() => null); if (!broker) return null;
    return route(path, { type: 'broker', slug, indexable: true, published: true });
  }
  if (segments.length === 3 && segments[1] === 'brokers') {
    const [countrySlug, , slug] = segments; const [country, broker] = await Promise.all([fetchCountry(countrySlug).catch(() => null), fetchBroker(slug).catch(() => null)]);
    if (!country || !isPublishedCountry(country) || !broker) return null;
    return route(path, { type: 'broker', countrySlug, slug, indexable: true, published: true });
  }
  if (segments.length === 2 && segments[0] === 'compare') return route(path, { type: 'compare', slug: segments[1], indexable: true, published: true });

  if (segments.length === 2) {
    const [countrySlug, slug] = segments; const [country, countryBestFor] = await Promise.all([fetchCountry(countrySlug).catch(() => null), fetchPublicContentDocumentByKey(canonicalKeyForDocument({ content_type: 'country-best-for', country_slug: countrySlug, slug })!)]);
    if (!country || !isPublishedCountry(country) || !countryBestFor || countryBestFor.content_type !== 'country-best-for' || countryBestFor.published === false) return null;
    return route(path, { type: 'country-best-for', countrySlug, slug, contentKey: countryBestFor.content_key, indexable: countryBestFor.indexable !== false, published: countryBestFor.published, document: countryBestFor });
  }
  if (segments.length === 1) {
    const slug = segments[0]; const bestForDocument = await fetchPublicContentDocumentByKey(canonicalKeyForDocument({ content_type: 'global-best-for', slug })!);
    if (bestForDocument && bestForDocument.content_type === 'global-best-for' && bestForDocument.published !== false) return route(path, { type: 'global-best-for', slug, contentKey: bestForDocument.content_key, indexable: bestForDocument.indexable !== false, published: bestForDocument.published, document: bestForDocument });
    const country = await fetchCountry(slug).catch(() => null); if (!country || !isPublishedCountry(country)) return null;
    return route(path, { type: 'country', slug, indexable: true, published: true });
  }
  return null;
}

async function fetchPublicContentDocumentByKey(key: string): Promise<ContentDocument | null> {
  const res = await fetch(`/api/public-content?${new URLSearchParams({ key }).toString()}`); const data = await res.json().catch(() => null); if (!res.ok || !data || Array.isArray(data)) return null; return data as ContentDocument;
}
async function fetchPublicContentDocumentByTypeAndSlug(type: string, slug: string, countrySlug?: string): Promise<ContentDocument | null> {
  const params = new URLSearchParams({ type, slug }); if (countrySlug) params.set('country', countrySlug);
  const res = await fetch(`/api/public-content?${params.toString()}`); const data = await res.json().catch(() => null); if (!res.ok || !data) return null; return (Array.isArray(data) ? data[0] : data) as ContentDocument | null;
}
export function globalBestForPath(slug: string): string | null { return CANONICAL_BEST_FOR_BY_SLUG[slug] ?? null; }
export function globalBestForSlugs(): string[] { return Object.values(CANONICAL_BEST_FOR); }
export function canonicalCountryGuidePath(countrySlug: string, slug: string): string { return `/${encode(countrySlug)}/guides/${encode(slug)}`; }
