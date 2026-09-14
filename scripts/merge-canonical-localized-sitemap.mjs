import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireSiteUrlForProduction } from './seo-config.mjs';

const DIST = join(process.cwd(), 'dist');
const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const cleanDate = (v) => { const d = new Date(v || ''); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); };

async function main() {
  if (process.env.VERCEL_ENV !== 'production') return;
  const file = join(DIST, 'sitemap.xml');
  if (!existsSync(file)) throw new Error('sitemap.xml does not exist.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials are required for localized sitemap generation.');
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('content_documents').select('content_type,country_slug,slug,settings,updated_at,published,indexable').in('content_type', ['localized-guide', 'localized-best-for']).eq('published', true).eq('indexable', true);
  if (error) throw error;
  const siteUrl = requireSiteUrlForProduction();
  const xml = readFileSync(file, 'utf8');
  const existing = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const additions = [];
  for (const doc of data ?? []) {
    const locale = String(doc.settings?.locale || doc.settings?.languageCode || '').trim();
    if (!doc.country_slug || !locale || !doc.slug) continue;
    const path = doc.content_type === 'localized-guide' ? `/${doc.country_slug}/${locale}/guides/${doc.slug}` : `/${doc.country_slug}/${locale}/${doc.slug}`;
    const loc = `${siteUrl}${path}`;
    if (existing.has(loc)) continue;
    const lastmod = cleanDate(doc.updated_at);
    additions.push(`  <url>\n    <loc>${esc(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`);
  }
  if (!additions.length) return;
  const body = xml.replace(/<\/urlset>\s*$/i, `${additions.join('\n')}\n</urlset>`);
  writeFileSync(file, body, 'utf8');
  console.log(`[merge-canonical-localized-sitemap] Added ${additions.length} canonical localized URLs.`);
}
main().catch((err) => { console.error('[merge-canonical-localized-sitemap] ERROR:', err); process.exit(1); });
