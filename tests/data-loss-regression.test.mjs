// tests/data-loss-regression.test.mjs
// Phase 1 — CRITICAL regression: the historical data-loss bug where
//
//   stored blocks = [], html = "<h2>Existing content</h2>..."
//   editor opens, saves without modification
//   → blocks = [], html = ""
//
// The has-content invariant (types.ts) + deriveHtmlForSave (migrate.ts) must
// guarantee existing content is never silently destroyed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksToHtml } from '../src/lib/content/blocksToHtml.ts';
import { htmlToBlocks } from '../src/lib/content/htmlToBlocks.ts';
import { deriveHtmlForSave, migrateDocument, shouldMigrateLegacy } from '../src/lib/content/migrate.ts';

const LEGACY_DOC = {
  blocks: [],
  html: '<h2>Existing content</h2><p>This legacy body must never disappear.</p>',
};

test('load legacy → seed blocks → save without modification never loses content', () => {
  // 1. Load: legacy doc with html but empty blocks.
  const seeded = htmlToBlocks(LEGACY_DOC.html).blocks;
  assert.ok(seeded.length > 0, 'htmlToBlocks must seed real blocks from legacy html');

  // 2. Save without modification via the invariant-guarded derivation.
  const result = deriveHtmlForSave(LEGACY_DOC, seeded);

  // 3. Content survives. The html cache is re-derived from blocks (the new
  //    editorial source of truth) — never emptied.
  assert.notEqual(result.html, '');
  assert.equal(result.blocks.length, seeded.length);
  assert.equal(blocksToHtml(result.blocks), result.html);
  assert.equal(result.preservedLegacy, false);
  for (const token of ['Existing content', 'This legacy body must never disappear.']) {
    assert.ok(result.html.includes(token), `expected "${token}" to survive the save`);
  }
});

test('the exact old buggy flow (empty incoming blocks, no explicit clear) still preserves content', () => {
  const result = deriveHtmlForSave(LEGACY_DOC, []);
  assert.equal(result.html, LEGACY_DOC.html, 'html must NOT be clobbered to empty by an empty blocks save');
  assert.equal(result.preservedLegacy, true);
  assert.ok(result.blocks.length > 0, 'blocks are seeded from legacy html');
});

test('blocksToHtml([]) with no guard would destroy content — the invariant prevents it', () => {
  // Without the guard this is the bug:
  const unguarded = blocksToHtml([]);
  assert.equal(unguarded, '');
  // With the guard the stored html is preserved:
  const guarded = deriveHtmlForSave(LEGACY_DOC, []);
  assert.notEqual(guarded.html, '');
});

test('intentional deletion by an administrator is respected', () => {
  const result = deriveHtmlForSave(LEGACY_DOC, [], { explicitEmpty: true });
  assert.equal(result.html, '');
  assert.equal(result.blocks.length, 0);
  assert.equal(result.preservedLegacy, false);
});

test('documents that already have blocks are not treated as legacy (no false preservation)', () => {
  const edited = {
    blocks: [{ id: '1', type: 'heading', title: 'New heading' }],
    html: '<h2>Old</h2>',
  };
  const result = deriveHtmlForSave(edited, [{ id: '1', type: 'heading', title: 'New heading' }]);
  assert.equal(result.html, '<h2>New heading</h2>');
  assert.equal(result.preservedLegacy, false);
});

test('migrateDocument is additive and idempotent with a migration marker', () => {
  const doc = { ...LEGACY_DOC, content_key: 'country:vn:test', settings: {} };
  assert.equal(shouldMigrateLegacy(doc), true);

  const first = migrateDocument(doc);
  assert.equal(first.migrated, true);
  assert.ok(first.document.blocks.length > 0);
  assert.equal(first.document.html, LEGACY_DOC.html, 'additive: html is never removed');
  assert.ok(first.document.settings.migratedFrom, 'migration marker recorded');

  // Re-running on the migrated result is a no-op (idempotent).
  const second = migrateDocument({ ...doc, ...first.document });
  assert.equal(second.migrated, false);
});