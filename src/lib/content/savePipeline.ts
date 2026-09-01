/**
 * src/lib/content/savePipeline.ts
 *
 * Unified Visual Content Builder — Phase 2 save pipeline.
 *
 * Single, safe content-save pipeline that every editor (broker content,
 * country SEO, guide, best-for, content documents) routes through.
 *
 * Pipeline:
 *   1. Sanitize blocks (html fields cleaned of executable content).
 *   2. Derive the canonical html cache from the block serializer.
 *   3. Preserve legacy html when the document is untouched and blocks are
 *      empty (prevents the historical data-loss bug).
 *   4. Respect explicit empty when an administrator deliberately clears content.
 *
 * This module is React-free so it can also be used by server-side consumers.
 */

import { blocksToHtml, blocksProduceHtml } from './blocksToHtml.ts';
import { sanitizeBlocks } from './sanitize.ts';
import { shouldPreserveLegacyContent } from './types.ts';
import { htmlToBlocks } from './htmlToBlocks.ts';
import type { PageBlock } from './types.ts';

/* ========================= types ========================= */

export interface SavePipelineResult {
  blocks: PageBlock[];
  html: string;
  preservedLegacy: boolean;
  seededFromLegacy: boolean;
}

export interface SavePipelineOptions {
  /**
   * Only set true when the administrator deliberately cleared all content.
   * When false and incoming blocks are empty while legacy html exists,
   * the legacy content is preserved instead of being clobbered.
   */
  explicitEmpty?: boolean;
}

/* ========================= core pipeline ========================= */

/**
 * The single safe save derivation for content documents.
 *
 * Given the existing stored document (if any) and the incoming blocks from the
 * editor, produces the blocks and html that should actually be written.
 *
 * Safety invariants:
 *   - Existing populated documents are never silently turned into empty
 *     documents due to editor initialization issues.
 *   - Legacy html is preserved when the document is untouched.
 *   - Explicit empty is respected when an administrator deliberately clears.
 *   - All blocks are sanitized before storage.
 *   - The html cache is always derived from blocks via the canonical serializer.
 */
export function prepareForSave(
  existingDoc: { blocks?: unknown[]; html?: string } | null | undefined,
  incomingBlocks: unknown[] | null | undefined,
  opts: SavePipelineOptions = {}
): SavePipelineResult {
  const sanitized = sanitizeBlocks(Array.isArray(incomingBlocks) ? incomingBlocks : []) as PageBlock[];
  const incomingEmpty = !Array.isArray(sanitized) || sanitized.length === 0 || !blocksProduceHtml(sanitized);

  const existingNormalized: PageBlock[] = (Array.isArray(existingDoc?.blocks) ? existingDoc.blocks : []) as PageBlock[];
  if (existingDoc && shouldPreserveLegacyContent({ blocks: existingNormalized, html: existingDoc.html ?? '' }, sanitized, Boolean(opts.explicitEmpty))) {
    return {
      blocks: htmlToBlocks(existingDoc.html).blocks as PageBlock[],
      html: existingDoc.html ?? '',
      preservedLegacy: true,
      seededFromLegacy: true,
    };
  }

  if (incomingEmpty) {
    return { blocks: [], html: '', preservedLegacy: false, seededFromLegacy: false };
  }

  return {
    blocks: sanitized,
    html: blocksToHtml(sanitized),
    preservedLegacy: false,
    seededFromLegacy: false,
  };
}

/**
 * Simplified version returning flat blocks/html for API payloads.
 */
export function prepareDocumentForSave(
  existingDoc: { blocks?: unknown[]; html?: string } | null | undefined,
  incomingBlocks: unknown[] | null | undefined,
  opts: SavePipelineOptions = {}
): { blocks: unknown[]; html: string } {
  const result = prepareForSave(existingDoc, incomingBlocks, opts);
  return { blocks: result.blocks, html: result.html };
}
