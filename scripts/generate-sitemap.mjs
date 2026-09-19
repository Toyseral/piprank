import { canonicalPathForDocument, localeOf } from '../src/lib/canonical-route-registry.mjs';
// Generate a sitemap only for production. Every dynamic URL listed must be owned by a
// published, indexable canonical content document (or a canonical broker/country record).
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const MAX_BROKERS_FOR_PAIRS = 12;
const CANONICAL_CONTENT_TYPES = ['guide', 'global-best-for', 'country-guide', 'country-best-for', 'localized-guide', 'localized-best-for'];

function escXml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;');
}
function cleanDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}
function documentLocale(document) {
  return String(document?.settings?.locale || document?.settings?.languageCode || '').trim();
}

async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log('[generate-sitemap] Non-production build — skipping sitemap generation.');
    return;
  }
  const siteUrl = requireSiteUrlForProduction();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the production sitemap.');
  const supabase = createClient(url, key);
  const staticPaths = ['/', '/brokers', '/countries', '/compare', '/guides', '/methodology', '/quiz', '/tools', '/promotions', '/about', '/authors'];
  const urls = staticPaths.map((loc) => ({ loc }));

  const [brokersResult, countriesResult, documentsResult, countryDocumentsResult] = await Promise.all([
    supabase.from('brokers').select('slug, rating, updated_at'),
    supabase.from('countries').select('id, slug, updated_at, publishing_state'),
    supabase.from('content_documents').select('content_type, country_slug, topic_slug, slug, published, indexable, updated_at, content_key, settings').in('content_type', CANONICAL_CONTENT_TYPES).eq('published', true).eq('indexable', true),
    supabase.from('content_documents').select('country_slug, slug, published, indexable, updated_at').eq('content_type', 'country'),
  ]);
  for (const result of [brokersResult, countriesResult, documentsResult, countryDocumentsResult]) {
    if (result.error) throw new Error(`[generate-sitemap] Supabase query failed: ${result.error.message}`);
  }

  const brokers = brokersResult.data ?? [];
  const countries = countriesResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const countryDocuments = new Map((countryDocumentsResult.data ?? []).filter((doc) => doc.country_slug).map((doc) => [doc.country_slug, doc]));

  for (const broker of brokers) if (broker.slug) urls.push({ loc: `/brokers/${broker.slug}`, lastmod: cleanDate(broker.updated_at) });
  for (const country of countries) {
    if (!country.slug || country.publishing_state !== 'published') continue;
    const document = countryDocuments.get(country.slug);
    if (!document?.published || !document?.indexable) continue;
    urls.push({ loc: `/${country.slug}`, lastmod: cleanDate(document.updated_at || country.updated_at) });
  }
  // Country resource hubs are discovery indexes, not content owners. Include them when the country has any published guide, Best-For, or localized resource.
  for (const country of countries) {
    if (!country.slug || country.publishing_state !== 'published') continue;
    const hasCountryResources = documents.some((doc) =>
      ['country-guide', 'country-best-for', 'localized-guide', 'localized-best-for'].includes(doc.content_type) &&
      doc.country_slug === country.slug,
    );
    if (hasCountryResources) urls.push({ loc: `/${country.slug}/guides` });
  }

  for (const document of documents) {
    const path = canonicalPathForDocument(document);
    if (path) urls.push({ loc: path, lastmod: cleanDate(document.updated_at) });
  }

  const topBrokers = [...brokers].filter((broker) => broker.slug).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, MAX_BROKERS_FOR_PAIRS);
  for (let i = 0; i < topBrokers.length; i++) {
    for (let j = i + 1; j < topBrokers.length; j++) {
      const [a, b] = [topBrokers[i], topBrokers[j]].sort((x, y) => x.slug.localeCompare(y.slug));
      urls.push({ loc: `/compare/${a.slug}-vs-${b.slug}`, lastmod: [a.updated_at, b.updated_at].map(cleanDate).filter(Boolean).sort().reverse()[0] });
    }
  }

  const byLoc = new Map();
  for (const entry of urls) {
    const previous = byLoc.get(entry.loc);
    if (!previous || (entry.lastmod || '') > (previous.lastmod || '')) byLoc.set(entry.loc, entry);
  }
  const body = [...byLoc.values()].map((entry) => `  <url>
    <loc>${escXml(siteUrl + entry.loc)}</loc>${entry.lastmod ? `
    <lastmod>${entry.lastmod}</lastmod>` : ''}
  </url>`).join('
');
  writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`, 'utf-8');
  console.log(`[generate-sitemap] Wrote ${byLoc.size} production URLs.`);
}

main().catch((err) => {
  console.error('[generate-sitemap] ERROR:');
  if (err instanceof Error) { console.error(err.message); console.error(err.stack); }
  else { try { console.error(JSON.stringify(err, null, 2)); } catch { console.error(String(err)); } }
  process.exit(1);
});
