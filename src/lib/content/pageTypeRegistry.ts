/**
 * src/lib/content/pageTypeRegistry.ts
 *
 * Unified Visual Content Builder — Phase 1 page type registry foundation.
 *
 * Describes the seven canonical page types: label, how the content key is
 * derived, route shape, allowed blocks, default blocks, entity kind, and
 * workflow behavior. This is configuration groundwork only — nothing here is
 * wired into the Admin UI yet.
 *
 * Existing database `content_type` strings (e.g. 'broker', 'country',
 * 'country-topic', 'page') are deliberately NOT mapped one-to-one here; later
 * phases bridge legacy values to canonical PageTypeKeys, and the application
 * layer remains tolerant of both.
 */

import type { PageTypeKey, PageBlock } from './types.ts';
import { PAGE_TYPE_KEYS } from './types.ts';

export type WorkflowMode = 'simple' | 'workflow';

export interface PageTypeDef {
  key: PageTypeKey;
  label: string;
  /** Legacy content_type values commonly seen in existing content_documents. */
  legacyContentTypes: string[];
  /**
   * Builds the canonical content key. `parts` follow the existing convention
   * `{type}:{entity}:{topic}` (e.g. `broker:ig:main`, `country:vn:vietnam`).
   */
  contentKey: (parts: { type: string; entity?: string; topic?: string; countrySlug?: string; topicSlug?: string }) => string;
  /** Route shape. Returns null when the page type currently has no public route. */
  route: (parts: { countrySlug?: string | null; topicSlug?: string | null; slug?: string | null }) => string | null;
  allowedBlocks: PageTypeKey[] | 'all';
  defaultBlocks: (entity?: unknown) => PageBlock[];
  entity: 'broker' | 'country' | 'global' | 'document';
  workflow: { mode: WorkflowMode; states: string[] };
  indexableDefault: boolean;
}

function noDefaultBlocks(): PageBlock[] {
  return [];
}

const EDITORIAL_REGISTRY_ALLOWED = 'all';

const defs: Record<PageTypeKey, PageTypeDef> = {
  'broker-editorial': {
    key: 'broker-editorial',
    label: 'Broker Editorial',
    legacyContentTypes: ['broker', 'broker-content'],
    contentKey: (p) => `${p.type}:${p.entity}:${p.topic ?? 'main'}`,
    route: (p) => (p.slug ? `/brokers/${p.slug}` : null),
    allowedBlocks: EDITORIAL_REGISTRY_ALLOWED,
    defaultBlocks: noDefaultBlocks,
    entity: 'broker',
    workflow: { mode: 'simple', states: ['draft', 'published'] },
    indexableDefault: true,
  },
  'global-guide': {
    key: 'global-guide',
    label: 'Global Guide',
    legacyContentTypes: ['guide', 'guide-global'],
    contentKey: (p) => `${p.type}:${p.entity}:${p.topic ?? 'main'}`,
    route: (p) => (p.slug ? `/guides/${p.slug}` : null),
    allowedBlocks: EDITORIAL_REGISTRY_ALLOWED,
    defaultBlocks: noDefaultBlocks,
    entity: 'global',
    workflow: { mode: 'simple', states: ['draft', 'published'] },
    indexableDefault: true,
  },
  'country-guide': {
    key: 'country-guide',
    label: 'Country Guide',
    legacyContentTypes: ['country-guide'],
    contentKey: (p) => `${p.type}:${p.countrySlug ?? ''}:${p.entity ?? 'guide'}`,
    route: (p) => (p.countrySlug ? `/${p.countrySlug}/guides` : null),
    allowedBlocks: EDITORIAL_REGISTRY_ALLOWED,
    defaultBlocks: noDefaultBlocks,
    entity: 'country',
    workflow: { mode: 'simple', states: ['draft', 'published'] },
    indexableDefault: true,
  },
  'country-page': {
    key: 'country-page',
    label: 'Country Page',
    legacyContentTypes: ['country', 'country-topic', 'country-hub'],
    contentKey: (p) => `${p.type}:${p.countrySlug ?? ''}:${p.topicSlug ?? 'hub'}`,
    route: (p) => (p.countrySlug ? (p.topicSlug ? `/${p.countrySlug}/${p.topicSlug}` : `/${p.countrySlug}`) : null),
    allowedBlocks: EDITORIAL_REGISTRY_ALLOWED,
    defaultBlocks: noDefaultBlocks,
    entity: 'country',
    workflow: { mode: 'workflow', states: ['draft', 'in_review', 'ready', 'published'] },
    indexableDefault: true,
  },
  'global-intent': {
    key: 'global-intent',
    label: 'Global Intent',
    legacyContentTypes: ['intent', 'best-for'],
    contentKey: (p) => `${p.type}:${p.entity ?? ''}:main`,
    route: (p) => (p.slug ? `/best-for/${p.slug}` : null),
    allowedBlocks: EDITORIAL_REGISTRY_ALLOWED,
    defaultBlocks: noDefaultBlocks,
    entity: 'global',
    workflow: { mode: 'simple', states: ['draft', 'published'] },
    indexableDefault: true,
  },
  'country-intent': {
    key: 'country-intent',
    label: 'Country Best-For / Intent',
    legacyContentTypes: ['country-best-for', 'country-intent'],
    contentKey: (p) => `${p.type}:${p.countrySlug ?? ''}:${p.entity ?? 'best-for'}`,
    route: (p) => (p.countrySlug && p.slug ? `/${p.countrySlug}/best-for/${p.slug}` : null),
    allowedBlocks: EDITORIAL_REGISTRY_ALLOWED,
    defaultBlocks: noDefaultBlocks,
    entity: 'country',
    workflow: { mode: 'simple', states: ['draft', 'published'] },
    indexableDefault: true,
  },
  standalone: {
    key: 'standalone',
    label: 'Standalone Page',
    legacyContentTypes: ['page', 'general', 'standalone'],
    contentKey: (p) => `${p.type}:${p.entity ?? 'page'}:main`,
    route: (p) => (p.slug ? `/${p.slug}` : null),
    allowedBlocks: EDITORIAL_REGISTRY_ALLOWED,
    defaultBlocks: noDefaultBlocks,
    entity: 'document',
    workflow: { mode: 'simple', states: ['draft', 'in_review', 'ready', 'published'] },
    indexableDefault: true,
  },
};

export function pageTypeDef(key: PageTypeKey): PageTypeDef {
  return defs[key];
}

export function allPageTypeDefs(): PageTypeDef[] {
  return PAGE_TYPE_KEYS.map((k) => defs[k]);
}

/**
 * Tolerantly resolves a legacy `content_type` string to a canonical page type
 * when it matches one of the known legacy values; otherwise returns null so the
 * application layer can keep treating the value as-is without breaking.
 */
export function canonicalPageTypeForContentType(contentType: string | null | undefined): PageTypeKey | null {
  if (!contentType) return null;
  const match = allPageTypeDefs().find((d) => d.legacyContentTypes.includes(contentType));
  return match ? match.key : null;
}