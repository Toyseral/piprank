// api/_lib/derive-html.js
//
// Server-side save derivation for content documents (Phase 1/2).
//
// Mirrors src/lib/content/migrate.ts deriveHtmlForSave and is used by
// api/content.js. Extracted here (plain ESM, like block-validate.js) so the
// exact function the API runs can be exercised by the regression tests without
// pulling in the Supabase client.
//
// Canonical-serialization invariant:
//   incoming blocks
//     → validate/sanitize (blockValidatePayload)
//     → canonical blocks
//     → canonical blocksToHtml() (shared serializer used by browser + prerender)
//     → save blocks + derived html
//
// The server never depends on the browser having produced a correct html cache.

import { blocksToHtml } from '../../src/lib/content/blocksToHtml.runtime.js';
import { blockValidatePayload, cleanHtml } from './block-validate.js';

/**
 * Runs the server-side block validation/sanitization over an incoming blocks
 * array and returns the canonical (safe) blocks to persist. Html-bearing blocks
 * are always re-cleaned first (mirroring the legacy cleanBlocks behavior in
 * api/content.js), so executable content can never slip through — even when a
 * block fails validation and the cleaned copy is not available.
 */
export function sanitizeBlocksForSave(blocks) {
  if (!Array.isArray(blocks)) return [];
  const preCleaned = blocks.map((b) =>
    b && typeof b === 'object' && !Array.isArray(b) && typeof b.html === 'string'
      ? { ...b, html: cleanHtml(b.html) }
      : b,
  );
  const validation = blockValidatePayload({ blocks: preCleaned }, { strict: false });
  return validation.valid && Array.isArray(validation.cleaned?.blocks) ? validation.cleaned.blocks : preCleaned;
}

/**
 * Derives the blocks + html that should actually be written for a save.
 *
 *   - No existing document  → canonical html derived from the incoming blocks.
 *   - Explicit empty        → deliberate clear (blocks kept, html "").
 *   - Untouched legacy      → html-only document saved without edits keeps its
 *                             legacy html (never clobbered to "").
 *   - Normal path           → blocks sanitized to canonical form, html derived
 *                             from those canonical blocks, so a document
 *                             submitted with valid blocks but no html is saved
 *                             with html = blocksToHtml(blocks).
 */
export async function deriveHtmlForSave(existingDoc, incomingBlocks, explicitEmpty = false) {
  if (!existingDoc) {
    const blocks = sanitizeBlocksForSave(incomingBlocks);
    return { blocks, html: blocksToHtml(blocks) };
  }

  const incoming = Array.isArray(incomingBlocks) ? incomingBlocks : [];
  const incomingEmpty = incoming.length === 0;

  const existingHtml = String(existingDoc.html || '');
  const existingHasHtml = existingHtml.trim().length > 0;
  const existingHasBlocks = Array.isArray(existingDoc.blocks) && existingDoc.blocks.length > 0;

  // Case 1: Explicit empty — respect the administrator's deliberate clear.
  if (explicitEmpty) {
    return { blocks: incoming, html: '' };
  }

  // Case 2: Untouched legacy content — html present, blocks empty, incoming
  // empty. Preserve the legacy html; the client-side loadDocument.ts seeds
  // blocks for the editor without ever clobbering the stored content.
  if (existingHasHtml && !existingHasBlocks && incomingEmpty) {
    return { blocks: [], html: existingHtml };
  }

  // Case 3: Normal path — sanitize blocks to canonical form, then derive the
  // html from the canonical blocks with the shared serializer.
  const blocks = sanitizeBlocksForSave(incoming);
  return { blocks, html: blocksToHtml(blocks) };
}