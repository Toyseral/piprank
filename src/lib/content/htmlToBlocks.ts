/**
 * src/lib/content/htmlToBlocks.ts
 *
 * Legacy HTML → blocks normalization.
 *
 * Converts the legacy flat `html` cache of content_documents into block form so
 * the future unified editor can seed itself from existing content without data
 * loss.
 *
 * Losslessness is the hard invariant here: every top-level HTML element must
 * either map to a known block, or be preserved inside a richtext block. Nothing
 * silently disappears.
 *
 * This module is DOM-free (no DOMParser) so it runs identically in the browser
 * and in Node scripts (tests, prerender, migration tooling). It operates on
 * well-formed fragments which matches how SanitizeHtml stores content.
 */

import type { PageBlock, TableBlock, CalloutBlock, LinksBlock } from './types.ts';

export interface HtmlToBlocksResult {
  blocks: PageBlock[];
  /** Number of top-level nodes that fell through to a richtext preserve. */
  preserved: number;
  /** True when any top-level node could not map to a known block. */
  hadUnknown: boolean;
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

let idCounter = 0;
function newBlockId(): string {
  idCounter += 1;
  return `legacy-${Date.now()}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ============================ minimal tokenizer ============================ */

interface TagToken {
  start: number;
  end: number;
  name: string;
  isClose: boolean;
  selfClose: boolean;
}

/** Tokenizes all element tags (open/close/self-closing) with their spans. */
function tagTokens(html: string): TagToken[] {
  const tokens: TagToken[] = [];
  const re = /<\/?[a-zA-Z][^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[0];
    const inner = raw.replace(/^<\/?/, '').replace(/>$/, '').trim();
    const isClose = raw[1] === '/';
    const name = inner.split(/[\s/]/)[0]?.toLowerCase() ?? '';
    const selfClose = /\/\s*$/.test(inner) || VOID_TAGS.has(name);
    tokens.push({ start: m.index, end: m.index + raw.length, name, isClose, selfClose });
  }
  return tokens;
}

interface TopLevelNode {
  start: number;
  end: number;
  name: string;
}

/**
 * Splits a fragment into top-level element spans. Text between the spans is
 * returned separately so nothing is lost.
 */
function splitTopLevel(html: string): { nodes: TopLevelNode[] } {
  const tokens = tagTokens(html);
  const nodes: TopLevelNode[] = [];
  const depth: string[] = [];
  let currentTop: TopLevelNode | null = null;

  for (const t of tokens) {
    if (t.isClose) {
      if (depth.length > 0 && depth[depth.length - 1] === t.name) {
        depth.pop();
        if (depth.length === 0 && currentTop) {
          currentTop.end = t.end;
          nodes.push(currentTop);
          currentTop = null;
        }
      } else if (depth.length === 0 && currentTop) {
        // Unexpected closing tag directly inside a top-level element — keep it
        // buffered inside the open node rather than dropping content.
      }
    } else if (t.selfClose) {
      if (depth.length === 0 && !currentTop) {
        nodes.push({ start: t.start, end: t.end, name: t.name });
      }
    } else {
      if (depth.length === 0 && !currentTop) {
        currentTop = { start: t.start, end: -1, name: t.name };
      }
      depth.push(t.name);
    }
  }
  // A top-level element that never closed: preserve to the end so it isn't lost.
  if (currentTop && currentTop.end === -1) {
    currentTop.end = html.length;
    nodes.push(currentTop);
  }
  return { nodes };
}

/* ================================ helpers ================================ */

/** Strips tags from a fragment to obtain plain text. */
export function textContent(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Decodes the common entities our sanitizer emits plus numeric references. */
export function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    copy: '©',
    reg: '®',
    trade: '™',
    hellip: '…',
    mdash: '—',
    ndash: '–',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    bull: '•',
    middot: '·',
  };
  return s.replace(/&(?:#x?([0-9a-fA-F]+)|([a-z]+));?/g, (full, hexNum, name) => {
    if (hexNum !== undefined) {
      const code = String(hexNum);
      const n = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      if (!Number.isNaN(n)) {
        try {
          return String.fromCodePoint(n);
        } catch {
          return full;
        }
      }
      return full;
    }
    const lower = (name ?? '').toLowerCase();
    return named[lower] !== undefined ? named[lower] : full;
  });
}

function attrValue(tag: string, attr: string): string {
  const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'ig');
  const m = re.exec(tag);
  if (!m) return '';
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

interface ParsedTable {
  rows: string[][];
}

/** Parses a static HTML table into rows of cell text. */
function parseTable(inner: string): ParsedTable | null {
  const rows: string[][] = [];
  const rowRe = /<\s*tr\b[^>]*>([\s\S]*?)<\s*\/\s*tr\s*>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(inner)) !== null) {
    const cells: string[] = [];
    const cellRe = /<\s*(td|th)\b[^>]*>([\s\S]*?)<\s*\/\s*(?:td|th)\s*>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      cells.push(decodeEntities(textContent(cm[2])));
    }
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return null;
  return { rows };
}

interface ParsedLinks {
  links: { label: string; href: string }[];
}

/** Parses the existing PipRank internal-links nav markup into link items. */
function parseInternalLinks(inner: string): ParsedLinks | null {
  const links: { label: string; href: string }[] = [];
  const aRe = /<\s*a\b([^>]*)>([\s\S]*?)<\s*\/\s*a\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(inner)) !== null) {
    const href = attrValue(m[1], 'href');
    if (!href) continue;
    const text = decodeEntities(textContent(m[2]));
    if (!text) continue;
    links.push({ label: text, href });
  }
  if (links.length === 0) return null;
  return { links };
}

/* ============================ top-level converters ============================ */

/** Tags that legitimately map to a richtext block (known-to-richtext). */
const KNOWN_RICHTEXT_TAGS = new Set(['p', 'ul', 'ol', 'blockquote', 'div', 'section', 'span', 'strong', 'em', 'b', 'i', 'a']);

function toRichtextBlock(raw: string): PageBlock {
  return { id: newBlockId(), type: 'richtext', html: raw };
}

/**
 * Converts a single top-level node span into a block, preserving unknown or
 * ambiguous structures as richtext.
 */
function nodeToBlock(html: string, node: TopLevelNode): PageBlock {
  const raw = html.slice(node.start, node.end);
  const name = node.name;

  if (name === 'h2' || name === 'h3') {
    return { id: newBlockId(), type: 'heading', level: name, title: decodeEntities(textContent(raw)) };
  }

  if (name === 'p' || name === 'ul' || name === 'ol' || name === 'blockquote' || name === 'section') {
    return toRichtextBlock(raw);
  }

  if (name === 'div') {
    // The shared serializer wraps tables as
    // <div class="overflow-x-auto"><table>…</table></div>. Recognize that exact
    // wrapper so the serializer's own output maps back to a table block on
    // migration instead of falling through to richtext.
    const tableMatch = raw.match(/<\s*table\b[\s\S]*?<\s*\/\s*table\s*>?/i);
    if (tableMatch && /overflow-x-auto/.test(raw.slice(0, Math.min(raw.length, 120)))) {
      const parsed = parseTable(tableMatch[0]);
      if (parsed) {
        return { id: newBlockId(), type: 'table', rows: parsed.rows };
      }
    }
    return toRichtextBlock(raw);
  }

  if (name === 'img' || name === 'figure') {
    // Extract the src/alt from the (possibly wrapped) <img> when present.
    const m = /<\s*img\b([^>]*)>?/i.exec(raw);
    if (name === 'img' || (m && /figure/i.test(raw))) {
      const imgTag = m ? m[0] : raw;
      const src = attrValue(imgTag, 'src');
      const alt = attrValue(imgTag, 'alt');
      return {
        id: newBlockId(),
        type: 'image',
        src: src || '',
        alt: alt || '',
      };
    }
    return toRichtextBlock(raw);
  }

  if (name === 'hr') {
    return { id: newBlockId(), type: 'divider' };
  }

  if (name === 'table') {
    const parsed = parseTable(raw);
    if (parsed) {
      const block: TableBlock = { id: newBlockId(), type: 'table', rows: parsed.rows };
      return block;
    }
    return toRichtextBlock(raw);
  }

  if (name === 'aside' && /piprank-callout/.test(raw.slice(0, Math.min(raw.length, 160)))) {
    const toneMatch = /piprank-callout-(neutral|success|warning|dark)/i.exec(raw);
    const inner = raw.replace(/^<\s*aside\b[^>]*>/i, '').replace(/<\s*\/\s*aside\s*>$/i, '');
    const block: CalloutBlock = {
      id: newBlockId(),
      type: 'callout',
      html: inner,
      tone: (toneMatch?.[1] as CalloutBlock['tone']) || 'neutral',
    };
    return block;
  }

  if (name === 'nav' && /piprank-internal-links/.test(raw.slice(0, Math.min(raw.length, 160)))) {
    const inner = raw.replace(/^<\s*nav\b[^>]*>/i, '').replace(/<\s*\/\s*nav\s*>$/i, '');
    const parsed = parseInternalLinks(inner);
    if (parsed && parsed.links.length > 0) {
      const block: LinksBlock = { id: newBlockId(), type: 'links', links: parsed.links };
      return block;
    }
    return toRichtextBlock(raw);
  }

  // Any other element (h1, h4-h6, pre, iframe already sanitized away, etc.) is
  // preserved verbatim inside a richtext block. Content is never dropped.
  return toRichtextBlock(raw);
}

/**
 * Converts legacy HTML into blocks. Guarantees:
 *   - known structures map to known blocks
 *   - everything else is preserved inside a richtext block
 *   - whitespace between elements is discarded (cosmetic only)
 *
 * Returns the blocks plus preservation diagnostics.
 */
export function htmlToBlocks(html: string | null | undefined): HtmlToBlocksResult {
  const source = String(html ?? '').trim();
  if (!source) return { blocks: [], preserved: 0, hadUnknown: false };

  const { nodes } = splitTopLevel(source);
  const blocks: PageBlock[] = [];
  let preserved = 0;
  let hadUnknown = false;

  let pos = 0;
  for (const node of nodes) {
    // Interstitial content (stray text / malformed leftovers) preserved.
    if (node.start > pos) {
      const stray = source.slice(pos, node.start);
      if (stray.trim() !== '') {
        blocks.push(toRichtextBlock(stray.trim()));
        preserved += 1;
        hadUnknown = true;
      }
    }
    const block = nodeToBlock(source, node);
    blocks.push(block);
    if (block.type === 'richtext') {
      preserved += 1;
      // Only marks genuinely unknown top-level structures (not p/ul/ol/etc,
      // which map to richtext as their known block).
      if (!KNOWN_RICHTEXT_TAGS.has(node.name)) hadUnknown = true;
    }
    pos = node.end;
  }

  // Trailing content after the last element — preserved, never dropped.
  if (pos < source.length) {
    const stray = source.slice(pos);
    if (stray.trim() !== '') {
      blocks.push(toRichtextBlock(stray.trim()));
      preserved += 1;
    }
  }

  return { blocks, preserved, hadUnknown };
}

/**
 * Converts legacy HTML to blocks, ignoring empty results (returns [] for
 * blank/whitespace-only input). Convenience wrapper for editor seeding.
 */
export function htmlToBlocksSeeded(html: string | null | undefined): PageBlock[] {
  return htmlToBlocks(html).blocks;
}

/** Convenience: does the fragment contain any real text (for has-content checks)? */
export function htmlHasText(html: string | null | undefined): boolean {
  return textContent(String(html ?? '')).length > 0;
}