/**
 * src/lib/content/blockRegistry.ts
 *
 * Unified Visual Content Builder — Phase 1 block registry (TYPE WRAPPER).
 *
 * The canonical, runtime-neutral implementation of the registry lives in
 * blockRegistry.js so it can be imported by the browser, Node build scripts and
 * Vercel's serverless Node functions (which do not type-strip). This file is a
 * thin typed re-export of that implementation so TypeScript consumers get full
 * type-checking without duplicating any logic.
 *
 * Do NOT add logic here. Exactly one implementation exists (blockRegistry.js);
 * this module only re-exports it and its types.
 */

export {
  esc,
  validateUrlField,
  requireNonEmptyString,
  blocks,
  allBlockTypes,
  isKnownBlockType,
  blockDef,
  blockToHtml,
} from './blockRegistry.runtime.js';

import type { CalloutTone, DynamicBlockType, PageBlock, PageTypeKey } from './types.ts';

/**
 * Block metadata entry (type-only mirror of the runtime registry shape).
 * Kept here for TypeScript consumers; the actual data lives in blockRegistry.js.
 */
export interface BlockDef<T extends PageBlock = PageBlock> {
  type: T['type'];
  category: 'editorial' | 'dynamic';
  label: string;
  allowedOn: PageTypeKey[] | 'all';
  defaultProps: () => Partial<T>;
  /** Returns an error string, or null when the block is valid. */
  validate?: (block: Record<string, unknown>) => string | null;
  /** Canonical HTML serialization (editorial blocks). Dynamic blocks render in later phases. */
  toHtml?(block: T): string;
}

export type { PageBlock, PageTypeKey, CalloutTone, DynamicBlockType };
