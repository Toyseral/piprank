import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(dir, 'prerender.mjs');
const runtimePath = join(dir, '.prerender-unified-runtime.mjs');
const source = readFileSync(sourcePath, 'utf8');

const startMarker = '  const blocksToHtmlServer = (blocks) => (blocks || []).map((b) => {';
const endMarker = '\n\n  log(`Fetched ${brokers.length} brokers';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error('[prerender-unified] Could not locate the existing blocksToHtmlServer renderer in scripts/prerender.mjs. Refusing to run with an unknown source shape.');
}

const replacement = '  const blocksToHtmlServer = (blocks) => unifiedBlocksToHtmlServer(blocks, brokers);';
const transformed = `import { blocksToHtmlServer as unifiedBlocksToHtmlServer } from './unified-block-renderer.mjs';\n${source.slice(0, start)}${replacement}${source.slice(end)}`;

writeFileSync(runtimePath, transformed, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?unified=${Date.now()}`);
} finally {
  try { unlinkSync(runtimePath); } catch {}
}
