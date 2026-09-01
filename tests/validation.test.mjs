// tests/validation.test.mjs
// Phase 1 — server-side block validation (api/_lib/block-validate.js).
// The server must never trust client block JSON.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBlock, validateBlocks, blockValidatePayload } from '../api/_lib/block-validate.js';

test('valid editorial blocks pass validation', () => {
  const blocks = [
    { id: '1', type: 'heading', title: 'Fees', level: 'h2' },
    { id: '2', type: 'richtext', html: '<p>Body</p>' },
    { id: '3', type: 'image', src: '/img/a.png', alt: 'A' },
    { id: '4', type: 'table', rows: [['A', 'B'], ['1', '2']] },
    { id: '5', type: 'callout', html: '<p>Note</p>', tone: 'warning' },
    { id: '6', type: 'divider' },
    { id: '7', type: 'links', links: [{ label: 'X', href: '/x' }] },
  ];
  const res = validateBlocks(blocks);
  assert.equal(res.valid, true);
});

test('unknown block type is rejected', () => {
  const res = validateBlock({ id: '1', type: 'mystery', html: '<p>x</p>' });
  assert.equal(res.valid, false);
  assert.match(res.error, /unknown block type/);
});

test('missing required fields are rejected', () => {
  assert.equal(validateBlock({ id: '1', type: 'heading', title: '' }).valid, false);
  assert.equal(validateBlock({ id: '1', type: 'heading' }).valid, false);
  assert.equal(validateBlock({ id: '1', type: 'richtext' }).valid, false);
});

test('missing block id is rejected', () => {
  assert.equal(validateBlock({ type: 'divider' }).valid, false);
});

test('invalid heading level enum is rejected', () => {
  const res = validateBlock({ id: '1', type: 'heading', title: 'X', level: 'h1' });
  assert.equal(res.valid, false);
  assert.match(res.error, /h2 or h3/);
});

test('invalid callout tone enum is rejected', () => {
  const res = validateBlock({ id: '1', type: 'callout', html: '<p>x</p>', tone: 'red' });
  assert.equal(res.valid, false);
});

test('unsafe URLs are rejected', () => {
  assert.equal(validateBlock({ id: '1', type: 'image', src: 'javascript:alert(1)' }).valid, false);
  assert.equal(validateBlock({ id: '1', type: 'image', src: 'data:text/html;base64,PHNjcmlwdD4=' }).valid, false);
  assert.equal(validateBlock({ id: '1', type: 'links', links: [{ label: 'X', href: 'vbscript:x' }] }).valid, false);
});

test('safe URLs pass', () => {
  assert.equal(validateBlock({ id: '1', type: 'image', src: 'https://cdn.example/x.png' }).valid, true);
  assert.equal(validateBlock({ id: '1', type: 'links', links: [{ label: 'X', href: '/vietnam' }] }).valid, true);
});

test('invalid table limits are rejected', () => {
  assert.equal(validateBlock({ id: '1', type: 'table', rows: [] }).valid, false);
  const tooManyRows = Array.from({ length: 201 }, (_, i) => [`r${i}`]);
  assert.equal(validateBlock({ id: '1', type: 'table', rows: tooManyRows }).valid, false);
  const tooWide = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61']];
  assert.equal(validateBlock({ id: '1', type: 'table', rows: tooWide }).valid, false);
});

test('unsanitized rich text is rejected and a clean copy is returned', () => {
  const res = validateBlock({ id: '1', type: 'richtext', html: '<p>ok</p><script>alert(1)</script>' });
  assert.equal(res.valid, false);
  assert.equal(res.cleaned.html, '<p>ok</p>');
  assert.equal(res.cleaned.html.includes('<script'), false);
});

test('malformed blocks are rejected (non-object, non-array list)', () => {
  assert.equal(validateBlock('nope').valid, false);
  assert.equal(validateBlock(null).valid, false);
  assert.equal(validateBlocks('nope').valid, false);
  assert.equal(validateBlocks([{ id: '1', type: 'heading' }]).valid, false);
});

test('dynamic blocks accept references/config but reject embedded entities', () => {
  const ok = validateBlock({ id: '1', type: 'broker-cards', refs: ['ig', 'exness'] });
  assert.equal(ok.valid, true);
  const bad = validateBlock({
    id: '1',
    type: 'broker-cards',
    seeded: { name: 'IG', rating: 4.9, trust_score: 90, min_deposit: 100 },
  });
  assert.equal(bad.valid, false);
  assert.match(bad.error, /references\/configuration only/);
});

test('blockValidatePayload rejects unsanitized document html in strict mode', () => {
  const res = blockValidatePayload({ blocks: [], html: '<script>alert(1)</script>' });
  assert.equal(res.valid, false);
  assert.equal(res.cleaned.html.includes('<script'), false);
});

test('non-array blocks payload is rejected', () => {
  assert.equal(blockValidatePayload({ blocks: { nope: true } }).valid, false);
});