/**
 * Shared canonical route registry.
 *
 * This module is dependency-free so both Vite/runtime code and Node build
 * scripts use the same content-type -> key -> URL rules.
 */
export const CANONICAL_CONTENT_TYPES = Object.freeze([
  'guide',
  'global-best-for',
  'country-guide',
  'country-best-for',
  'localized-guide',
  'localized-best-for',
  'broker',
  'country',
  'compare',
]);

export const RETIRED_CONTENT_TYPES = Object.freeze(['country-topic', 'localized-seo']);

export const STATIC_PATHS = Object.freeze([
  '/',
  '/brokers',
  '/countries',
  '/compare',
  '/guides',
  '/methodology',
  '/quiz',
  '/tools',
  '/promotions',
  '/about',
  '/authors',
]);

const CANONICAL_SET = new Set(CANONICAL_CONTENT_TYPES);
const RETIRED_SET = new Set(RETIRED_CONTENT_TYPES);

export function isCanonicalContentType(type) {
  return CANONICAL_SET.has(String(type || '').trim().toLowerCase());
}

export function isRetiredContentType(type) {
  return RETIRED_SET.has(String(type || '').trim().toLowerCase());
}

export function cleanSlug(value) {
  return String(value || '').trim().toLowerCase();
}

export function localeOf(document) {
  const settings = document?.settings || {};
  const explicit = String(settings.locale || settings.languageCode || '').trim();
  if (explicit) return explicit.toLowerCase();
  const key = String(document?.content_key || '').trim().toLowerCase();
  const match = key.match(/^localized-(?:guide|best-for):[^:]+:([^:]+):/);
  return match ? match[1] : '';
}

export function encodeSegment(value) {
  return encodeURIComponent(String(value || '').trim());
}

export function canonicalKeyForDocument(document) {
  const type = cleanSlug(document?.content_type);
  const country = cleanSlug(document?.country_slug);
  const slug = cleanSlug(document?.slug);
  const locale = localeOf(document);

  switch (type) {
    case 'guide': return slug && !country ? `guide:${slug}` : null;
    case 'global-best-for': return slug && !country ? `best-for:${slug}` : null;
    case 'country-guide': return country && slug ? `country-guide:${country}:${slug}` : null;
    case 'country-best-for': return country && slug ? `country-best-for:${country}:${slug}` : null;
    case 'localized-guide': return country && locale && slug ? `localized-guide:${country}:${locale}:${slug}` : null;
    case 'localized-best-for': return country && locale && slug ? `localized-best-for:${country}:${locale}:${slug}` : null;
    case 'broker': return slug ? `broker:${slug}:main` : null;
    case 'country': return country || slug ? `country:${country || slug}:hub` : null;
    case 'compare': return slug ? `compare:${slug}` : null;
    default: return null;
  }
}

export function canonicalPathForDocument(document) {
  const type = cleanSlug(document?.content_type);
  const country = cleanSlug(document?.country_slug);
  const slug = cleanSlug(document?.slug);
  const locale = localeOf(document);
  switch (type) {
    case 'guide': return slug && !country ? `/guides/${encodeSegment(slug)}` : null;
    case 'global-best-for': return slug && !country ? `/${encodeSegment(slug)}` : null;
    case 'country-guide': return country && slug ? `/${encodeSegment(country)}/guides/${encodeSegment(slug)}` : null;
    case 'country-best-for': return country && slug ? `/${encodeSegment(country)}/${encodeSegment(slug)}` : null;
    case 'localized-guide': return country && locale && slug ? `/${encodeSegment(country)}/${encodeSegment(locale)}/guides/${encodeSegment(slug)}` : null;
    case 'localized-best-for': return country && locale && slug ? `/${encodeSegment(country)}/${encodeSegment(locale)}/${encodeSegment(slug)}` : null;
    case 'broker': return slug ? `/brokers/${encodeSegment(slug)}` : null;
    case 'country': return country || slug ? `/${encodeSegment(country || slug)}` : null;
    case 'compare': return slug ? `/compare/${encodeSegment(slug)}` : null;
    default: return null;
  }
}

export function retiredKeyMatches(key) {
  const value = String(key || '').trim().toLowerCase();
  return RETIRED_CONTENT_TYPES.some((type) => value.startsWith(`${type}:`));
}
