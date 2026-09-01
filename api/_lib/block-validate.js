// api/_lib/block-validate.js
//
// Server-side validation for the unified content block model (Phase 1).
//
// The server must NEVER blindly trust block JSON received from the client.
// This module validates:
//   - known block type
//   - required fields
//   - valid enums (heading level, callout tone)
//   - valid URLs (reject javascript:, data:, vbscript: and unknown schemes)
//   - sane limits (lengths, row/column counts, link counts)
//   - sanitized HTML (blocks carrying raw html are re-cleaned)
//
// It is intentionally plain CommonJS-free ESM (matching the other api/_lib
// modules) and self-contained so it runs in the serverless runtime without
// TypeScript tooling. The rules mirror src/lib/content/* where the two worlds
// overlap; the block *registry* (TS) remains the single source of truth for
// metadata, and this module enforces it server-side on write.

const EDITORIAL_TYPES = new Set(['heading', 'richtext', 'image', 'table', 'callout', 'divider', 'links']);

const DYNAMIC_TYPES = new Set([
  'hero',
  'broker-cards',
  'comparison-table',
  'best-for-cards',
  'regulation-table',
  'broker-data',
  'faq-accordion',
  'cta',
  'author',
]);

const KNOWN_TYPES = new Set([...EDITORIAL_TYPES, ...DYNAMIC_TYPES]);

const HEADING_LEVELS = new Set(['h2', 'h3']);
const CALLOUT_TONES = new Set(['neutral', 'success', 'warning', 'dark']);

const LIMITS = {
  titleLength: 500,
  richTextLength: 200000,
  tableRows: 200,
  tableCols: 60,
  linksPerBlock: 100,
  linkLabelLength: 300,
  urlLength: 2000,
  blocksPerDocument: 2000,
  rowsPerCell: 50000,
};

// Same scheme policy as src/lib/content/sanitize.ts.
const SAFE_SCHEME_RE = /^(https?|mailto|tel):$/i;
const UNSAFE_SCHEME_RE = /(\bjavascript\s*:|vbscript\s*:|data\s*:)/i;

function isNonEmptyString(value, field, max) {
  if (typeof value !== 'string' || value.trim() === '') return `${field} is required`;
  if (value.length > max) return `${field} exceeds maximum length`;
  return null;
}

function isValidUrl(value) {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value !== 'string') return { ok: false, error: 'must be a string' };
  const s = value.trim();
  if (s === '') return { ok: true };
  if (s.length > LIMITS.urlLength) return { ok: false, error: 'URL is too long' };
  if (UNSAFE_SCHEME_RE.test(s)) return { ok: false, error: 'disallowed URL scheme' };
  if (s.startsWith('/')) return { ok: true };
  const colon = s.indexOf(':');
  if (colon !== -1 && !SAFE_SCHEME_RE.test(s.slice(0, colon + 1))) {
    return { ok: false, error: 'disallowed URL scheme' };
  }
  return { ok: true };
}

// Reuses the exact policy from api/content.js cleanHtml (kept in sync there).
function cleanHtml(input) {
  let html = String(input ?? '');
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');
  html = html.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*\/?>/gi, '');
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/javascript\s*:/gi, '');
  return html.trim();
}

/** True when the given html already matches the clean policy (idempotent clean). */
function htmlIsClean(input) {
  return cleanHtml(input) === String(input ?? '').trim();
}

const validators = {
  heading(block) {
    if (isNonEmptyString(block.title, 'title', LIMITS.titleLength)) return { error: isNonEmptyString(block.title, 'title', LIMITS.titleLength) };
    if (block.level !== undefined && !HEADING_LEVELS.has(block.level)) return { error: 'heading level must be h2 or h3' };
    return { errors: [] };
  },
  richtext(block) {
    if (typeof block.html !== 'string') return { error: 'html is required for richtext blocks' };
    if (block.html.length > LIMITS.richTextLength) return { error: 'richtext html is too large' };
    if (!htmlIsClean(block.html)) return { error: 'html contains unsanitized content', clean: cleanHtml(block.html) };
    return { errors: [] };
  },
  image(block) {
    const url = isValidUrl(block.src);
    if (!url.ok) return { error: url.error ? `src ${url.error}` : 'invalid image src' };
    if (block.alt !== undefined && typeof block.alt !== 'string') return { error: 'alt must be a string' };
    return { errors: [] };
  },
  table(block) {
    if (!Array.isArray(block.rows)) return { error: 'rows must be an array' };
    if (block.rows.length === 0) return { error: 'table must have at least one row' };
    if (block.rows.length > LIMITS.tableRows) return { error: 'too many table rows' };
    for (const row of block.rows) {
      if (!Array.isArray(row)) return { error: 'each table row must be an array' };
      if (row.length > LIMITS.tableCols) return { error: 'table row has too many columns' };
      for (const cell of row) {
        if (typeof cell !== 'string') return { error: 'table cells must be strings' };
        if (cell.length > LIMITS.rowsPerCell) return { error: 'table cell is too large' };
      }
    }
    return { errors: [] };
  },
  callout(block) {
    if (typeof block.html !== 'string') return { error: 'html is required for callout blocks' };
    if (block.html.length > LIMITS.richTextLength) return { error: 'callout html is too large' };
    if (block.tone !== undefined && !CALLOUT_TONES.has(block.tone)) return { error: 'callout tone must be neutral, success, warning or dark' };
    if (!htmlIsClean(block.html)) return { error: 'callout html contains unsanitized content', clean: cleanHtml(block.html) };
    return { errors: [] };
  },
  divider() {
    return { errors: [] };
  },
  links(block) {
    if (!Array.isArray(block.links)) return { error: 'links must be an array' };
    if (block.links.length > LIMITS.linksPerBlock) return { error: 'too many links' };
    for (const link of block.links) {
      if (!link || typeof link !== 'object') return { error: 'each link must be an object' };
      const labelErr = isNonEmptyString(link.label, 'label', LIMITS.linkLabelLength);
      if (labelErr) return { error: labelErr };
      const url = isValidUrl(link.href);
      if (!url.ok) return { error: url.error ? `href ${url.error}` : 'invalid link href' };
    }
    return { errors: [] };
  },
};

