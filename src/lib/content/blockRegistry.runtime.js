/**
 * src/lib/content/blockRegistry.js
 *
 * Runtime-neutral block registry.
 *
 * This file is the single, canonical runtime implementation of the unified
 * Visual Content Builder (Phase 1) block registry. It is intentionally React-free,
 * DOM-free and TypeScript-free so it is safe to import from ANY runtime: the
 * browser (via Vite), Node build scripts, and Vercel's serverless Node functions
 * (which do not type-strip). The companion blockRegistry.ts is a thin typed
 * re-export wrapper around this module for TypeScript consumers.
 *
 * NOTE: This is NOT a second serializer. There is exactly one implementation of
 * the registry + serializer logic, and it lives here (and in blocksToHtml.js).
 * The corresponding .ts files only re-export these functions so they can be
 * consumed with type-checking. Never fork this logic into another file.
 */

/**
 * Escape exactly like the existing PageBuilder serializer (byte-for-byte).
 * @param {string} v
 * @returns {string}
 */
export function esc(v) {
  return String(v).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#039;';
    }
  });
}

/** Checks for a safe URL inside block data (src/href). */
export function validateUrlField(value, field) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return `${field} must be a string`;
  const s = value.trim();
  if (s === '') return null;
  // Conservative reject of executable schemes.
  if (/(\bjavascript\s*:|vbscript\s*:|data\s*:)/i.test(s)) return `${field} uses a disallowed scheme`;
  if (s.includes(':') && !/^https?:$/.test(s.slice(0, s.indexOf(':')).toLowerCase()) && !s.startsWith('/') && !s.startsWith('//')) {
    return `${field} uses a disallowed scheme`;
  }
  return null;
}

export function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') return `${field} is required`;
  return null;
}

/* ============================ block definitions ============================ */

const editorialAllowedOn = 'all';

