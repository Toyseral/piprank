import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ORIGIN = requireSiteUrlForProduction();
const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const pathFor = (d) => {
  const locale = String(d.settings?.locale || d.settings?.languageCode || '').trim();
  if (!d.country_slug || !locale || !d.slug) return null;
  return `/${d.country_slug}/${encodeURIComponent(locale)}/${d.slug}`;
};

async function main() {
  if (process.env.VERCEL_ENV !== 'production') return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials are required for localized canonical prerendering.');
  if (!existsSync(DIST)) throw new Error('dist/ does not exist. Run vite build first.');
  const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('content_documents').select('*').in('content_type', ['localized-best-for']).eq('published', true).eq('indexable', true);
  if (error) throw error;
  for (const doc of data ?? []) {
    const path = pathFor(doc);
    if (!path) continue;
    const file = join(DIST, path.slice(1), 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    const title = doc.seo_title || doc.title || 'Forex Brokers';
    const description = doc.seo_description || doc.excerpt || '';
    const content = `<main><nav><a href="/">Home</a> › <a href="/${esc(doc.country_slug)}">${esc(doc.country_slug)}</a> › <span>${esc(doc.title)}</span></nav><h1>${esc(doc.title)}</h1>${doc.excerpt ? `<p>${esc(doc.excerpt)}</p>` : ''}${Array.isArray(doc.blocks) ? doc.blocks.map((b) => b?.html || '').join('') : (doc.html || '')}</main>`;
    const html = shell.replace('<title>PipRank</title>', `<title>${esc(title)}</title>`).replace('<meta name="description" content="">', `<meta name="description" content="${esc(description)}">`).replace('</head>', `<link rel="canonical" href="${ORIGIN}${path}"></head>`).replace('<div id="root"></div>', `<div id="root">${content}</div>`);
    writeFileSync(file, html, 'utf8');
  }
  console.log(`[prerender-localized-canonical] Wrote ${(data ?? []).length} localized canonical pages.`);
}
main().catch((err) => { console.error('[prerender-localized-canonical] ERROR:', err); process.exit(1); });
