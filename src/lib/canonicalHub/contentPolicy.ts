import type { ContentDocument } from '../types';

export const CANONICAL_CONTENT_TYPES = [
  'global-best-for', 'country-best-for', 'guide', 'country-guide', 'broker', 'country', 'compare', 'localized-seo',
] as const;

export type CanonicalContentType = typeof CANONICAL_CONTENT_TYPES[number];

export function canonicalContentKey(type: CanonicalContentType, countrySlug: string | null | undefined, slug: string): string {
  const s = slug.trim();
  if (type === 'country-guide') return `country-guide:${countrySlug}:${s}`;
  if (type === 'country-best-for') return `country-best-for:${countrySlug}:${s}`;
  if (type === 'global-best-for') return `best-for:${s}`;
  if (type === 'country') return `country:${countrySlug || s}:hub`;
  if (type === 'broker') return `broker:${s}:main`;
  if (type === 'guide') return `guide:${s}`;
  if (type === 'compare') return `compare:${s}`;
  return `${type}:${countrySlug ? `${countrySlug}:` : ''}${s}`;
}

export function isCanonicalDocument(doc: Pick<ContentDocument, 'content_type'>): boolean {
  return (CANONICAL_CONTENT_TYPES as readonly string[]).includes(doc.content_type);
}
