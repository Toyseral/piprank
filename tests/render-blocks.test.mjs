// tests/render-blocks.test.mjs
// Phase 1 — Node boundary (scripts/render-blocks.mjs) that must drive the SAME
// shared serializer the browser uses, so prerender and the frontend never
// diverge. Verifies parity against PageBuilder's exported blocksToHtml.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksToHtmlServer, renderBlocks, isKnownBlock, safeBlockUrl } from '../scripts/render-blocks.mjs';
import { blocksToHtml } from '../src/lib/content/blocksToHtml.ts';

const SAMPLE = [
  { id: '1', type: 'heading', title: 'Fees' },
  { id: '2', type: 'richtext', html: '<p>Body</p>' },
  { id: '3', type: 'image', src: '/i.png', alt: 'i' },
  { id: '4', type: 'table', rows: [['A'], ['1']] },
  { id: '5', type: 'callout', html: '<p>n</p>', tone: 'success' },
  { id: '6', type: 'divider' },
  { id: '7', type: 'links', links: [{ label: 'L', href: '/l' }] },
];

test('render-blocks boundary === browser serializer (no divergence)', () => {
  assert.equal(blocksToHtmlServer(SAMPLE), blocksToHtml(SAMPLE));
});

test('renderBlocks parses JSON strings', () => {
  const { html } = renderBlocks(JSON.stringify(SAMPLE));
  assert.equal(html, blocksToHtml(SAMPLE));
});

test('renderBlocks rejects malformed input without crashing', () => {
  assert.equal(renderBlocks('not json').html, '');
  assert.ok(renderBlocks('not json').error);
  assert.equal(renderBlocks({ not: 'array' }).error, 'blocks must be an array');
});

test('isKnownBlock and safeBlockUrl work through the boundary', () => {
  assert.equal(isKnownBlock('heading'), true);
  assert.equal(isKnownBlock('nope'), false);
  assert.equal(safeBlockUrl('javascript:alert(1)'), null);
  assert.equal(safeBlockUrl('/safe'), '/safe');
});