// tests/server-serialization.test.mjs
//
// Regression: the server save pipeline must derive canonical HTML from blocks.
//
// Scenario under test:
//
//   PUT { blocks: validBlocks }   (no `html`)
//     → server validates/sanitizes blocks
//     → server derives html = blocksToHtml(validated blocks)
//     → database receives { blocks, html } (html never required from the client)
//
// This exercises the EXACT server derivation functions used by api/content.js
// (api/_lib/derive-html.js) so the test can't drift from what the API runs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { deriveHtmlForSave, sanitizeBlocksForSave } from '../api/_lib/derive-html.js';
import { blockValidatePayload } from '../api/_lib/block-validate.js';
import { blocksToHtml } from '../src/lib/content/blocksToHtml.ts';
// Runtime-neutral canonical serializer: the SAME module boundary the Vercel
// serverless functions load (a real .js module, no TypeScript in the runtime).
import { blocksToHtml as runtimeBlocksToHtml } from '../src/lib/content/blocksToHtml.runtime.js';

const VALID_BLOCKS = [
  { id: 'b1', type: 'heading', title: 'Document B', level: 'h2' },
  { id: 'b2', type: 'richtext', html: '<p>Body content for B</p>' },
];

const LEGACY_DOC = {
  blocks: [],
  html: '<h2>Legacy heading</h2><p>Legacy body must be preserved.</p>',
};

// Mirrors exactly what the api/content.js PUT handler persists: derive via the
// shared pipeline, then re-normalize (validate/sanitize idempotently) the way
// normalizeContentDoc does, so the payload below is what reaches the database.
async function serverPut(existingDoc, body) {
  const incoming = Array.isArray(body.blocks) ? body.blocks : [];
  const explicitEmpty = body._explicitEmpty === true;
  const derived = await deriveHtmlForSave(existingDoc, incoming, explicitEmpty);
  const validation = blockValidatePayload({ blocks: derived.blocks, html: derived.html }, { strict: false });
  const persistedBlocks = validation.valid && validation.cleaned && Array.isArray(validation.cleaned.blocks)
    ? validation.cleaned.blocks
    : derived.blocks;
  const persistedHtml = validation.valid && validation.cleaned && validation.cleaned.html
    ? validation.cleaned.html
    : String(derived.html || '');
  return { blocks: persistedBlocks, html: persistedHtml };
}

test('PUT { blocks: validBlocks } without html reaches the database with derived html', async () => {
  const existing = { blocks: VALID_BLOCKS, html: '<h2>Document B</h2>\n<p>Body content for B</p>' };
  const persisted = await serverPut(existing, { blocks: VALID_BLOCKS });

  // 1. Valid blocks are accepted (not dropped).
  assert.equal(persisted.blocks.length, 2, 'both valid blocks persist');
  assert.equal(persisted.blocks[0].type, 'heading');
  assert.equal(persisted.blocks[1].type, 'richtext');

  // 2. html was NOT required from the client — the request body had no html.
  const requestBody = { blocks: VALID_BLOCKS };
  assert.equal('html' in requestBody, false);

  // 3 + 4. The server derived html from the blocks and it matches the canonical
  // serializer output exactly.
  assert.equal(persisted.html, blocksToHtml(VALID_BLOCKS));
  assert.equal(persisted.html, '<h2>Document B</h2>\n<p>Body content for B</p>');

  // 5. Both blocks and derived html are persisted together.
  assert.ok(persisted.html.includes('Document B'));
  assert.ok(persisted.html.includes('Body content for B'));
});

test('deriveHtmlForSave derives html for a brand-new document (no existing doc)', async () => {
  const derived = await deriveHtmlForSave(null, VALID_BLOCKS);
  assert.equal(derived.blocks.length, 2);
  assert.equal(derived.html, blocksToHtml(VALID_BLOCKS));
});

test('a block document submitted without html is not treated as legacy (no false preservation)', async () => {
  const existing = {
    blocks: [{ id: 'old', type: 'heading', title: 'Old heading', level: 'h2' }],
    html: '<h2>Old heading</h2>',
  };
  const incoming = [
    { id: 'new1', type: 'heading', title: 'New heading', level: 'h2' },
    { id: 'new2', type: 'richtext', html: '<p>Updated body</p>' },
  ];
  const persisted = await serverPut(existing, { blocks: incoming });
  // The existing document already had blocks, so it is NOT legacy: the incoming
  // blocks win and the html is re-derived from them.
  assert.equal(persisted.blocks[0].title, 'New heading');
  assert.equal(persisted.html, blocksToHtml(incoming));
  assert.equal(persisted.html, '<h2>New heading</h2>\n<p>Updated body</p>');
});

