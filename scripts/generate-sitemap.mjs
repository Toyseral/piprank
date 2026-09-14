// Generate a sitemap only for production. Every URL listed must be a public,
// indexable route that the prerender step also generated.
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';
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

  const [brokersResult, countriesResult, documentsResult, intentsResult, languagesResult] = await Promise.all([
    supabase.from('brokers').select('slug, rating, updated_at'),
    supabase.from('countries').select('id, slug, recommended, updated_at'),
    supabase.from('content_documents').select('content_type, country_slug, topic_slug, slug, published, indexable, updated_at, content_key, settings').eq('published', true),
    supabase.from('intents').select('slug, updated_at'),
    supabase.from('country_languages').select('id, country_id, code, url_prefix, locale, active'),
  ]);
  for (const result of [brokersResult, countriesResult, documentsResult, intentsResult, languagesResult]) {
    if (result.error) throw new Error(`[generate-sitemap] Supabase query failed: ${result.error.message}`);
  }

  const brokers = brokersResult.data ?? [];
  const countries = countriesResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const intents = intentsResult.data ?? [];
  const languages = languagesResult.data ?? [];

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
  const languageByCountryAndLocale = new Map();
  for (const language of languages) {
    if (!language.active || !language.url_prefix) continue;
    const countrySlug = countrySlugById.get(Number(language.country_id));
    if (!countrySlug) continue;
    for (const locale of [language.url_prefix, language.code, language.locale].filter(Boolean)) {
      languageByCountryAndLocale.set(`${countrySlug}:${String(locale).toLowerCase()}`, language.url_prefix);
    }
  }

  // Localized pages are owned exclusively by canonical content_documents.
  const localizedDocs = documents.filter((document) =>
    (document.content_type === 'localized-guide' || document.content_type === 'localized-best-for') &&
    Boolean(document.country_slug) &&
    Boolean(document.slug) &&
    document.indexable !== false &&
    Boolean(documentLocale(document)),
  );
  for (const document of localizedDocs) {
    const locale = documentLocale(document);
    const prefix = languageByCountryAndLocale.get(`${document.country_slug}:${locale.toLowerCase()}`) || locale;
    const path = document.content_type === 'localized-guide'
      ? `/${document.country_slug}/${prefix}/guides/${document.slug}`
      : `/${document.country_slug}/${prefix}/${document.slug}`;
    urls.push({ loc: path, lastmod: cleanDate(document.updated_at) });
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