/**
 * src/lib/content/loadDocument.ts
 *
 * Unified Visual Content Builder — Phase 2 document loader.
 *
 * Provides a single, safe function for loading a content document from the
 * database into editor-ready blocks. Handles:
 *
 *   - Existing documents with valid blocks → return them directly.
 *   - Legacy documents with html but no blocks → seed blocks from html via
 *     htmlToBlocks, preserving the original html for the save pipeline.
 *   - Empty or missing documents → return empty blocks.
 *
 * This prevents the historical data-loss bug: an editor loading a legacy
 * document and saving without explicit changes now correctly preserves the
 * existing content instead of overwriting html with "".
 *
 * This module is React-free so it can be used by server-side consumers too.
 */

import { htmlToBlocksSeeded } from './htmlToBlocks.ts';

/* ========================= types ========================= */

export interface LoadDocumentResult {
  /** Blocks suitable for the PageBuilder editor. */
  blocks: unknown[];
  /** The original html — preserved if this is a legacy document. */
  html: string;
  /** True when blocks were seeded from legacy html. */
  seededFromLegacy: boolean;
}

/* ========================= core loader ========================= */

/**
 * Loads a raw database document into editor-ready blocks.
 *
 * Safety invariants:
 *   - If the document has valid blocks, they are returned as-is.
 *   - If the document has html but no blocks, blocks are seeded from html.
 *   - If the document is empty, an empty array is returned.
 *   - The original html is always preserved in the result so the save
 *     pipeline can detect untouched legacy content.
 */
export function loadDocumentForEditor(
  doc: { blocks?: unknown[]; html?: string } | null | undefined
): LoadDocumentResult {
  if (!doc) {
    return { blocks: [], html: '', seededFromLegacy: false };
  }

  const html = typeof doc.html === 'string' ? doc.html : '';
  const hasBlocks = Array.isArray(doc.blocks) && doc.blocks.length > 0;
  const hasHtml = html.trim().length > 0;

  // Case 1: Document already has blocks — return them directly.
  if (hasBlocks) {
    return {
      blocks: doc.blocks as unknown[],
      html,
      seededFromLegacy: false,
    };
  }

  // Case 2: Legacy document — html present but blocks empty.
  // Seed blocks from html so the editor can work with them.
  if (hasHtml && !hasBlocks) {
    return {
      blocks: htmlToBlocksSeeded(html),
      html,
      seededFromLegacy: true,
    };
  }

  // Case 3: Empty document.
  return { blocks: [], html: '', seededFromLegacy: false };
}

/**
 * Initializes editor blocks from a document. Used by the React component
 * to set up the initial builderBlocks state.
 *
 * Prefers the document's blocks, falls back to seeding from html.
 * For a brand-new document with no existing data, returns the seedBlocks
 * if provided, or an empty array.
 */
export function initEditorBlocks(
  doc: { blocks?: unknown[]; html?: string } | null | undefined,
  seedBlocks?: unknown[]
): unknown[] {
  if (!doc) {
    return seedBlocks && seedBlocks.length > 0 ? seedBlocks : [];
  }

  const result = loadDocumentForEditor(doc);

  // If the loader seeded from legacy html, use those blocks.
  if (result.seededFromLegacy) {
    return result.blocks;
  }

  // If the document has blocks, use them.
  if (result.blocks.length > 0) {
    return result.blocks;
  }

  // If the document has html but no blocks (edge case), seed from html.
  if (typeof doc.html === 'string' && doc.html.trim().length > 0) {
    return htmlToBlocksSeeded(doc.html);
  }

  // Fallback to seedBlocks or empty.
  return seedBlocks && seedBlocks.length > 0 ? seedBlocks : [];
}
