/**
 * Canonical PageBuilder taxonomy used by all PipRank page templates.
 *
 * Templates own the page structure; PageBuilder owns editable editorial
 * content inside those structures. System data (rankings, broker facts,
 * country facts, FAQs and affiliate actions) remains outside the builder.
 */

export const PAGE_ZONES = [
  'hero',
  'introduction',
  'overview',
  'editorial',
  'pricing',
  'pricing-content',
  'platforms',
  'platform-content',
  'trust',
  'trust-content',
  'ranking',
  'methodology',
  'faq',
  'final-cta',
] as const;

export type PageZone = (typeof PAGE_ZONES)[number];

export const PAGE_BLOCK_TYPES = [
  'richtext',
  'heading',
  'image',
  'table',
  'callout',
  'divider',
  'links',
  'structured_broker_data',
  'broker_card',
  'broker_grid',
  'comparison_table',
  'broker_cta',
  'piprank_verdict',
  'ranking',
  'country_snapshot',
  'country_broker_grid',
  'best_for_grid',
  'guide_cards',
  'related_content',
  'methodology',
  'trust_verification',
  'stats',
  'pros_cons',
  'quote',
  'match_cta',
] as const;

export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

export type PageBuilderBlock = {
  id: string;
  type: PageBlockType;
  zone?: PageZone;
  order?: number;
  title?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export const MATCH_CTA_COPY = {
  primary: 'Get Matched With a Broker',
  button: 'Match Me With a Broker',
} as const;

export function isPageZone(value: unknown): value is PageZone {
  return typeof value === 'string' && (PAGE_ZONES as readonly string[]).includes(value);
}

export function isPageBlockType(value: unknown): value is PageBlockType {
  return typeof value === 'string' && (PAGE_BLOCK_TYPES as readonly string[]).includes(value);
}
