import { readFileSync } from 'node:fs';
import { sanitizeBlocks, sanitizeHtml, sanitizePublicSettings } from '../api/_lib/content-sanitizer.js';

const prerenderSource = readFileSync(new URL('./prerender-canonical.mjs', import.meta.url), 'utf8');
const brokerFinalizeSource = readFileSync(new URL('./finalize-broker-prerender.mjs', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Prerender content safety check failed: ${message}`);
}

assert(prerenderSource.includes("../api/_lib/content-sanitizer.js"), 'canonical prerender must import the shared content sanitizer');
assert(prerenderSource.includes('sanitizeBlocks'), 'canonical prerender must sanitize document blocks');
assert(prerenderSource.includes('sanitizeHtml'), 'canonical prerender must sanitize document HTML');
assert(prerenderSource.includes('sanitizePublicSettings'), 'canonical prerender must sanitize public settings before FAQ/schema rendering');
assert(brokerFinalizeSource.includes("../api/_lib/content-sanitizer.js"), 'broker finalizer must import the shared content sanitizer');
assert(brokerFinalizeSource.includes('sanitizeBlocks'), 'broker finalizer must sanitize document blocks');
assert(brokerFinalizeSource.includes('sanitizePublicSettings'), 'broker finalizer must sanitize document settings before FAQ/schema rendering');

const html = sanitizeHtml('<p>Hello</p><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">bad</a>');
assert(html.includes('<p>Hello</p>'), 'safe HTML should survive');
assert(!html.includes('<script'), 'script tags must be removed');
assert(!html.includes('onerror'), 'event-handler attributes must be removed');
assert(!html.includes('javascript:'), 'javascript URLs must be removed');

const blocks = sanitizeBlocks([
  { type: 'richtext', html: '<p>Safe</p><script>alert(1)</script>' },
  { type: 'callout', html: '<img src="/safe.png" onerror="alert(1)">' },
  { type: 'unknown', html: '<script>alert(1)</script>' },
]);
assert(blocks.length === 2, 'unsupported block types must be removed');
assert(blocks[0].html.includes('<p>Safe</p>'), 'richtext should remain available');
assert(!blocks[0].html.includes('<script'), 'richtext must be sanitized');
assert(!blocks[1].html.includes('onerror'), 'callout HTML must be sanitized');

const settings = sanitizePublicSettings({
  faqs: [{ q: '<b>Question</b>', a: '<script>alert(1)</script>Answer' }],
  rankingMode: 'manual',
  pinnedBrokerSlugs: ['exness'],
});
assert(settings.rankingMode === 'manual', 'supported public settings should remain available');
assert(settings.faqs.length === 1 && settings.faqs[0].q, 'FAQ settings should remain available');

console.log('Prerender content safety validation passed.');
