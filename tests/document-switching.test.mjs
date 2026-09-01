// tests/document-switching.test.mjs
//
// Regression: switching between documents in the editor must never leak the
// previously opened document's blocks into the newly opened document.
//
// Scenario:
//
//   Document A → open → builder contains "Document A"
//   Document B → open → builder contains "Document B"
//   builder does NOT contain "Document A"
//
// And the empty/new-document variant:
//
//   Document A → existing block content
//   Document B → empty/new document → must not inherit A's blocks
//
// These tests exercise loadDocumentForEditor / initEditorBlocks — the exact
// functions every PageBuilder-backed editor (BrokerRichDocEditor,
// ContentDocumentEditor, PageManagerEditor, LocalizationManager) uses to turn a
// selected document into builder blocks. PageBuilder itself is keyed by document
// identity at every call site, so a fresh selection produces a fresh builder
// initialized from these blocks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDocumentForEditor, initEditorBlocks } from '../src/lib/content/loadDocument.ts';

const DOC_A = {
  id: 1,
  content_key: 'country:vn:doc-a',
  blocks: [{ id: 'a1', type: 'heading', title: 'Document A', level: 'h2' }],
  html: '<h2>Document A</h2>',
};

const DOC_B = {
  id: 2,
  content_key: 'country:vn:doc-b',
  blocks: [{ id: 'b1', type: 'heading', title: 'Document B', level: 'h2' }],
  html: '<h2>Document B</h2>',
};

function blockTitles(blocks) {
  return (blocks || []).map((b) => b.title).filter((t) => typeof t === 'string');
}

function blockContent(blocks) {
  return (blocks || []).map((b) => JSON.stringify(b)).join('\n');
}

test('open A → open B: B shows B blocks and never A blocks', () => {
  // Open document A.
  const a = loadDocumentForEditor(DOC_A);
  assert.deepEqual(blockTitles(a.blocks), ['Document A']);

  // Switch to document B.
  const b = loadDocumentForEditor(DOC_B);
  assert.deepEqual(blockTitles(b.blocks), ['Document B'], 'B must contain B blocks');

  // B must not contain A's content.
  assert.ok(!blockContent(b.blocks).includes('Document A'), 'B must never display A blocks');
  assert.ok(!blockContent(b.blocks).includes('a1'), "B must not reuse A's block ids");
});

test('open A → open empty/new document: new document does not inherit A blocks', () => {
  const loadedA = loadDocumentForEditor(DOC_A);
  assert.ok(loadedA.blocks.length > 0);

  // Empty document (never edited before).
  const empty = loadDocumentForEditor({ id: 3, content_key: 'country:vn:doc-c', blocks: [], html: '' });
  assert.equal(empty.blocks.length, 0, 'empty doc must have no blocks');

  // Brand-new document shell (null — the editor create flow).
  const created = initEditorBlocks(null);
  assert.equal(created.length, 0, 'new document must start empty');
});

test('open A → open new document with seed blocks: only the seed blocks appear', () => {
  loadDocumentForEditor(DOC_A);
  const seed = [{ id: 'seed-1', type: 'richtext', html: '<p>Brand-new seeded section</p>' }];
  const created = initEditorBlocks(null, seed);
  assert.equal(created.length, 1);
  assert.equal(created[0].id, 'seed-1');
  assert.ok(!blockContent(created).includes('Document A'), 'seed must not include A content');
});

test('switching A → B → A reloads the right blocks each time (no cross-contamination)', () => {
  const a1 = initEditorBlocks(DOC_A);
  const b = initEditorBlocks(DOC_B);
  const a2 = initEditorBlocks(DOC_A);

  assert.deepEqual(blockTitles(b), ['Document B']);
  assert.deepEqual(blockTitles(a2), ['Document A']);
  assert.ok(!blockContent(b).includes('Document A'));
  assert.ok(!blockContent(a2).includes('Document B'));
  assert.ok(!blockContent(a2).includes('b1'));
});

test('legacy html-only documents are seeded per-document and never share blocks', () => {
  const legacyA = initEditorBlocks({ blocks: [], html: '<h2>Legacy A</h2><p>A body</p>' });
  const legacyB = initEditorBlocks({ blocks: [], html: '<h2>Legacy B</h2><p>B body</p>' });

  assert.ok(blockTitles(legacyA).includes('Legacy A'));
  assert.ok(blockTitles(legacyB).includes('Legacy B'));
  assert.ok(!blockContent(legacyB).includes('Legacy A'), 'legacy B must not inherit legacy A blocks');
  assert.ok(!blockContent(legacyA).includes('Legacy B'));
});

test('existing block documents are not re-seeded as legacy on switch (blocks pass through)', () => {
  const loaded = loadDocumentForEditor({ id: 99, blocks: DOC_B.blocks, html: DOC_B.html });
  assert.equal(loaded.seededFromLegacy, false);
  assert.deepEqual(blockTitles(loaded.blocks), ['Document B']);
});