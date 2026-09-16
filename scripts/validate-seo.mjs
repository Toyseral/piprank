// Production build validation. Catches missing or duplicated metadata, canonical drift,
// thin prerenders, unsafe robots directives, broker ownership drift, and sitemap entries without generated pages.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';

const __dirname = join(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
if (process.env.VERCEL_ENV !== 'production') { console.log('[validate-seo] Non-production build — validation skipped.'); process.exit(0); }
const siteUrl = requireSiteUrlForProduction();
const errors = []; const warnings = [];
function htmlFiles(dir) { if (!existsSync(dir)) return []; const out = []; for (const entry of readdirSync(dir, { withFileTypes: true })) { const full = join(dir, entry.name); if (entry.isDirectory()) out.push(...htmlFiles(full)); else if (entry.name === 'index.html') out.push(full); } return out; }
function labelFor(file) { const rel = relative(DIST, file).replace(/\\/g, '/').replace(/\/index\.html$/, ''); return rel ? `/${rel}` : '/'; }
function decodePath(value) { try { return decodeURIComponent(value); } catch { return value; } }

const files = htmlFiles(DIST); if (!files.length) errors.push('No generated HTML files found in dist/.');
const seenTitles = new Map(); const seenDescriptions = new Map();
for (const file of files) {
  const html = readFileSync(file, 'utf8'); const label = labelFor(file);
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] || '';
  const canonicals = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/gi)].map((m) => m[1]);
  const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)?.[1] || '';
  const ogDescription = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1] || '';
  const h1s = [...html.matchAll(/<h1\b/gi)].length; const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
  const jsonLdCount = [...html.matchAll(/<script type="application\/ld\+json">/gi)].length;
  if (!title) errors.push(`${label}: missing <title>`); if (!description) errors.push(`${label}: missing meta description`);
  if (canonicals.length !== 1) errors.push(`${label}: expected exactly one canonical, found ${canonicals.length}`);
  else { const expectedCanonical = label === '/' ? siteUrl : siteUrl + label; if (canonicals[0] !== expectedCanonical) errors.push(`${label}: canonical mismatch; expected ${expectedCanonical}, found ${canonicals[0]}`); }
  if (!ogTitle || ogTitle !== title) errors.push(`${label}: og:title does not match <title>`); if (!ogDescription || ogDescription !== description) errors.push(`${label}: og:description does not match meta description`);
  if (h1s !== 1) errors.push(`${label}: expected exactly one H1, found ${h1s}`); if (body.replace(/\s+/g, '').length < 250) errors.push(`${label}: prerendered body is suspiciously thin`);
  if (jsonLdCount < 1) warnings.push(`${label}: no JSON-LD block found`); if (html.includes('mainpiprank.vercel.app') || html.includes('piprank-25sd.arcada.app')) errors.push(`${label}: contains hard-coded temporary domain`);
  if (/<meta\s+name="robots"\s+content="noindex/i.test(html)) errors.push(`${label}: production page contains noindex`);
  if (label !== '/' && /<title>PipRank\s*[—-]?\s*Best Forex Brokers 20\d{2}<\/title>/i.test(html)) errors.push(`${label}: retains homepage title after prerender`);

  if (label.startsWith('/brokers/') && label !== '/brokers') {
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    if (!/ Broker Review$/i.test(h1)) errors.push(`${label}: broker H1 must end with "Broker Review"; found "${h1}"`);
    if (/Forex Broker Review/i.test(h1)) errors.push(`${label}: broker H1 still uses legacy "Forex Broker Review" wording`);
    if (!/<h2[^>]*>[^<]*at a glance<\/h2>/i.test(html)) errors.push(`${label}: broker prerender is missing the at-a-glance section`);
    if (/<h2[^>]*>Fees & commissions<\/h2>[\s\S]*?<h2[^>]*>In-depth/i.test(html)) errors.push(`${label}: section order places Fees content before the in-depth editorial section`);
    if (/<h2[^>]*>In-depth[^<]*<\/h2>[\s\S]*?(Fees & commissions|Trading platforms|Trust & regulation|Account types|Deposits & withdrawals)/i.test(html)) {
      const editorial = html.match(/<h2[^>]*>In-depth[^<]*<\/h2>([\s\S]*?)(?=<h2|<\/main>)/i)?.[1] || '';
      if (/Fees & commissions|Trading platforms|Trust & regulation|Account types|Deposits & withdrawals/i.test(editorial)) {
        errors.push(`${label}: section-specific editorial content is nested inside In-depth analysis`);
      }
    }
    if (html.includes('Forex Broker Review: Spreads, Fees & Regulation')) errors.push(`${label}: prerender retains legacy broker H1 text`);
  }

  if (title) { const previous = seenTitles.get(title); if (previous) errors.push(`${label}: duplicate title also used by ${previous}`); else seenTitles.set(title, label); }
  if (description) { const previous = seenDescriptions.get(description); if (previous && label !== '/') warnings.push(`${label}: duplicate description also used by ${previous}`); else seenDescriptions.set(description, label); }
}

const sitemapFile = join(DIST, 'sitemap.xml');
if (!existsSync(sitemapFile)) errors.push('sitemap.xml is missing.');
else {
  const xml = readFileSync(sitemapFile, 'utf8'); const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]); if (!locs.length) errors.push('sitemap.xml contains no URLs.');
  const seenLocs = new Set(); for (const loc of locs) { if (!loc.startsWith(siteUrl)) errors.push(`sitemap URL is outside configured site URL: ${loc}`); if (seenLocs.has(loc)) errors.push(`sitemap contains duplicate URL: ${loc}`); seenLocs.add(loc); try { const path = new URL(loc).pathname; const relativePath = decodePath(path).replace(/^\//, ''); const file = join(DIST, relativePath, 'index.html'); if (relativePath === '') { if (!existsSync(join(DIST, 'index.html'))) errors.push(`sitemap URL has no generated HTML: ${loc}`); } else if (!existsSync(file)) errors.push(`sitemap URL has no generated HTML: ${loc}`); } catch { errors.push(`sitemap contains invalid URL: ${loc}`); } }
}
const robotsFile = join(DIST, 'robots.txt'); if (!existsSync(robotsFile)) errors.push('robots.txt is missing.'); else { const robots = readFileSync(robotsFile, 'utf8'); if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) errors.push('robots.txt does not reference the configured sitemap URL.'); }
if (warnings.length) console.warn(`[validate-seo] ${warnings.length} warning(s):\n- ${warnings.join('\n- ')}`);
if (errors.length) { console.error(`[validate-seo] FAILED with ${errors.length} error(s):\n- ${errors.join('\n- ')}`); process.exit(1); }
console.log(`[validate-seo] PASS — validated ${files.length} generated HTML pages and sitemap/robots integrity.`);
