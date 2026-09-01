/**
 * src/lib/content/types.ts
 *
 * Unified Visual Content Builder — Phase 1 foundation types.
 *
 * This module is the single source of truth for the shared content model that
 * the future unified editor (Broker Editorial, Global Guides, Country Guides,
 * Country Pages, Global Intents, Country Best-For / Country Intents, Standalone
 * Pages) will all consume.
 *
 * IMPORTANT: These types are intentionally additive and permissive around
 * legacy data. Existing `content_documents` rows may contain block shapes that
 * predate this model (or no blocks at all, only `html`). Nothing here should
 * break that stored data — validation and migration live in the companion
 * modules (blockRegistry, block-validate, migrate).
 *
 * This file is pure TypeScript with no React dependency, so it can be imported
 * from Node scripts (e.g. the prerender pipeline) as well as the browser.
 */

/**
 * The seven eventual page types the unified builder will manage. This is the
 * canonical set used by the block registry and page type registry.
 *
 * Existing database `content_type` strings (e.g. 'broker', 'country',
 * 'country-topic', 'page', 'guide', 'intent', 'country-best-for') must remain
 * backward compatible and are NOT blindly assumed to equal these keys. The
 * application layer tolerates the old values; these keys describe canonical
 * page kinds that later phases map onto.
 */
export type PageTypeKey =
  | 'broker-editorial'
  | 'global-guide'
  | 'country-guide'
  | 'country-page'
  | 'global-intent'
  | 'country-intent'
  | 'standalone';

/** Every page kind in {PageTypeKey}, as a runtime array (for validation/registry). */
export const PAGE_TYPE_KEYS: readonly PageTypeKey[] = [
  'broker-editorial',
  'global-guide',
  'country-guide',
  'country-page',
  'global-intent',
  'country-intent',
  'standalone',
] as const;

/**
 * Editorial block types. These are the always-rendered, statically-sanitized
 * building blocks the current PageBuilder already supports.
 */
export type EditorialBlockType =
  | 'heading'
  | 'richtext'
  | 'image'
  | 'table'
  | 'callout'
  | 'divider'
  | 'links';

/**
 * Dynamic block types. Represented at the type/registry level now so the
 * architecture can support them cleanly in later phases, but their full
 * runtime UI/resolution is intentionally deferred. Blocks should hold
 * references/configuration, not duplicated broker data.
 */
export type DynamicBlockType =
  | 'hero'
  | 'broker-cards'
  | 'comparison-table'
  | 'best-for-cards'
  | 'regulation-table'
  | 'broker-data'
  | 'faq-accordion'
  | 'cta'
  | 'author';

export type BlockType = EditorialBlockType | DynamicBlockType;

export type BlockCategory = 'editorial' | 'dynamic';

/** Callout tones supported by the serializer. */
export type CalloutTone = 'neutral' | 'success' | 'warning' | 'dark';

export interface InternalLink {
  label: string;
  href: string;
}

/**
 * Discriminated union of every supported page block.
 *
 * Each block carries a stable `id`. Unknown extra fields are tolerated at the
 * type level via index signatures on individual blocks where the underlying
 * data is genuinely open-ended (e.g. dynamic blocks may hold arbitrary
 * configuration).
 *
 * NOTE: The current PageBuilder uses a looser, flat `{ id, type, ... }` shape.
 * This union is the canonical, stricter model; the loose reads are handled by
 * normalization/validation (see htmlToBlocks, blockRegistry) and never destroy
 * data that doesn't fit perfectly.
 */
export type PageBlock =
  | HeadingBlock
  | RichtextBlock
  | ImageBlock
  | TableBlock
  | CalloutBlock
  | DividerBlock
  | LinksBlock
  | DynamicBlock;

export interface BaseBlock {
  id: string;
  /** Stable field for surviving regex-driven round-trips; always lowercase slug. */
  meta?: Record<string, unknown>;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  title: string;
  /** Defaults to 'h2' when omitted — matches the current serializer output. */
  level?: 'h2' | 'h3';
}

