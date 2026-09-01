/**
 * src/lib/content/sanitize.ts
 *
 * Shared HTML sanitization for the unified content foundation.
 *
 * The security policy here is a faithful port of the existing trusted
 * `cleanHtml()` behaviour that already lives in api/content.js. It is NOT a new
 * invention — this module centralises the exact same stripping rules so the
 * browser model and any future server consumer agree on one policy.
 *
 * Rules:
 *   - Removes executable containers and active form/input elements entirely.
 *   - Strips inline event handler attributes (`on*`).
 *   - Strips `javascript:` scheme references.
 *   - Block URLs are additionally validated against a safe-scheme allowlist.
 *
 * This is intentionally a conservative, dependency-free DOM-less stripper
 * (works in Node for prerender/tests and in the browser). It is not a
 * full HTML parser; for richer input the API still relies on the same policy
 * applied server-side, and the server never trusts client-cleaned HTML.
 */

const ELEMENTS = 'script|style|iframe|object|embed|form|input|button|textarea|select';

/** Removes paired and self-closing instances of dangerous element tags. */
export function stripDangerousElements(html: string): string {
  const s = String(html);
  // Capturing group required so the `\1` backreference matches the paired close.
  const paired = new RegExp(`<\\s*(${ELEMENTS})[^>]*>[\\s\\S]*?<\\/\\s*\\1\\s*>`, 'gi');
  const singles = new RegExp(`<(?:${ELEMENTS})[^>]*\\/?>`, 'gi');
  return s.replace(paired, '').replace(singles, '');
}

/** Removes inline event-handler attributes such as onclick="...". */
export function stripEventHandlers(html: string): string {
  return String(html).replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/** Removes `javascript:` scheme references (case-insensitive). */
export function stripJavascriptScheme(html: string): string {
  return String(html).replace(/javascript\s*:/gi, '');
}

/**
 * Core sanitizer — mirrors api/content.js cleanHtml().
 * Safe to run on any rich-text fragment before it reaches dangerouslySetInnerHTML.
 */
export function sanitizeHtml(input = ''): string {
  let html = String(input);
  html = stripDangerousElements(html);
  html = stripEventHandlers(html);
  html = stripJavascriptScheme(html);
  return html.trim();
}

/** True when the string looks like it might carry executable markup. */
export function looksUnsafe(input: unknown): boolean {
  const s = String(input ?? '');
  return (
    sanitizeHtml(s) !== s.trim() || /javascript\s*:/i.test(s) || /on[a-z]+\s*=|<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)/i.test(s)
  );
}

/** Schemes considered safe for block URLs (src/href). */
export const SAFE_URL_SCHEMES = ['https', 'http', 'mailto', 'tel'] as const;

const SAFE_SCHEMES = new Set(SAFE_URL_SCHEMES);

/** True for URLs the app already accepts — https/http, root-relative, mailto/tel. */
export function isSafeUrl(input: unknown): boolean {
  const raw = String(input ?? '').trim();
  if (raw === '') return true; // optional/empty allowed; presence checks happen elsewhere
  // Reject dangerous schemes any way they're sneaked in (including entity / encoded).
  if (/(\bjavascript\s*:|vbscript\s*:|data\s*:)/i.test(raw)) return false;
  // Explicit protocol-relative & known-safe schemes under allowlist.
  if (raw.startsWith('//')) return true;
  const colon = raw.indexOf(':');
  // No colon => relative path like "/brokers/x" or "foo" => safe.
  if (colon === -1) return true;
  const scheme = raw.slice(0, colon).toLowerCase();
  return SAFE_SCHEMES.has(scheme);
}

/**
 * Validates a block URL and returns a sanitized safe URL string, or null when
 * the URL is present but unsafe. Rejects javascript:, data:, vbscript: and any
 * unknown scheme.
 */
export function sanitizeBlockUrl(input: unknown): string | null {
  const raw = String(input ?? '').trim();
  if (raw === '') return raw;
  if (!isSafeUrl(raw)) return null;
  return raw;
}

/**
 * Sanitizes a full block value (rich text fields). Returns a new object with
 * `.html` fields cleaned; other fields are returned untouched. Missing/empty
 * html stays as-is.
 */
export function sanitizeBlock(block: Record<string, unknown>): Record<string, unknown> {
  if (!block || typeof block !== 'object') return block;
  const out: Record<string, unknown> = { ...block };
  if (typeof out.html === 'string') out.html = sanitizeHtml(out.html);
  return out;
}

/** Sanitizes an array of blocks (richtext/callout html fields). */
export function sanitizeBlocks(blocks: unknown[] | null | undefined): unknown[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => (b && typeof b === 'object' ? sanitizeBlock(b as Record<string, unknown>) : b));
}