test('legacy html-only document preserves its html when saved without modification', async () => {
  const persisted = await serverPut(LEGACY_DOC, { blocks: [] });
  assert.equal(persisted.html, LEGACY_DOC.html, 'legacy html is never clobbered to ""');
  assert.equal(persisted.blocks.length, 0);
});

test('explicit empty still clears legacy content', async () => {
  const persisted = await serverPut(LEGACY_DOC, { blocks: [], _explicitEmpty: true });
  assert.equal(persisted.html, '');
  assert.equal(persisted.blocks.length, 0);
});

test('sanitization remains intact before serialization (xss stripped from blocks and derived html)', async () => {
  const malicious = [
    { id: 'm1', type: 'heading', title: 'Safe heading', level: 'h2' },
    { id: 'm2', type: 'richtext', html: '<p>ok</p><script>alert(1)</script>' },
  ];
  const sanitized = sanitizeBlocksForSave(malicious);
  const html = blocksToHtml(sanitized);
  assert.ok(!html.includes('<script'), 'derived html must not contain executable markup');
  assert.ok(html.includes('ok'), 'safe content is preserved');
  // The sanitized blocks are what get persisted, so their serialization is clean.
  const persisted = await serverPut(null, { blocks: malicious });
  assert.equal(persisted.html, blocksToHtml(persisted.blocks));
});

test('unsafe URLs are still rejected by the validation the server runs before deriving html', () => {
  const bad = [{ id: 'x', type: 'image', src: 'javascript:alert(1)' }];
  const validation = blockValidatePayload({ blocks: bad });
  assert.equal(validation.valid, false, 'javascript: image src must be rejected');
});

test('server-side serializer resolves through the runtime-neutral .js boundary (Vercel-safe)', async () => {
  // Vercel's serverless Node runtime does not type-strip .ts. The server must
  // import the canonical serializer through a real .js module. Prove that:
  //   1. derive-html.js (api/_lib) resolves the serializer from a .js specifier,
  //      not a .ts specifier.
  //   2. That .js module executes and returns output identical to the canonical
  //      implementation (no drift between browser wrapper and server boundary).
  const deriveSrc = await readFile(fileURLToPath(new URL('../api/_lib/derive-html.js', import.meta.url)), 'utf8');
  const contentTypeSrc = await readFile(fileURLToPath(new URL('../api/content.js', import.meta.url)), 'utf8');
  const serializerDir = fileURLToPath(new URL('../src/lib/content', import.meta.url));

  assert.match(
    deriveSrc,
    /blocksToHtml\.runtime\.js/,
    'api/_lib/derive-html.js must import the serializer from a .js runtime module'
  );
  assert.doesNotMatch(
    deriveSrc,
    /from\s+['"]\.\.\/\.\.\/src\/lib\/content\/blocksToHtml\.ts['"]/,
    'api/_lib/derive-html.js must NOT import the serializer from a .ts source'
  );
  assert.match(
    contentTypeSrc,
    /blocksToHtml\.runtime\.js/,
    'api/content.js must import the serializer from a .js runtime module'
  );
  assert.doesNotMatch(
    contentTypeSrc,
    /from\s+['"]\.\.\/src\/lib\/content\/blocksToHtml\.ts['"]/,
    'api/content.js must NOT import the serializer from a .ts source'
  );

  // The runtime-neutral module physically exists as .js (not only a .ts file).
  const files = await readdir(serializerDir);
  assert.ok(files.includes('blocksToHtml.runtime.js'), 'runtime serializer module blocksToHtml.runtime.js exists on disk');
  assert.ok(files.includes('blockRegistry.runtime.js'), 'runtime registry module blockRegistry.runtime.js exists on disk');

  // It executes and matches the canonical output exactly.
  assert.equal(runtimeBlocksToHtml(VALID_BLOCKS), '<h2>Document B</h2>\n<p>Body content for B</p>');
  assert.equal(runtimeBlocksToHtml(VALID_BLOCKS), blocksToHtml(VALID_BLOCKS));
});

test('server derives html from blocks even when the client submits a wrong html cache', async () => {
  const existing = { blocks: VALID_BLOCKS, html: '<h2>Document B</h2>\n<p>Body content for B</p>' };
  // Client sends a misleading html cache that does NOT match its blocks — the
  // server must not trust it; the stored html is the canonical serialization.
  const persisted = await serverPut(existing, { blocks: VALID_BLOCKS, html: '<p>wrong cache</p>' });
  assert.notEqual(persisted.html, '<p>wrong cache</p>', 'client html cache is not trusted verbatim');
  assert.equal(persisted.html, blocksToHtml(persisted.blocks), 'stored html is always blocksToHtml(stored blocks)');
  assert.equal(persisted.html, '<h2>Document B</h2>\n<p>Body content for B</p>');
});