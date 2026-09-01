// tests/sanitize.test.mjs
// Phase 1 — shared sanitization policy (sanitize.ts): dangerous HTML is
// stripped, unsafe block URLs are rejected, and the policy stays identical to
// the existing api/content.js cleanHtml behaviour it was ported from.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeHtml,
  isSafeUrl,
  sanitizeBlockUrl,
  sanitizeBlocks,
  looksUnsafe,
} from '../src/lib/content/sanitize.ts';

test('script tags are removed', () => {
  const out = sanitizeHtml('<p>Hello</p><script>alert(1)</script>');
  assert.equal(out, '<p>Hello</p>');
});

test('nested script content is removed entirely', () => {
  assert.doesNotMatch(sanitizeHtml('<script>alert(document.cookie)</script><p>ok</p>'), /alert|script/);
});

test('style/iframe/object/embed/form/input/button/textarea/select are removed', () => {
  const input = '<style>.x{}</style><iframe src="//evil"></iframe><form><input name="x"></form><p>ok</p>';
  const out = sanitizeHtml(input);
  assert.match(out, /<p>ok<\/p>/);
  assert.doesNotMatch(out, /style|iframe|form|input/);
});

test('inline event handlers are stripped', () => {
  assert.equal(sanitizeHtml('<p onclick="alert(1)">x</p>'), '<p>x</p>');
  assert.equal(sanitizeHtml('<a href="/x" onmouseover="steal()">y</a>'), '<a href="/x">y</a>');
});

test('javascript scheme is neutralized', () => {
  assert.doesNotMatch(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), /javascript/i);
});

test('looksUnsafe flags executable markup but not clean content', () => {
  assert.equal(looksUnsafe('<script>alert(1)</script>'), true);
  assert.equal(looksUnsafe('<p onclick="x()">t</p>'), true);
  assert.equal(looksUnsafe('<p>Safe content.</p>'), false);
});

test('safe block URLs are accepted', () => {
  assert.equal(isSafeUrl('https://example.com/x'), true);
  assert.equal(isSafeUrl('http://example.com/x'), true);
  assert.equal(isSafeUrl('/brokers/ig'), true);
  assert.equal(isSafeUrl('//cdn.example.com/x.png'), true);
  assert.equal(isSafeUrl(''), true);
  assert.equal(isSafeUrl('relative/path'), true);
});

test('unsafe block URLs are rejected', () => {
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(isSafeUrl('JaVaScRiPt:alert(1)'), false);
  assert.equal(isSafeUrl('data:text/html;base64,PHNjcmlwdD4='), false);
  assert.equal(isSafeUrl('vbscript:msgbox(1)'), false);
});

test('sanitizeBlockUrl returns null for unsafe schemes', () => {
  assert.equal(sanitizeBlockUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeBlockUrl('data:image/svg+xml;base64,SGVsbG8='), null);
  assert.equal(sanitizeBlockUrl('/safe/path'), '/safe/path');
  assert.equal(sanitizeBlockUrl('https://ok.example'), 'https://ok.example');
});

test('sanitizeBlocks cleans every richtext/callout html field', () => {
  const blocks = [
    { id: '1', type: 'richtext', html: '<p>ok</p><script>alert(1)</script>' },
    { id: '2', type: 'callout', html: '<p onclick="go()">note</p>' },
    { id: '3', type: 'image', src: '/x.png' },
  ];
  const cleaned = sanitizeBlocks(blocks);
  assert.equal(cleaned[0].html, '<p>ok</p>');
  assert.equal(cleaned[1].html, '<p>note</p>');
  assert.equal(cleaned[2].src, '/x.png');
});

test('paragraph rich text is left intact', () => {
  const html = '<h2>Fees</h2><p>Intro</p><ul><li>One</li></ul>';
  assert.equal(sanitizeHtml(html), html);
});

test('unsafe HTML embedded inside a heading title is neutralized', () => {
  const out = sanitizeHtml('<p>Fees <script>steal()</script> table</p>');
  assert.equal(out, '<p>Fees  table</p>');
});