// Move prerendered legacy /best/:intent output to the canonical root-level URL.
// This runs after prerender so the existing prerender implementation can keep
// reading the database's internal intent slugs without creating SEO duplicates.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const MAP = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  mt5: 'mt5-forex-brokers',
  mt4: 'mt4-forex-brokers',
  gold: 'gold-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
};

function replaceAll(text, from, to) {
  return text.split(from).join(to);
}

for (const [legacySlug, canonicalSlug] of Object.entries(MAP)) {
  const source = join(DIST, 'best', legacySlug);
  const destination = join(DIST, canonicalSlug);
  if (!existsSync(source)) continue;
  mkdirSync(destination, { recursive: true });

  const sourceHtml = join(source, 'index.html');
  const destinationHtml = join(destination, 'index.html');
  if (existsSync(sourceHtml)) {
    let html = readFileSync(sourceHtml, 'utf8');
    html = replaceAll(html, `/best/${legacySlug}`, `/${canonicalSlug}`);
    writeFileSync(destinationHtml, html, 'utf8');
  }

  rmSync(source, { recursive: true, force: true });
}

const bestDir = join(DIST, 'best');
if (existsSync(bestDir)) {
  try { rmSync(bestDir, { recursive: true, force: true }); } catch {}
}

console.log('[normalize-global-intent-prerenders] Canonical root-level intent prerenders applied.');
