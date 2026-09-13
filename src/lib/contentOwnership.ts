/**
 * Canonical content ownership contract.
 *
 * Every indexable page must have exactly one canonical owner. Legacy
 * `country-topic` and the old `country_best_for` table are migration-only;
 * canonical country Best-For pages live in content_documents.
 */
export const CANONICAL_CONTENT_TYPES = [
  'country',
  'country-guide',
  'country-best-for',
  'global-best-for',
  'guide',
  'broker',
  'compare',
] as const;

export type CanonicalContentType = (typeof CANONICAL_CONTENT_TYPES)[number];

export const LEGACY_CONTENT_TYPES = [
  'country-topic',
  'localized-seo-page',
] as const;

export type LegacyContentType = (typeof LEGACY_CONTENT_TYPES)[number];

export const ALL_KNOWN_CONTENT_TYPES = [
  ...CANONICAL_CONTENT_TYPES,
  ...LEGACY_CONTENT_TYPES,
] as const;

export function isCanonicalContentType(value: string): value is CanonicalContentType {
  return (CANONICAL_CONTENT_TYPES as readonly string[]).includes(value);
}

export function isLegacyContentType(value: string): value is LegacyContentType {
  return (LEGACY_CONTENT_TYPES as readonly string[]).includes(value);
}

export function isKnownContentType(value: string): value is (typeof ALL_KNOWN_CONTENT_TYPES)[number] {
  return (ALL_KNOWN_CONTENT_TYPES as readonly string[]).includes(value);
}

export function isCanonicalContentKey(contentType: string, contentKey: string): boolean {
  if (!isCanonicalContentType(contentType)) return false;

  switch (contentType) {
    case 'country':
      return /^country:[a-z0-9-]+:hub$/.test(contentKey);
    case 'country-guide':
      return /^country-guide:[a-z0-9-]+:[a-z0-9-]+$/.test(contentKey);
    case 'country-best-for':
      return /^country-best-for:[a-z0-9-]+:[a-z0-9-]+$/.test(contentKey);
    case 'global-best-for':
      return /^best-for:[a-z0-9-]+$/.test(contentKey);
    case 'guide':
      return /^guide:[a-z0-9-]+$/.test(contentKey);
    case 'broker':
      return /^broker:[a-z0-9-]+:(?:[a-z0-9-]+)$/.test(contentKey);
    case 'compare':
      return /^compare:[a-z0-9-]+:[a-z0-9-]+$/.test(contentKey);
    default:
      return false;
  }
}
