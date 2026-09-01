/**
 * src/lib/content/blocksToHtml.ts
 *
 * Shared block → HTML serializer.
 *
 * This is the single, canonical serializer for page blocks. It consults the
 * block registry rather than hardcoding separate conversion logic, so the
 * browser editor and any Node-side consumer (prerender, render-blocks) always
 * render identically.
 *
 * The output is kept byte-for-byte identical to the historical inline
 * serializer that lived in PageBuilder.tsx, so existing live pages and the
 * prerendered HTML never change.
 *
 * Unknown / unregistered block types are never silently dropped: they fall back
 * to their raw `html` (when present) or are flagged via `serialize` errors.
 */

import { blockToHtml, isKnownBlockType } from './blockRegistry.ts';
import type { PageBlock } from './types.ts';

/**
 * Serializes an array of blocks to HTML by delegating each block to the block
 * registry's `toHtml`. The result is joined with newlines exactly like the
 * existing PageBuilder behaviour.
 */
export function blocksToHtml(blocks: unknown[] | null | undefined): string {
  if (!Array.isArray(blocks)) return '';
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    const type = b.type;
    if (typeof type !== 'string' || !isKnownBlockType(type)) {
      // Unregistered type — preserve whatever content it carries rather than
      // silently destroying it.
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
 */
export function serializeBlocksWithErrors(
  blocks: unknown[] | null | undefined
): { html: string; errors: { index: number; type: string; fallback: boolean }[] } {
  if (!Array.isArray(blocks)) return { html: '', errors: [] };
  const parts: string[] = [];
  const errors: { index: number; type: string; fallback: boolean }[] = [];
  blocks.forEach((block, index) => {
    if (!block || typeof block !== 'object') {
      errors.push({ index, type: 'unknown', fallback: true });
      return;
    }
    const b = block as Record<string, unknown>;
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
 */
export function blocksProduceHtml(blocks: unknown[] | null | undefined): boolean {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;
  const { html } = serializeBlocksWithErrors(blocks);
  return html.trim().length > 0;
}

export type { PageBlock };
