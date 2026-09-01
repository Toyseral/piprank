/**
 * src/lib/content/dynamicResolvers.ts
 *
 * Unified Visual Content Builder — Phase 1 dynamic resolver foundation.
 *
 * Dynamic blocks (broker-cards, comparison-table, best-for-cards,
 * regulation-table, broker-data, faq-accordion, author) will in later phases
 * resolve referenced entities at render time instead of duplicating broker data
 * inside blocks. This module establishes only the resolver *interfaces* and the
 * resolution contract now — the actual data wiring belongs to later phases.
 *
 * Core principle: blocks hold references/configuration only. Structured broker
 * data (brokers, broker_content, countries, intents, country_best_for,
 * rankings, verifications, team) stays authoritative and is passed in through
 * the ResolveCtx at consumption time.
 */

import type { PageBlock, DynamicBlockType } from './types.ts';

/**
 * Context available to resolvers at render/consumption time. Each field is
 * intentionally optional and loose (unknown[]) in Phase 1; later phases narrow
 * these to the real data shapes while keeping the interface stable.
 */
export interface ResolveCtx {
  brokers?: unknown[];
  countries?: unknown[];
  intents?: unknown[];
  brokerContents?: Map<number, unknown>;
  verifications?: unknown[];
  rankings?: Map<string, unknown[]>;
  team?: unknown[];
  /** Extra app-specific data the resolver may need (e.g. country slug, locale). */
  locale?: string;
  countrySlug?: string | null;
  topicSlug?: string | null;
}

/** Config a dynamic block is allowed to carry (references, not data). */
export interface DynamicBlockConfig {
  /** e.g. broker slugs, intent slugs, country slugs — never full entities. */
  refs?: string[];
  key?: string;
  limit?: number;
  sort?: 'default' | 'rating' | 'manual';
  heading?: string;
  [key: string]: unknown;
}

export interface ResolveResult {
  /** Rendered HTML for serverside prerender/SSR paths. Empty in Phase 1. */
  html: string;
  /** Resolved data the client-side renderer can consume. Empty in Phase 1. */
  data?: unknown;
}

export interface ResolveContext {
  ctx: ResolveCtx;
  pageType: string | null;
}

/**
 * A resolver for one dynamic block type. `canResolve` gates whether the current
 * context has everything the block needs; `resolve` returns the rendered
 * output. Implemented per-type in later phases.
 */
export interface DynamicBlockResolver {
  type: DynamicBlockType;
  supportedOn: string[] | 'all';
  /** True when this context can satisfy the block's references. */
  canResolve?: (block: PageBlock, ctx: ResolveCtx) => boolean;
  resolve: (block: PageBlock, context: ResolveContext) => ResolveResult;
}

/** Registry placeholder for Phase 1 — no resolvers implemented yet. */
const resolvers = new Map<DynamicBlockType, DynamicBlockResolver>();

/** Registers a resolver (used by later phases). */
export function registerDynamicResolver(resolver: DynamicBlockResolver): void {
  resolvers.set(resolver.type, resolver);
}

/** Looks up a resolver without triggering any data fetch. */
export function getDynamicResolver(type: DynamicBlockType): DynamicBlockResolver | undefined {
  return resolvers.get(type);
}

/** True when a resolver is registered for the type. */
export function hasDynamicResolver(type: string): boolean {
  return resolvers.has(type as DynamicBlockType);
}

/**
 * Resolves a dynamic block using the *usage-site* context. Phase 1 returns an
 * empty result for every type (no implementation yet), which is safe because no
 * document can contain these blocks until later phases.
 */
export function resolveDynamicBlock(block: PageBlock, ctx: ResolveCtx, pageType: string | null = null): ResolveResult {
  if (block.type === 'richtext' || block.type === 'heading' || block.type === 'image' || block.type === 'table' || block.type === 'callout' || block.type === 'divider' || block.type === 'links') {
    return { html: '', data: null };
  }
  const resolver = resolvers.get(block.type as DynamicBlockType);
  if (!resolver) return { html: '', data: null };
  if (resolver.canResolve && !resolver.canResolve(block, ctx)) {
    return { html: '', data: null };
  }
  return resolver.resolve(block, { ctx, pageType });
}

/**
 * Validates a dynamic block's *shape* (not its data): it must reference only
 * strings, not embed broker objects. Guards the "blocks never carry structured
 * broker data" rule at the type level.
 */
export function blockOnlyContainsReferences(block: PageBlock): boolean {
  const b = block as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(b)) {
    if (key === 'id' || key === 'type' || key === 'meta') continue;
    if (Array.isArray(value)) {
      if (!value.every((v) => typeof v === 'string')) return false;
    } else if (value !== null && value !== undefined && typeof value === 'object') {
      // Config objects are allowed; embedded entity rows are not — heuristic
      // reject of known structured-data keys.
      const v = value as Record<string, unknown>;
      if (typeof v.name === 'string' && ('rating' in v || 'trust_score' in v || 'min_deposit' in v)) return false;
    } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
      // scalar configuration is fine
    } else {
      return false;
    }
  }
  return true;
}