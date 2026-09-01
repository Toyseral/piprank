// tests/migrate.test.mjs
// Phase 1 — migration helpers (migrate.ts): additive, idempotent, reversible,
// marker-recorded, and it never mutates input documents.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveHtmlForSave,
  migrateDocument,
  shouldMigrateLegacy,
  recordMigrationMarker,
  hasMigrationMarker,
  stageDocuments,
  cleanDocumentForWrite,
} from '../src/lib/content/migrate.ts';
import { blocksToHtml } from '../src/lib/content/blocksToHtml.ts';

test('migrateDocument never mutates its input', () => {
  const doc = {
    content_key: 'country:vn:test',
    html: '<h2>Fees</h2><p>Body</p>',
    blocks: [],
    settings: { existing: 'kept' },
  };
  const frozen = structuredClone(doc);
  migrateDocument(doc);
  assert.deepEqual(doc, frozen);
});

test('migrateDocument is additive: html is never removed after migration', () => {
  const res = migrateDocument({
    content_key: 'broker:ig:main',
    html: '<h2>Overview</h2><p>Details</p>',
    blocks: [],
  });
  assert.equal(res.migrated, true);
  assert.ok(res.document.blocks.length > 0);
  assert.equal(res.document.html, '<h2>Overview</h2><p>Details</p>');
});

test('migration is reversible (html retained allows rollback)', () => {
  const res = migrateDocument({ content_key: 'k', html: '<h2>A</h2><p>B</p>', blocks: [] });
  // Rolling back = restoring the retained html and dropping seeded blocks.
  assert.equal(res.document.html, '<h2>A</h2><p>B</p>');
  const blocks = blocksToHtml(res.document.blocks);
  assert.ok(blocks.includes('A'));
  assert.ok(blocks.includes('B'));
});

test('migration is idempotent and marker-guarded', () => {
  const doc = { content_key: 'k', html: '<h2>A</h2>', blocks: [], settings: {} };
  const first = migrateDocument(doc);
  assert.equal(first.migrated, true);
  assert.equal(hasMigrationMarker(first.document.settings), true);
  assert.equal(first.document.settings.migratedFrom.from, 'legacy-html');

  const second = migrateDocument({ ...doc, ...first.document });
  assert.equal(second.migrated, false, 'should NOT migrate again once blocks exist');
});

test('recordMigrationMarker preserves existing settings additively', () => {
  const out = recordMigrationMarker({ rankingMode: 'auto', existingKey: 'x' }, 'legacy-html');
  assert.equal(out.rankingMode, 'auto');
  assert.equal(out.existingKey, 'x');
  assert.ok(out.migratedFrom);
});

test('stageDocuments reports migrated count and staged writes keyed by content_key', () => {
  const docs = [
    { content_key: 'a', html: '<h2>One</h2>', blocks: [], settings: {} },
    { content_key: 'b', html: '<h2>Two</h2>', blocks: [], settings: {} },
    { content_key: 'c', html: '<h2>Three</h2>', blocks: [{ id: '1', type: 'heading', title: 'done' }], settings: {} },
  ];
  const { toWrite, migratedCount } = stageDocuments(docs);
  assert.equal(migratedCount, 2);
  const keys = toWrite.map((w) => w.content_key).sort();
  assert.deepEqual(keys, ['a', 'b']);
  for (const w of toWrite) {
    assert.ok(Array.isArray(w.blocks) && w.blocks.length > 0);
    assert.equal(typeof w.html, 'string');
    assert.ok(w.settings.migratedFrom);
  }
});

test('cleanDocumentForWrite sanitizes both html and blocks', () => {
  const out = cleanDocumentForWrite({
    html: '<script>alert(1)</script><h2>Keep</h2>',
    blocks: [{ id: '1', type: 'richtext', html: '<p>ok</p><script>x()</script>' }],
  });
  assert.doesNotMatch(out.html, /script/);
  assert.match(out.html, /<h2>Keep<\/h2>/);
  assert.doesNotMatch(out.blocks[0].html, /script/);
});

test('deriveHtmlForSave partners with shouldPreserveLegacyContent for safe saves', () => {
  const legacy = { blocks: [], html: '<h2>Still here</h2><p>Body text</p>' };
  const res = deriveHtmlForSave(legacy, []);
  assert.equal(res.preservedLegacy, true);
  assert.equal(res.html, legacy.html);
  assert.ok(res.blocks.length > 0);
  assert.equal(blocksToHtml(res.blocks).replace(/\n/g, ''), legacy.html);
});