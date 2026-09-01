// tests/serializer.test.mjs
// Phase 1 — shared serializer (blocksToHtml.ts via blockRegistry.ts). Must
// render every editorial block and stay byte-for-byte identical to the
// historical inline serializer that previously lived in PageBuilder.tsx
// (reconstructed here as the reference implementation).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksToHtml, serializeBlocksWithErrors } from '../src/lib/content/blocksToHtml.ts';
import { isKnownBlockType } from '../src/lib/content/blockRegistry.ts';

// Historical PageBuilder blocksToHtml (reference) — the shared serializer must
// be byte-identical so live pages and prerender output never change.
function esc(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}
function legacyBlocksToHtml(blocks) {
  return blocks
    .map((b) => {
      if (b.type === 'heading') return `<h2>${esc(b.title || 'Section heading')}</h2>`;
      if (b.type === 'image') return `<figure><img src="${esc(b.src || '')}" alt="${esc(b.alt || '')}" loading="lazy" /><figcaption>${esc(b.alt || '')}</figcaption></figure>`;
      if (b.type === 'table') {
        const r = b.rows || [['Feature', 'Details'], ['', '']];
        return `<div class="overflow-x-auto"><table><thead><tr>${r[0].map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.slice(1).map((x) => `<tr>${x.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      if (b.type === 'callout') return `<aside class="piprank-callout piprank-callout-${b.tone || 'neutral'}">${b.html || ''}</aside>`;
      if (b.type === 'links') return `<nav class="piprank-internal-links"><ul>${(b.links || []).map((x) => `<li><a href="${esc(x.href)}">${esc(x.label)}</a></li>`).join('')}</ul></nav>`;
      if (b.type === 'divider') return '<hr />';
      return b.html || '';
    })
    .join('\n');
}

const SAMPLE = [
  { id: '1', type: 'heading', title: 'Fees & costs', level: 'h2' },
  { id: '2', type: 'richtext', html: '<p>Intro & more</p>\n<ul><li>One</li></ul>' },
  { id: '3', type: 'image', src: '/img/a.png', alt: 'Chart' },
  { id: '4', type: 'table', rows: [['Feature', 'Details'], ['Spread', '0.1'], ["<script>", '&']] },
  { id: '5', type: 'callout', html: '<p>Heads up</p>', tone: 'warning' },
  { id: '6', type: 'divider' },
  { id: '7', type: 'links', links: [{ label: 'Vietnam brokers', href: '/vietnam' }] },
];

test('serializer output is byte-for-byte identical to the historical implementation', () => {
  assert.equal(blocksToHtml(SAMPLE), legacyBlocksToHtml(SAMPLE));
});

test('heading block renders h2 and escapes title', () => {
  assert.equal(blocksToHtml([{ id: 'x', type: 'heading', title: 'Fees & taxes' }]), '<h2>Fees &amp; taxes</h2>');
});

test('richtext block renders its html verbatim', () => {
  assert.equal(blocksToHtml([{ id: 'x', type: 'richtext', html: '<p>Hello</p>' }]), '<p>Hello</p>');
});

test('image, table, callout, divider, links all serialize', () => {
  const html = blocksToHtml(SAMPLE);
  assert.match(html, /<figure><img src="\/img\/a\.png" alt="Chart" loading="lazy" \/><figcaption>Chart<\/figcaption><\/figure>/);
  assert.match(html, /class="overflow-x-auto"><table>/);
  assert.match(html, /<th>Feature<\/th>/);
  assert.match(html, /piprank-callout-warning/);
  assert.match(html, /<hr \/>/);
  assert.match(html, /piprank-internal-links/);
});

test('heading level h3 is respected', () => {
  assert.equal(blocksToHtml([{ id: 'x', type: 'heading', title: 'Costs', level: 'h3' }]), '<h3>Costs</h3>');
});

test('empty blocks array serializes to empty string', () => {
  assert.equal(blocksToHtml([]), '');
  assert.equal(blocksToHtml(null), '');
});

test('unknown block types are flagged but their content is preserved', () => {
  const unknown = [{ id: 'u', type: 'mystery-block', html: '<p>Keep me</p>' }];
  const { html, errors } = serializeBlocksWithErrors(unknown);
  assert.equal(html, '<p>Keep me</p>');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].fallback, true);
});

test('blocksProduceHtml distinguishes real content from empty blocks', async () => {
  const { blocksProduceHtml } = await import('../src/lib/content/blocksToHtml.ts');
  assert.equal(blocksProduceHtml([{ id: 'x', type: 'richtext', html: '<p>..</p>' }]), true);
  assert.equal(blocksProduceHtml([{ id: 'x', type: 'richtext', html: '' }]), false);
  assert.equal(blocksProduceHtml([{ id: 'x', type: 'divider' }]), true);
  assert.equal(blocksProduceHtml([]), false);
});

test('all editorial + dynamic block types are registered', () => {
  for (const t of ['heading', 'richtext', 'image', 'table', 'callout', 'divider', 'links']) {
    assert.equal(isKnownBlockType(t), true, t);
  }
  for (const t of ['hero', 'broker-cards', 'comparison-table', 'best-for-cards', 'regulation-table', 'broker-data', 'faq-accordion', 'cta', 'author']) {
    assert.equal(isKnownBlockType(t), true, t);
  }
  assert.equal(isKnownBlockType('not-a-type'), false);
});