/** Unique-per-process id generator (no crypto dependency; fine for both envs). */
let idCounter = 0;
function uid(prefix = 'b') {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const validHeadingLevels = ['h2', 'h3'];
const validCalloutTones = ['neutral', 'success', 'warning', 'dark'];

function normalizeHeadingLevel(value) {
  return validHeadingLevels.includes(value) ? value : 'h2';
}

/**
 * @returns {Record<string, import('./types.ts').BlockDef>}
 */
export function blocks() {
  return {
    heading: {
      type: 'heading',
      category: 'editorial',
      label: 'Heading',
      allowedOn: editorialAllowedOn,
      defaultProps: () => ({ id: uid('b'), type: 'heading', title: 'New section', level: 'h2' }),
      validate: (block) => {
        const req = requireNonEmptyString(block.title, 'title');
        if (req) return req;
        if (typeof block.title === 'string' && block.title.length > 500) return 'title is too long';
        if (block.level !== undefined && !validHeadingLevels.includes(block.level)) {
          return 'heading level must be h2 or h3';
        }
        return null;
      },
      toHtml: (block) => {
        const level = normalizeHeadingLevel(block.level);
        return `<${level}>${esc(block.title || 'Section heading')}</${level}>`;
      },
    },

    richtext: {
      type: 'richtext',
      category: 'editorial',
      label: 'Rich text',
      allowedOn: editorialAllowedOn,
      defaultProps: () => ({ id: uid('b'), type: 'richtext', html: '<p>Start writing this section…</p>' }),
      validate: (block) => {
        if (typeof block.html !== 'string') return 'html is required for richtext blocks';
        if (block.html.length > 200000) return 'richtext html is too large';
        return null;
      },
      toHtml: (block) => block.html || '',
    },

    image: {
      type: 'image',
      category: 'editorial',
      label: 'Image',
      allowedOn: editorialAllowedOn,
      defaultProps: () => ({ id: uid('b'), type: 'image', src: '', alt: '' }),
      validate: (block) => {
        const urlErr = validateUrlField(block.src, 'src');
        if (urlErr) return urlErr;
        if (block.alt && typeof block.alt !== 'string') return 'alt must be a string';
        return null;
      },
      toHtml: (block) =>
        `<figure><img src="${esc(block.src || '')}" alt="${esc(block.alt || '')}" loading="lazy" /><figcaption>${esc(block.alt || '')}</figcaption></figure>`,
    },

    table: {
      type: 'table',
      category: 'editorial',
      label: 'Table',
      allowedOn: editorialAllowedOn,
      defaultProps: () => ({ id: uid('b'), type: 'table', rows: [['Feature', 'Details'], ['', '']] }),
      validate: (block) => {
        if (!Array.isArray(block.rows)) return 'rows must be an array';
        if (block.rows.length === 0) return 'table must have at least one row';
        if (block.rows.length > 200) return 'too many table rows';
        for (const row of block.rows) {
          if (!Array.isArray(row)) return 'each table row must be an array';
          if (row.length > 60) return 'table row has too many columns';
          for (const cell of row) if (typeof cell !== 'string') return 'table cells must be strings';
        }
        return null;
      },
      toHtml: (block) => {
        const r = (block.rows || [['Feature', 'Details'], ['', '']]).map((row) => row.map((c) => esc(String(c ?? ''))));
        const header = r[0] || [];
        const body = r.slice(1);
        return [
          '<div class="overflow-x-auto"><table><thead><tr>',
          header.map((c) => `<th>${c}</th>`).join(''),
          '</tr></thead><tbody>',
          body.map((x) => `<tr>${x.map((c) => `<td>${c}</td>`).join('')}</tr>`).join(''),
          '</tbody></table></div>',
        ].join('');
      },
    },

    callout: {
      type: 'callout',
      category: 'editorial',
      label: 'Callout',
      allowedOn: editorialAllowedOn,
      defaultProps: () => ({ id: uid('b'), type: 'callout', html: '<p>Add an important note.</p>', tone: 'neutral' }),
      validate: (block) => {
        if (typeof block.html !== 'string') return 'html is required for callout blocks';
        if (block.tone !== undefined && !validCalloutTones.includes(block.tone)) {
          return 'callout tone must be neutral, success, warning or dark';
        }
        return null;
      },
      toHtml: (block) => `<aside class="piprank-callout piprank-callout-${block.tone || 'neutral'}">${block.html || ''}</aside>`,
    },

    divider: {
      type: 'divider',
      category: 'editorial',
      label: 'Divider',
      allowedOn: editorialAllowedOn,
      defaultProps: () => ({ id: uid('b'), type: 'divider' }),
      validate: () => null,
      toHtml: () => '<hr />',
    },

    links: {
      type: 'links',
      category: 'editorial',
      label: 'Internal links',
      allowedOn: editorialAllowedOn,
      defaultProps: () => ({ id: uid('b'), type: 'links', links: [{ label: 'Related PipRank page', href: '/' }] }),
      validate: (block) => {
        if (!Array.isArray(block.links)) return 'links must be an array';
        if (block.links.length > 100) return 'too many links';
        for (const link of block.links) {
          if (!link || typeof link !== 'object') return 'each link must be an object';
          if (typeof link.label !== 'string' || !link.label.trim()) return 'each link requires a label';
          const urlErr = validateUrlField(link.href, 'href');
          if (urlErr) return urlErr;
        }
        return null;
      },
      toHtml: (block) =>
        `<nav class="piprank-internal-links"><ul>${(block.links || [])
          .map((x) => `<li><a href="${esc(x.href)}">${esc(x.label)}</a></li>`)
          .join('')}</ul></nav>`,
    },

    /* ------------------------- future dynamic blocks ------------------------- */
    // Registered now so structure/allowedOn are known, but no toHtml yet — their
    // full resolution happens in later phases. They must not duplicate broker data;
    // they hold references/configuration resolved through dynamicResolvers.ts.
    hero: dynamicDef('hero', 'Hero', ['broker-editorial', 'country-page', 'global-guide', 'country-guide', 'global-intent', 'country-intent', 'standalone']),
    'broker-cards': dynamicDef('broker-cards', 'Broker cards', 'all'),
    'comparison-table': dynamicDef('comparison-table', 'Comparison table', 'all'),
    'best-for-cards': dynamicDef('best-for-cards', 'Best-for cards', 'all'),
    'regulation-table': dynamicDef('regulation-table', 'Regulation table', 'all'),
    'broker-data': dynamicDef('broker-data', 'Broker data', 'all'),
    'faq-accordion': dynamicDef('faq-accordion', 'FAQ accordion', 'all'),
    cta: dynamicDef('cta', 'Call to action', 'all'),
    author: dynamicDef('author', 'Author', 'all'),
  };
}

function dynamicDef(type, label, allowedOn) {
  return {
    type,
    category: 'dynamic',
    label,
    allowedOn,
    defaultProps: () => ({ id: uid('b'), type }),
    validate: () => null,
  };
}

function toBlockMap() {
  return blocks();
}

/** All registered types (editorial + dynamic). */
export function allBlockTypes() {
  return Object.keys(blocks());
}

/** True when the block type is registered. */
export function isKnownBlockType(type) {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(blocks(), type);
}

/** Look up a block definition by type. */
export function blockDef(type) {
  return toBlockMap()[type];
}

/**
 * Canonical serializer entry for a single block. Uses the registry; falls back
 * to a safe, explicit handling for unknown/unregistered types rather than
 * silently destroying content.
 */
export function blockToHtml(block) {
  if (!block || typeof block !== 'object') return '';
  const b = block;
  const t = b.type;
  if (t === 'richtext') return String(b.html ?? '');
  const def = typeof t === 'string' ? blockDef(t) : undefined;
  if (def?.toHtml) {
    try {
      return def.toHtml(b);
    } catch {
      return richTextFallback(b);
    }
  }
  if (def) return '';
  return richTextFallback(b);
}

function richTextFallback(b) {
  if (typeof b.html === 'string' && b.html.trim()) return b.html;
  if (typeof b.title === 'string' && b.title.trim()) return `<p>${esc(b.title)}</p>`;
  return '';
}