export interface RichtextBlock extends BaseBlock {
  type: 'richtext';
  /** Sanitized rich text (paragraphs, lists, inline formatting). */
  html: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt?: string;
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  /** First row is the header row. */
  rows: string[][];
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  /** Sanitized rich text inside the callout. */
  html: string;
  tone?: CalloutTone;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export interface LinksBlock extends BaseBlock {
  type: 'links';
  links: InternalLink[];
}

/** Future dynamic blocks — represented as a loose, configurable shape. */
export interface DynamicBlock extends BaseBlock {
  type: DynamicBlockType;
  [key: string]: unknown;
}

/**
 * Page document settings. Additive only.
 *
 * Existing `settings` JSONB must never lose unknown keys, so `PageDocumentSettings`
 * is intentionally an open interface (`[key: string]: unknown`) layered on top of
 * the well-known fields below. `_migratedFrom` is used by the migration helpers to
 * record a migration marker without forcing a schema change.
 */
export interface PageDocumentSettings {
  version?: number;

  hero?: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    image?: string;
  };

  faqs?: FAQItem[];

  internalLinks?: InternalLink[];

  rankingMode?: 'auto' | 'manual';

  pinnedBrokerSlugs?: string[];

  excludedBrokerSlugs?: string[];

  authors?: string[];

  publish?: {
    workflow_status?: 'draft' | 'in_review' | 'ready' | 'published';
    published_at?: string;
  };

  /** Migration marker set by migrate.ts (e.g. `{ from: 'legacy-html', at: ... }`). */
  migratedFrom?: unknown;

  // Preserve any pre-existing/unknown settings keys at runtime.
  [key: string]: unknown;
}

export interface FAQItem {
  q: string;
  a: string;
}

/**
 * The canonical page document model, aligned with the `content_documents` table
 * but expressed in safe TypeScript. `blocks` is the future editorial source of
 * truth; `html` is a derived compatibility cache.
 */
export interface PageDocument {
  id?: number;
  content_key: string;
  content_type: string;
  country_slug: string | null;
  topic_slug: string | null;
  slug: string | null;
  title: string;
  excerpt: string;
  /** Derived compatibility cache — derived from `blocks` on save. */
  html: string;
  /** The editorial source of truth. */
  blocks: PageBlock[];
  seo_title: string | null;
  seo_description: string | null;
  indexable: boolean;
  published: boolean;
  updated_by: string | null;
  created_at?: string;
  updated_at?: string;
  settings?: PageDocumentSettings;
}

/**
 * Returns true when a document carries any real content, whether authored as
 * `blocks` or as legacy `html`. This is the defensive half of the has-content
 * invariant: a document with existing content must never be treated as empty
 * simply because `blocks` is empty.
 */
export function hasContent(doc: Pick<PageDocument, 'blocks' | 'html'>): boolean {
  if (Array.isArray(doc.blocks) && doc.blocks.length > 0) return true;
  if (typeof doc.html === 'string' && doc.html.trim().length > 0) return true;
  return false;
}

/**
 * True if the document looks like untouched legacy content: non-empty `html`
 * but no meaningfully populated `blocks`. Used by the migration + editor save
 * paths to decide whether content must be preserved (seeded into blocks) rather
 * than clobbered by an empty `blocks` array.
 */
export function isLegacyHtmlDocument(doc: Pick<PageDocument, 'blocks' | 'html'>): boolean {
  const hasBlocks = Array.isArray(doc.blocks) && doc.blocks.length > 0;
  const hasHtml = typeof doc.html === 'string' && doc.html.trim().length > 0;
  return hasHtml && !hasBlocks;
}

/**
 * Distinguishes "content intentionally emptied" from "untouched legacy content".
 *
 * `explicitEmpty` should be set true only when an administrator has deliberately
 * cleared the document (e.g. the editor committed an obviously-empty save). When
 * false and the incoming `blocks` are empty while legacy `html` exists, the save
 * path must preserve the legacy content instead of overwriting it with "".
 */
export function shouldPreserveLegacyContent(
  doc: Pick<PageDocument, 'blocks' | 'html'>,
  incomingBlocks: unknown[] | null | undefined,
  explicitEmpty = false
): boolean {
  if (explicitEmpty) return false;
  if (!isLegacyHtmlDocument(doc)) return false;
  if (Array.isArray(incomingBlocks) && incomingBlocks.length > 0) return false;
  return true;
}
