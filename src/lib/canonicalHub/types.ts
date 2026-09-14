import type { ContentDocument } from '../types';

export type CanonicalContentType =
  | 'global-best-for'
  | 'country-topic'
  | 'guide'
  | 'country-guide'
  | 'localized-guide'
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
  locale?: string;
  indexable: boolean;
  published: boolean;
  document?: ContentDocument | null;
}

export type CanonicalResolution =
  | { status: 'loading' }
  | { status: 'resolved'; route: CanonicalRoute }
  | { status: 'missing'; path: string };