// Dynamic blocks: in Phase 1 their config is accepted loosely (they cannot
// currently be authored). They must still reject embedded structured data.
function validateDynamic(block) {
  const allowedScalar = ['string', 'number', 'boolean'];
  for (const [key, value] of Object.entries(block)) {
    if (key === 'id' || key === 'type' || key === 'meta') continue;
    const impossible = (() => {
      if (Array.isArray(value)) return !value.every((v) => typeof v === 'string');
      if (value && typeof value === 'object') {
        const v = value;
        if (typeof v.name === 'string' && ('rating' in v || 'trust_score' in v || 'min_deposit' in v)) return true;
        return false;
      }
      if (value === null || value === undefined) return false;
      return !allowedScalar.includes(typeof value);
    })();
    if (impossible) return { error: `dynamic block field "${key}" must contain references/configuration only, not embedded entities` };
  }
  return { errors: [] };
}

/**
 * Validates a single block object. Returns
 *   { valid:true, cleaned?:<block with sanitized html> }
 * or
 *   { valid:false, error:string, block? }
 */
export function validateBlock(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    return { valid: false, error: 'block must be an object' };
  }
  const type = block.type;
  if (typeof type !== 'string' || !KNOWN_TYPES.has(type)) {
    return { valid: false, error: `unknown block type: ${String(type ?? '(missing)')}` };
  }
  if (typeof block.id !== 'string' || !block.id.trim()) {
    return { valid: false, error: 'block requires a non-empty id' };
  }
  if (block.id.length > 200) {
    return { valid: false, error: 'block id is too long' };
  }

  const result = type === 'divider' || EDITORIAL_TYPES.has(type) ? validators[type](block) : null;
  const res = result ?? validateDynamic(block);
  if (res && res.error) {
    return { valid: false, error: res.error, block, cleaned: res.clean ? { ...block, html: res.clean } : undefined };
  }
  // Return the block with an idempotently cleaned html (richtext/callout), even
  // on success, so the server never stores anything it would reject later.
  const cleaned = { ...block };
  if (typeof cleaned.html === 'string') cleaned.html = cleanHtml(cleaned.html);
  return { valid: true, cleaned, warnings: res.clean ? [{ warning: 'html was re-sanitized' }] : [] };
}

/**
 * Validates a full document's blocks array. Returns first error (indexed) or a
 * cleaned copy of the whole array.
 */
export function validateBlocks(blocks) {
  if (blocks === undefined || blocks === null) return { valid: true, cleaned: [] };
  if (!Array.isArray(blocks)) return { valid: false, error: 'blocks must be an array' };
  if (blocks.length > LIMITS.blocksPerDocument) return { valid: false, error: 'document has too many blocks' };
  const cleaned = [];
  for (let i = 0; i < blocks.length; i++) {
    const res = validateBlock(blocks[i]);
    if (!res.valid) return { valid: false, error: `block ${i} (${res.error.toString().split(' ')[0] ?? 'invalid'}): ${res.error}` };
    cleaned.push(res.cleaned ?? blocks[i]);
  }
  return { valid: true, cleaned };
}

/**
 * Convenience: validates and returns {valid, cleaned, error} for use by
 * api/content.js without throwing. Rejects when `strict` and html contains
 * unsanitized rich text.
 */
export function blockValidatePayload(body, { strict = true } = {}) {
  if (!body || typeof body !== 'object') return { valid: false, error: 'payload must be an object' };
  if (body.blocks !== undefined && !Array.isArray(body.blocks)) {
    return { valid: false, error: 'blocks must be an array' };
  }
  const blocksRes = validateBlocks(Array.isArray(body.blocks) ? body.blocks : []);
  if (!blocksRes.valid) return blocksRes;
  if (strict && typeof body.html === 'string' && !htmlIsClean(body.html)) {
    return { valid: false, error: 'document html contains unsanitized content', cleaned: { ...body, html: cleanHtml(body.html) } };
  }
  return { valid: true, cleaned: { ...body, blocks: blocksRes.cleaned } };
}