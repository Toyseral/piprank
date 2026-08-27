// Production build validation. This catches accidental SEO regressions before
// a deploy: missing metadata, duplicate canonicals, empty HTML, bad absolute
// URLs, or sitemap entries that don't have corresponding generated pages.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';

const __dirname = join(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

if (process.env.VERCEL_ENV !== 'production') {
  console.log('[validate-seo] Non-production build — validation skipped.');
  process.exit(0);
}

const siteUrl = requireSiteUrlForProduction();
const errors = [];
const warnings = [];

function htmlFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

const files = htmlFiles(DIST);
if (!files.length) errors.push('No generated HTML files found in dist/.');

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const label = '/' + relative(DIST, file).replace(/\\/g, '/').replace(/\/index\.html$/, '').replace(/^$/, '');
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  const description = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] || '';
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/gi)].map((m) => m[1]);
  const h1s = [...html.matchAll(/<h1\b/gi)].length;
  const root = html.match(/<div id="root">([\s\S]*?)<\/div>/i)?.[1] || '';
  const jsonLdCount = [...html.matchAll(/<script type="application\/ld\+json">/gi)].length;

  if (!title) errors.push(`${label}: missing <title>`);
  if (!description) errors.push(`${label}: missing meta description`);
  if (canonicals.length !== 1) errors.push(`${label}: expected exactly one canonical, found ${canonicals.length}`);
  else if (!canonicals[0].startsWith(siteUrl)) errors.push(`${label}: canonical is not on configured site URL: ${canonicals[0]}`);
  if (h1s !== 1) errors.push(`${label}: expected exactly one H1, found ${h1s}`);
  if (root.replace(/\s+/g, '').length < 120) errors.push(`${label}: prerendered body is suspiciously thin`);
  if (jsonLdCount < 2) warnings.push(`${label}: fewer than two JSON-LD blocks`);
  if (html.includes('mainpiprank.vercel.app') || html.includes('piprank-25sd.arcada.app')) errors.push(`${label}: contains hard-coded temporary domain`);
  if (/<meta name="robots" content="noindex/i.test(html)) errors.push(`${label}: production page contains noindex`);
}

const sitemapFile = join(DIST, 'sitemap.xml');
if (!existsSync(sitemapFile)) {
  errors.push('sitemap.xml is missing.');
} else {
  const xml = readFileSync(sitemapFile, 'utf8');
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) errors.push('sitemap.xml contains no URLs.');
  for (const loc of locs) {
    if (!loc.startsWith(siteUrl)) errors.push(`sitemap URL is outside configured site URL: ${loc}`);
    const path = new URL(loc).pathname.replace(/^\//, '');
    const file = join(DIST, path, 'index.html');
    if (path === '') continue;
    if (!existsSync(file)) errors.push(`sitemap URL has no generated HTML: ${loc}`);
  }
}

const robotsFile = join(DIST, 'robots.txt');
if (!existsSync(robotsFile)) errors.push('robots.txt is missing.');
else {
  const robots = readFileSync(robotsFile, 'utf8');
  if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) errors.push('robots.txt does not reference the configured sitemap URL.');
}

if (warnings.length) console.warn(`[validate-seo] ${warnings.length} warning(s):\n- ${warnings.join('\n- ')}`);
if (errors.length) {
  console.error(`[validate-seo] FAILED with ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`[validate-seo] PASS — validated ${files.length} generated HTML pages and sitemap/robots integrity.`);
