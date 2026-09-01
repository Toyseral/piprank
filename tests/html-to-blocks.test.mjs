// tests/html-to-blocks.test.mjs
// Phase 1 — legacy HTML → blocks normalization. Every top-level element must
// map to a known block or be preserved inside a richtext block. Nothing drops.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToBlocks } from '../src/lib/content/htmlToBlocks.ts';
import { blocksToHtml } from '../src/lib/content/blocksToHtml.ts';

function types(html) {
  return htmlToBlocks(html).blocks.map((b) => b.type);
}

test('mixed content maps to heading, richtext, image, richtext', () => {
  const html = '<h2>Fees</h2>\n<p>Intro</p>\n<img src="/images/a.jpg" alt="A" />\n<p>Conclusion</p>';
  const { blocks, hadUnknown } = htmlToBlocks(html);
  assert.deepEqual(blocks.map((b) => b.type), ['heading', 'richtext', 'image', 'richtext']);
  assert.equal(hadUnknown, false);
  const h = blocks[0];
  assert.equal(h.title, 'Fees');
  assert.equal(h.level, 'h2');
  const img = blocks[2];
  assert.equal(img.src, '/images/a.jpg');
  assert.equal(img.alt, 'A');
});

test('h2 and h3 both map to heading blocks', () => {
  const { blocks } = htmlToBlocks('<h2>Fees</h2><h3>Withdrawal</h3>');
  assert.deepEqual(blocks.map((b) => b.type), ['heading', 'heading']);
  assert.equal(blocks[0].level, 'h2');
  assert.equal(blocks[1].level, 'h3');
});

test('lists stay inside richtext blocks (no separate list block)', () => {
  const html = '<ul><li>One</li><li>Two</li></ul><ol><li>A</li></ol>';
  const { blocks } = htmlToBlocks(html);
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every((b) => b.type === 'richtext'));
  assert.match(blocks[0].html, /<ul>/);
  assert.match(blocks[1].html, /<ol>/);
});

test('static tables convert to table blocks', () => {
  const html = '<table><tr><th>Feature</th><th>Details</th></tr><tr><td>Spread</td><td>0.1</td></tr></table>';
  const { blocks } = htmlToBlocks(html);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'table');
  assert.deepEqual(blocks[0].rows, [['Feature', 'Details'], ['Spread', '0.1']]);
});

test('serializer-wrapped tables (overflow-x-auto div) convert back to table blocks', () => {
  const wrapped = '<div class="overflow-x-auto"><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table></div>';
  const { blocks } = htmlToBlocks(wrapped);
  assert.equal(blocks[0].type, 'table');
  assert.deepEqual(blocks[0].rows, [['A'], ['B']]);
});

test('images (plain and figure) convert to image blocks', () => {
  const plain = htmlToBlocks('<img src="/x.png" alt="X" />');
  assert.equal(plain.blocks[0].type, 'image');
  assert.equal(plain.blocks[0].src, '/x.png');

  const wrapped = htmlToBlocks('<figure><img src="/y.jpg" alt="Y" loading="lazy" /><figcaption>Y</figcaption></figure>');
  assert.equal(wrapped.blocks[0].type, 'image');
  assert.equal(wrapped.blocks[0].src, '/y.jpg');
});

test('callouts convert to callout blocks with tone preserved', () => {
  const html = '<aside class="piprank-callout piprank-callout-warning"><p>Careful</p></aside>';
  const { blocks } = htmlToBlocks(html);
  assert.equal(blocks[0].type, 'callout');
  assert.equal(blocks[0].tone, 'warning');
  assert.equal(blocks[0].html, '<p>Careful</p>');
});

test('dividers convert to divider blocks', () => {
  const { blocks } = htmlToBlocks('<p>Before</p><hr /><p>After</p>');
  assert.deepEqual(blocks.map((b) => b.type), ['richtext', 'divider', 'richtext']);
});

test('internal-links nav converts to links blocks', () => {
  const html = '<nav class="piprank-internal-links"><ul><li><a href="/vietnam">Vietnam brokers</a></li><li><a href="/guides">Guides</a></li></ul></nav>';
  const { blocks } = htmlToBlocks(html);
  assert.equal(blocks[0].type, 'links');
  assert.deepEqual(blocks[0].links, [
    { label: 'Vietnam brokers', href: '/vietnam' },
    { label: 'Guides', href: '/guides' },
  ]);
});

test('unknown HTML is preserved as richtext (never dropped)', () => {
  const html = '<video>Legacy embed content</video><canvas>canvas content</canvas>';
  const { blocks, preserved, hadUnknown } = htmlToBlocks(html);
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every((b) => b.type === 'richtext'));
  assert.equal(preserved, 2);
  assert.equal(hadUnknown, true);
  // Serializing back must keep the original markup inside richtext blocks.
  const roundtrip = blocksToHtml(blocks);
  assert.match(roundtrip, /<video>Legacy embed content<\/video>/);
  assert.match(roundtrip, /<canvas>canvas content<\/canvas>/);
});

test('empty HTML produces no blocks', () => {
  assert.equal(htmlToBlocks('').blocks.length, 0);
  assert.equal(htmlToBlocks('   ').blocks.length, 0);
  assert.equal(htmlToBlocks(null).blocks.length, 0);
});

test('mixed known + unknown content is fully preserved', () => {
  const html = '<h2>Head</h2><p>Para</p><custom-widget data-x="1">widget</custom-widget><hr />';
  const { blocks } = htmlToBlocks(html);
  assert.deepEqual(blocks.map((b) => b.type), ['heading', 'richtext', 'richtext', 'divider']);
  const htmlOut = blocksToHtml(blocks);
  assert.match(htmlOut, /<custom-widget data-x="1">widget<\/custom-widget>/);
});

test('nested content inside a top-level element is captured intact', () => {
  const html = '<blockquote><p>Quoted <strong>text</strong> with a <a href="/x">link</a></p></blockquote>';
  const { blocks } = htmlToBlocks(html);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'richtext');
  assert.match(blocks[0].html, /<blockquote><p>Quoted <strong>text<\/strong> with a <a href="\/x">link<\/a><\/p><\/blockquote>/);
});

test('round-trip: serialized blocks preserve all semantic text', () => {
  const originalHtml = '<h2>Fees</h2><p>Intro paragraph.</p><ul><li>One</li><li>Two</li></ul><h3>Costs</h3><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><hr /><p>Done.</p>';
  const { blocks } = htmlToBlocks(originalHtml);
  const out = blocksToHtml(blocks);
  for (const token of ['Fees', 'Intro paragraph.', 'One', 'Two', 'Costs', '<table>', 'Done.']) {
    assert.ok(out.includes(token), `expected "${token}" to survive round-trip`);
  }
});