// scripts/render-blocks.mjs
//
// Node-side boundary for the shared block serializer.
//
// Phase 1 goal: one canonical serializer for page blocks (src/lib/content/
// blocksToHtml.js + blockRegistry.js) usable BOTH in the browser (via Vite /
// PageBuilder) and in Node scripts (prerender, migration tooling, validation)
// AND in Vercel's serverless functions.
//
// The serializer takes a runtime-neutral form (blocksToHtml.js) with no
// TypeScript dependency, so this boundary works in every Node runtime without
// type-stripping. prerender.mjs and future tooling import from here, and the
// Vercel serverless functions import the same runtime-neutral modules directly.
//
// Usage (ESM):
//   import { renderBlocks, serializeHeaderNote } from './render-blocks.mjs';

import { blocksToHtml } from '../src/lib/content/blocksToHtml.runtime.js';
import { isKnownBlockType } from '../src/lib/content/blockRegistry.runtime.js';
import { sanitizeHtml, sanitizeBlockUrl } from '../src/lib/content/sanitize.ts';

/**
 * Renders block JSON to HTML using the same shared serializer the browser uses.
 * Accepts a JSON string or an already-parsed array.
 */
export function renderBlocks(input, { sanitize = false } = {}) {
  let blocks = input;
  if (typeof input === 'string') {
    try {
      blocks = JSON.parse(input);
    } catch {
      return { html: '', error: 'invalid blocks JSON' };
    }
  }
  if (!Array.isArray(blocks)) return { html: '', error: 'blocks must be an array' };
  const html = blocksToHtml(blocks);
  return { html: sanitize ? sanitizeHtml(html) : html };
}

/** True when a type is registered in the shared block registry. */
export function isKnownBlock(type) {
  return typeof type === 'string' && isKnownBlockType(type);
}

/** Validates a single block URL against the shared safe-URL policy. */
export function safeBlockUrl(value) {
  return sanitizeBlockUrl(value);
}

/**
 * Back-compat name used by scripts/prerender.mjs: returns the HTML string for
 * an already-parsed blocks array, exactly like the historical inline
 * `blocksToHtmlServer` port in prerender did — but now driven by the one shared
 * serializer instead of a second copy.
 */
export function blocksToHtmlServer(blocks) {
  return blocksToHtml(blocks);
}