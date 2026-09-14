import type { ContentDocument } from '../types';

/**
 * Canonical page owners. Each type owns exactly one URL namespace.
 *
 * Country editorial content is deliberately separate from commercial
 * Best-For content: /:country/guides/:slug vs /:country/:slug.
 */
export type CanonicalContentType =
  | 'global-best-for'
  | 'country-best-for'
  | 'guide'
  | 'country-guide'
  | 'broker'
  | 'country'
  | 'compare'
  | 'localized-seo';

export interface CanonicalRoute {
  type: CanonicalContentType;
  path: string;
  canonicalPath: string;
  contentKey?: string;
  countrySlug?: string;
  topicSlug?: string;
  slug?: string;
  indexable: boolean;
  published: boolean;
  document?: ContentDocument | null;
}

export type CanonicalResolution =
  | { status: 'loading' }
  | { status: 'resolved'; route: CanonicalRoute }
  | { status: 'missing'; path: string };
