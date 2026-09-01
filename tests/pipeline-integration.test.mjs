// tests/pipeline-integration.test.mjs
// Phase 2 — Integration tests for the unified load/save pipeline.
//
// Covers the 9 regression scenarios:
//  1. Legacy html-only document loads into editor without data loss
//  2. Legacy document saves without modification preserves html
//  3. Editor with seeded blocks saves correctly
//  4. New empty document initializes cleanly
//  5. Explicit empty by admin is respected
//  6. Document with blocks loads and saves correctly
//  7. Load → seed → save → load round-trip preserves content
//  8. Block sanitization strips executable content
//  9. prepareDocumentForSave handles all edge cases

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDocumentForEditor, initEditorBlocks } from '../src/lib/content/loadDocument.ts';
import { prepareForSave, prepareDocumentForSave } from '../src/lib/content/savePipeline.ts';
import { blocksToHtml } from '../src/lib/content/blocksToHtml.ts';
import { htmlToBlocks } from '../src/lib/content/htmlToBlocks.ts';

const LEGACY_HTML = '<h2>EUR/USD Brokers</h2><p>Compare the best forex brokers for EUR/USD trading.</p><ul><li>Low spreads</li><li>Fast execution</li></ul>';

const LEGACY_DOC = {
  blocks: [],
  html: LEGACY_HTML,
};

const BLOCKS_DOC = {
  blocks: [
    { id: 'h1', type: 'heading', title: 'EUR/USD Brokers', level: 'h2' },
    { id: 'p1', type: 'richtext', html: '<p>Compare the best forex brokers.</p>' },
  ],
  html: '<h2>EUR/USD Brokers</h2><p>Compare the best forex brokers.</p>',
};

/* ========================= loadDocumentForEditor ========================= */

test('loadDocumentForEditor: legacy html-only doc seeds blocks from html', () => {
  const result = loadDocumentForEditor(LEGACY_DOC);
  assert.ok(result.blocks.length > 0, 'blocks must be seeded from html');
  assert.equal(result.html, LEGACY_HTML, 'original html preserved');
  assert.equal(result.seededFromLegacy, true, 'flagged as seeded from legacy');
});

test('loadDocumentForEditor: document with blocks returns them directly', () => {
  const result = loadDocumentForEditor(BLOCKS_DOC);
  assert.equal(result.blocks.length, BLOCKS_DOC.blocks.length);
  assert.equal(result.html, BLOCKS_DOC.html);
  assert.equal(result.seededFromLegacy, false);
});

test('loadDocumentForEditor: null/undefined returns empty', () => {
  assert.deepEqual(loadDocumentForEditor(null).blocks, []);
  assert.deepEqual(loadDocumentForEditor(undefined).blocks, []);
});

test('loadDocumentForEditor: empty document returns empty blocks', () => {
  const result = loadDocumentForEditor({ blocks: [], html: '' });
  assert.deepEqual(result.blocks, []);
  assert.equal(result.html, '');
});

test('loadDocumentForEditor: document with only whitespace html returns empty', () => {
  const result = loadDocumentForEditor({ blocks: [], html: '   ' });
  assert.deepEqual(result.blocks, []);
});

/* ========================= initEditorBlocks ========================= */

test('initEditorBlocks: legacy doc seeds blocks via htmlToBlocks', () => {
  const blocks = initEditorBlocks(LEGACY_DOC);
  assert.ok(blocks.length > 0, 'must seed blocks from html');
  assert.equal(blocks[0].type, 'heading', 'first block should be a heading');
});

test('initEditorBlocks: doc with blocks returns existing blocks', () => {
  const blocks = initEditorBlocks(BLOCKS_DOC);
  assert.equal(blocks.length, BLOCKS_DOC.blocks.length);
  assert.equal(blocks[0].id, 'h1');
});

test('initEditorBlocks: null doc with seedBlocks returns seedBlocks', () => {
  const seed = [{ id: 'seed-1', type: 'richtext', html: '<p>seeded</p>' }];
  const blocks = initEditorBlocks(null, seed);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].id, 'seed-1');
});

test('initEditorBlocks: null doc without seedBlocks returns empty', () => {
  assert.deepEqual(initEditorBlocks(null), []);
});

test('initEditorBlocks: legacy doc seeded blocks are valid PageBlock shapes', () => {
  const blocks = initEditorBlocks(LEGACY_DOC);
  for (const block of blocks) {
    assert.ok(typeof block.id === 'string' && block.id.length > 0, 'block must have id');
    assert.ok(typeof block.type === 'string', 'block must have type');
  }
});

/* ========================= prepareForSave ========================= */

test('prepareForSave: new document with blocks derives html', () => {
  const result = prepareForSave(null, [
    { id: 'h1', type: 'heading', title: 'Test' },
    { id: 'p1', type: 'richtext', html: '<p>Hello</p>' },
  ]);
  assert.equal(result.blocks.length, 2);
  assert.ok(result.html.includes('Test'));
  assert.ok(result.html.includes('Hello'));
  assert.equal(result.preservedLegacy, false);
  assert.equal(result.seededFromLegacy, false);
});

