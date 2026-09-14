// Generate a sitemap only for production. Every URL listed must be a public,
// indexable route that the prerender step also generated.
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';
import { vietnameseCommercialTopics } from './vietnamese-localization.mjs';
import { CANONICAL_BEST_FOR_BY_SLUG } from '../src/lib/canonicalHub/registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const MAX_BROKERS_FOR_PAIRS = 12;

function escXml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;');
}
function cleanDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
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

  const [brokersResult, countriesResult, documentsResult, localizedResult, intentsResult] = await Promise.all([
    supabase.from('brokers').select('slug, rating, updated_at'),
    supabase.from('countries').select('id, slug, recommended, updated_at'),
    supabase.from('content_documents').select('content_type, country_slug, topic_slug, slug, published, indexable, updated_at, content_key').eq('published', true),
    supabase.from('localized_seo_pages').select('country_id, language_id, slug, published, indexable, updated_at'),
    supabase.from('intents').select('slug, updated_at'),
  ]);
  for (const result of [brokersResult, countriesResult, documentsResult, localizedResult, intentsResult]) {
    if (result.error) throw new Error(`[generate-sitemap] Supabase query failed: ${result.error.message}`);
  }

  const brokers = brokersResult.data ?? [];
  const countries = countriesResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const localizedSeoPages = localizedResult.data ?? [];
  const intents = intentsResult.data ?? [];

  for (const broker of brokers) if (broker.slug) urls.push({ loc: `/brokers/${broker.slug}`, lastmod: cleanDate(broker.updated_at) });
  for (const country of countries) if (country.slug) urls.push({ loc: `/${country.slug}`, lastmod: cleanDate(country.updated_at) });

  for (const document of documents) {
    if (document.content_type !== 'guide' || document.country_slug !== null || !document.slug || document.indexable === false) continue;
    urls.push({ loc: `/guides/${document.slug}`, lastmod: cleanDate(document.updated_at) });
  }

  for (const [slug, canonicalPath] of Object.entries(CANONICAL_BEST_FOR_BY_SLUG)) {
    const intent = intents.find((row) => row.slug === slug);
    urls.push({ loc: `/${canonicalPath}`, lastmod: cleanDate(intent?.updated_at) });
  }

  // Country Best-For pages are owned exclusively by canonical content_documents.
  // country-topic and the legacy country_best_for table must never create URLs.
  const countryBestForDocs = documents.filter((document) =>
    document.content_type === 'country-best-for' &&
    Boolean(document.country_slug) &&
    Boolean(document.slug) &&
    document.indexable !== false,
  );
  for (const document of countryBestForDocs) {
    urls.push({ loc: `/${document.country_slug}/${document.slug}`, lastmod: cleanDate(document.updated_at) });
  }

  const countrySlugById = new Map(countries.map((country) => [Number(country.id), country.slug]));
  const { data: languageRows, error: languageError } = await supabase.from('country_languages').select('id, country_id, url_prefix, locale, active');
  if (languageError) throw new Error(`[generate-sitemap] Failed to query country_languages: ${languageError.message}`);
  const languageById = new Map((languageRows ?? []).map((language) => [Number(language.id), language]));
  const localizedLocs = new Set();

  for (const page of localizedSeoPages) {
    if (!page.slug || !page.published || !page.indexable) continue;
    const countrySlug = countrySlugById.get(Number(page.country_id));
    const language = languageById.get(Number(page.language_id));
    if (!countrySlug || !language?.active || !language.url_prefix) continue;
    const loc = `/${countrySlug}/${language.url_prefix}/${page.slug}`;
    localizedLocs.add(loc);
    urls.push({ loc, lastmod: cleanDate(page.updated_at) });
  }

  const vietnam = countries.find((country) => country.slug === 'vietnam');
  if (vietnam) {
    const recommended = new Set((vietnam.recommended ?? []).map((item) => item?.slug));
    for (const localized of vietnameseCommercialTopics) {
      const loc = `/vietnam/vi/${localized.slug}`;
      if (localizedLocs.has(loc)) continue;
      if (recommended.size > 0) urls.push({ loc, lastmod: cleanDate(vietnam.updated_at) });
    }
  }

  // Country guides own the /:country/guides/:slug namespace.
  for (const document of documents) {
    if (document.content_type !== 'country-guide' || !document.country_slug || !document.slug || document.indexable === false) continue;
    urls.push({ loc: `/${document.country_slug}/guides/${document.slug}`, lastmod: cleanDate(document.updated_at) });
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
  const body = [...byLoc.values()].map((entry) => `  <url>\n    <loc>${escXml(siteUrl + entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}\n  </url>`).join('\n');
  writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, 'utf-8');
  console.log(`[generate-sitemap] Wrote ${byLoc.size} production URLs.`);
}

main().catch((err) => {
  console.error('[generate-sitemap] ERROR:');
  if (err instanceof Error) { console.error(err.message); console.error(err.stack); }
  else { try { console.error(JSON.stringify(err, null, 2)); } catch { console.error(String(err)); } }
  process.exit(1);
});
