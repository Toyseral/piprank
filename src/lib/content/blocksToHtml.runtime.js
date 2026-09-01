/**
 * src/lib/content/blocksToHtml.js
 *
 * Runtime-neutral block → HTML serializer.
 *
 * This is the single, canonical serializer for page blocks. It consults the
 * block registry (blockRegistry.js) rather than hardcoding separate conversion
 * logic, so the browser editor and any Node-side consumer (prerender, Vercel
 * serverless) always render identically.
 *
 * The output is kept byte-for-byte identical to the historical inline
 * serializer that lived in PageBuilder.tsx, so existing live pages and the
 * prerendered HTML never change.
 *
 * Unknown / unregistered block types are never silently dropped: they fall back
 * to their raw `html` (when present) or are flagged via `serialize` errors.
 *
 * This file is intentionally free of TypeScript and runtime dependencies so it
 * can be imported by Vercel's serverless Node functions (which do not
 * type-strip) as well as the browser and build scripts. The companion
 * blocksToHtml.ts is a thin typed re-export wrapper around this module. There is
 * exactly ONE implementation: never fork this logic into another file.
 */

import { blockToHtml, isKnownBlockType } from './blockRegistry.runtime.js';

/**
 * Serializes an array of blocks to HTML by delegating each block to the block
 * registry's `toHtml`. The result is joined with newlines exactly like the
 * existing PageBuilder behaviour.
 *
 * @param {unknown[] | null | undefined} blocks
 * @returns {string}
 */
export function blocksToHtml(blocks) {
  if (!Array.isArray(blocks)) return '';
  const parts = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const b = block;
    const type = b.type;
    if (typeof type !== 'string' || !isKnownBlockType(type)) {
      parts.push(blockToHtml(block));
      continue;
    }
    parts.push(blockToHtml(block));
  }
  return parts.join('\n');
}

/**
 * Same as {blocksToHtml} but returns per-block diagnostics. Useful for the
 * server-side validation path and for tests proving unknown blocks are never lost.
 *
 * @param {unknown[] | null | undefined} blocks
 * @returns {{ html: string; errors: { index: number; type: string; fallback: boolean }[] }}
 */
export function serializeBlocksWithErrors(blocks) {
  if (!Array.isArray(blocks)) return { html: '', errors: [] };
  const parts = [];
  const errors = [];
  blocks.forEach((block, index) => {
    if (!block || typeof block !== 'object') {
      errors.push({ index, type: 'unknown', fallback: true });
      return;
    }
    const b = block;
    const type = typeof b.type === 'string' ? b.type : 'unknown';
    if (typeof type !== 'string' || !isKnownBlockType(type)) {
      errors.push({ index, type, fallback: true });
      parts.push(blockToHtml(block));
      return;
    }
    parts.push(blockToHtml(block));
  });
  return { html: parts.join('\n'), errors };
}

/**
 * True when a set of blocks serializes to any real HTML. Mirrors the intent of
 * the existing blocksHaveContent() helper but implemented over the shared
 * serializer (a block that serializes to `<hr />` or a non-empty figure still
 * counts as content).
 *
 * @param {unknown[] | null | undefined} blocks
 * @returns {boolean}
 */
export function blocksProduceHtml(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;
  const { html } = serializeBlocksWithErrors(blocks);
  return html.trim().length > 0;
}