test('prepareForSave: legacy doc with empty incoming blocks preserves html', () => {
  const result = prepareForSave(LEGACY_DOC, []);
  assert.equal(result.html, LEGACY_HTML);
  assert.equal(result.preservedLegacy, true);
  assert.ok(result.blocks.length > 0, 'blocks seeded from legacy html');
});

test('prepareForSave: legacy doc with empty incoming blocks and explicitEmpty clears', () => {
  const result = prepareForSave(LEGACY_DOC, [], { explicitEmpty: true });
  assert.equal(result.html, '');
  assert.equal(result.blocks.length, 0);
  assert.equal(result.preservedLegacy, false);
});

test('prepareForSave: doc with blocks and matching incoming blocks derives html', () => {
  const incoming = [
    { id: 'h1', type: 'heading', title: 'Updated' },
    { id: 'p1', type: 'richtext', html: '<p>New content</p>' },
  ];
  const result = prepareForSave(BLOCKS_DOC, incoming);
  assert.equal(result.blocks.length, 2);
  assert.ok(result.html.includes('Updated'));
  assert.ok(result.html.includes('New content'));
  assert.equal(result.preservedLegacy, false);
});

test('prepareForSave: incoming blocks are sanitized (executable content stripped)', () => {
  const malicious = [
    { id: 'h1', type: 'heading', title: 'Test' },
    { id: 'p1', type: 'richtext', html: '<p>Hello</p><script>alert("xss")</script>' },
  ];
  const result = prepareForSave(null, malicious);
  assert.ok(!result.html.includes('<script>'), 'script tags must be stripped');
  assert.ok(result.html.includes('Hello'), 'content must be preserved');
});

/* ========================= prepareDocumentForSave ========================= */

test('prepareDocumentForSave: returns flat blocks/html for API payload', () => {
  const result = prepareDocumentForSave(null, [
    { id: 'h1', type: 'heading', title: 'Test' },
  ]);
  assert.ok(Array.isArray(result.blocks));
  assert.equal(typeof result.html, 'string');
  assert.ok(result.html.includes('Test'));
});

test('prepareDocumentForSave: legacy doc preserves html when incoming blocks empty', () => {
  const result = prepareDocumentForSave(LEGACY_DOC, []);
  assert.equal(result.html, LEGACY_HTML);
});

test('prepareDocumentForSave: explicitEmpty clears legacy content', () => {
  const result = prepareDocumentForSave(LEGACY_DOC, [], { explicitEmpty: true });
  assert.equal(result.html, '');
  assert.equal(result.blocks.length, 0);
});

/* ========================= round-trip regression ========================= */

test('round-trip: load legacy → seed blocks → save → load again preserves content', () => {
  // Step 1: Load legacy document.
  const loaded = loadDocumentForEditor(LEGACY_DOC);
  assert.ok(loaded.blocks.length > 0, 'step 1: blocks seeded');

  // Step 2: Save (simulating what the API does).
  const saved = prepareForSave(LEGACY_DOC, loaded.blocks);
  assert.ok(saved.html.length > 0, 'step 2: html derived from blocks');

  // Step 3: Load the saved document.
  const reloaded = loadDocumentForEditor({ blocks: saved.blocks, html: saved.html });
  assert.ok(reloaded.blocks.length > 0, 'step 3: blocks present after reload');
  assert.equal(reloaded.seededFromLegacy, false, 'step 3: no longer flagged as legacy');

  // Step 4: Content survives.
  assert.ok(reloaded.html.includes('EUR/USD'), 'EUR/USD content survives round-trip');
  assert.ok(reloaded.html.includes('Compare'), 'comparison content survives');
});

test('round-trip: load blocks doc → save → load again preserves blocks', () => {
  const loaded = loadDocumentForEditor(BLOCKS_DOC);
  const saved = prepareForSave(BLOCKS_DOC, loaded.blocks);
  const reloaded = loadDocumentForEditor({ blocks: saved.blocks, html: saved.html });
  assert.equal(reloaded.blocks.length, BLOCKS_DOC.blocks.length);
  assert.ok(reloaded.html.includes('EUR/USD'));
});

/* ========================= edge cases ========================= */

test('incoming blocks with unknown types are sanitized but preserved', () => {
  const blocks = [
    { id: 'h1', type: 'heading', title: 'Test' },
    { id: 'unknown-1', type: 'custom-widget', foo: 'bar' },
  ];
  const result = prepareForSave(null, blocks);
  // The unknown block should be sanitized (type stripped or block filtered)
  // but the heading should survive.
  assert.ok(result.blocks.some((b) => b.type === 'heading'), 'heading survives sanitization');
});

test('null incoming blocks treated as empty', () => {
  const result = prepareForSave(null, null);
  assert.equal(result.blocks.length, 0);
  assert.equal(result.html, '');
});

test('undefined incoming blocks treated as empty', () => {
  const result = prepareForSave(null, undefined);
  assert.equal(result.blocks.length, 0);
  assert.equal(result.html, '');
});
