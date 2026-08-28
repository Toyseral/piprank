// Generate a sitemap only for production. Every URL listed must be a public,
// indexable route that the prerender step also generated.

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';
import {
  countrySeoTopics,
  rankCountryTopicBrokers,
} from './country-seo-topics.mjs';
import { vietnameseCommercialTopics } from './vietnamese-localization.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const MAX_BROKERS_FOR_PAIRS = 12;

function escXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}

function cleanDate(value) {
  if (!value) return undefined;

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? undefined
    : d.toISOString().slice(0, 10);
}

async function main() {
  const isProduction = process.env.VERCEL_ENV === 'production';

  if (!isProduction) {
    console.log(
      '[generate-sitemap] Non-production build — skipping sitemap generation.'
    );
    return;
  }

  const siteUrl = requireSiteUrlForProduction();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the production sitemap.'
    );
  }

  const supabase = createClient(url, key);

  const staticPaths = [
    '/',
    '/brokers',
    '/countries',
    '/compare',
    '/guides',
    '/methodology',
    '/quiz',
    '/tools',
    '/promotions',
    '/about',
    '/authors',
  ];

  const urls = staticPaths.map((loc) => ({
    loc,
    lastmod: undefined,
  }));

  async function fetchRows(table, selectWithDate, selectBasic) {
    const first = await supabase
      .from(table)
      .select(selectWithDate);

    if (!first.error) {
      return first.data ?? [];
    }

    console.warn(
      `[generate-sitemap] "${table}" query with updated_at failed. Falling back.`,
      first.error
    );

    const fallback = await supabase
      .from(table)
      .select(selectBasic);

    if (fallback.error) {
      throw new Error(
        `[generate-sitemap] Failed to query "${table}": ${fallback.error.message || JSON.stringify(fallback.error)}`
      );
    }

    return fallback.data ?? [];
  }

  const [
    brokers,
    countries,
    guides,
    intents,
    countryBestFors,
    countryGuides,
    localizedSeoPages,
  ] = await Promise.all([
    fetchRows(
      'brokers',
      'slug, rating, updated_at, spread_eurusd, assets, platforms, demo_account, min_deposit, best_for, scalping, islamic_account',
      'slug, rating, spread_eurusd, assets, platforms, demo_account, min_deposit, best_for, scalping, islamic_account'
    ),

    fetchRows(
      'countries',
      'id, slug, recommended, status, updated_at',
      'id, slug, recommended, status'
    ),

    fetchRows(
      'guides',
      'slug, updated_at',
      'slug'
    ),

    fetchRows(
      'intents',
      'slug, updated_at',
      'slug'
    ),

    fetchRows(
      'country_best_for',
      'slug, country_id, indexable, updated_at',
      'slug, country_id, indexable'
    ),

    fetchRows(
      'content_documents',
      'content_type, country_slug, slug, published, indexable, updated_at',
      'content_type, country_slug, slug, published, indexable'
    ).catch((err) => {
      console.warn(
        '[generate-sitemap] Could not load content_documents:',
        err
      );
      return [];
    }),

    fetchRows(
      'localized_seo_pages',
      'country_id, language_id, slug, published, indexable, updated_at',
      'country_id, language_id, slug, published, indexable'
    ).catch((err) => {
      console.warn(
        '[generate-sitemap] Could not load localized_seo_pages:',
        err
      );
      return [];
    }),
  ]);

  // Broker pages
  for (const broker of brokers ?? []) {
    if (!broker.slug) continue;

    urls.push({
      loc: `/brokers/${broker.slug}`,
      lastmod: cleanDate(broker.updated_at),
    });
  }

  // Only published countries are public (draft/closed must not appear in sitemap).
  const publishedCountries = (countries ?? []).filter(
    (c) => c.slug && (c.status == null || c.status === 'published')
  );

  // Country pages
  for (const country of publishedCountries) {
    urls.push({
      loc: `/${country.slug}`,
      lastmod: cleanDate(country.updated_at),
    });
  }

  // Guide pages
  for (const guide of guides ?? []) {
    if (!guide.slug) continue;

    urls.push({
      loc: `/guides/${guide.slug}`,
      lastmod: cleanDate(guide.updated_at),
    });
  }

  // Global intent pages
  for (const intent of intents ?? []) {
    if (!intent.slug) continue;

    urls.push({
      loc: `/best/${intent.slug}`,
      lastmod: cleanDate(intent.updated_at),
    });
  }

  // Country-first commercial SEO pages (published countries only)
  for (const country of publishedCountries) {
    for (const topic of countrySeoTopics) {
      if (topic.indexable === false) continue;

      const eligible = rankCountryTopicBrokers(
        brokers ?? [],
        country,
        topic
      );

      if (eligible.length >= (topic.minBrokers ?? 1)) {
        urls.push({
          loc: `/${country.slug}/${topic.slug}`,
          lastmod: cleanDate(country.updated_at),
        });
      }
    }
  }

  // Country slug lookup — published only
  const countrySlugById = new Map(
    publishedCountries.map((country) => [
      Number(country.id),
      country.slug,
    ])
  );

  // Country languages
  const {
    data: languageRows,
    error: languageError,
  } = await supabase
    .from('country_languages')
    .select('id, country_id, url_prefix, locale, active');

  if (languageError) {
    throw new Error(
      `[generate-sitemap] Failed to query country_languages: ${
        languageError.message || JSON.stringify(languageError)
      }`
    );
  }

  const languageById = new Map(
    (languageRows ?? []).map((language) => [
      Number(language.id),
      language,
    ])
  );

  // Admin-managed localized SEO pages
  const localizedLocs = new Set();

  for (const page of localizedSeoPages ?? []) {
    if (!page.slug) continue;
    if (!page.published) continue;
    if (!page.indexable) continue;

    const countrySlug = countrySlugById.get(
      Number(page.country_id)
    );

    const language = languageById.get(
      Number(page.language_id)
    );

    if (
      !countrySlug ||
      !language?.active ||
      !language.url_prefix
    ) {
      continue;
    }

    const loc = `/${countrySlug}/${language.url_prefix}/${page.slug}`;

    localizedLocs.add(loc);

    urls.push({
      loc,
      lastmod: cleanDate(page.updated_at),
    });
  }

  // Vietnamese localized pages
  const vietnam = publishedCountries.find(
    (country) => country.slug === 'vietnam'
  );

  if (vietnam) {
    const recommended = new Set(
      (vietnam.recommended ?? []).map(
        (item) => item?.slug
      )
    );

    for (const localized of vietnameseCommercialTopics) {
      const loc = `/vietnam/vi/${localized.slug}`;

      if (localizedLocs.has(loc)) {
        continue;
      }

      let eligible = (brokers ?? []).filter(
        (broker) => recommended.has(broker.slug)
      );

      if (localized.englishTopicSlug) {
        const topic = countrySeoTopics.find(
          (item) =>
            item.slug === localized.englishTopicSlug
        );

        if (!topic) continue;

        eligible = rankCountryTopicBrokers(
          brokers ?? [],
          vietnam,
          topic
        );
      }

      if (eligible.length >= 1) {
        urls.push({
          loc,
          lastmod: cleanDate(vietnam.updated_at),
        });
      }
    }
  }

  // Country guide pages — only when country is published and document is published
  const publishedCountrySlugs = new Set(
    publishedCountries.map((c) => c.slug)
  );

  for (const document of countryGuides ?? []) {
    if (document.content_type !== 'country-guide') {
      continue;
    }

    if (!document.country_slug || !document.slug) {
      continue;
    }

    if (!publishedCountrySlugs.has(document.country_slug)) {
      continue;
    }

    if (
      document.published === false ||
      document.indexable === false
    ) {
      continue;
    }

    urls.push({
      loc: `/${document.country_slug}/guides/${document.slug}`,
      lastmod: cleanDate(document.updated_at),
    });
  }

  // Country Best For pages not superseded by the new matrix
  const countryById = new Map(
    publishedCountries.map((country) => [
      Number(country.id),
      country.slug,
    ])
  );

  const SUPERSEDED_INTENTS = new Set([
    'beginners',
    'low-spread',
    'mt5',
    'gold',
    'scalping',
    'ecn',
    'copy-trading',
    'swing-trading',
    'high-leverage',
    'islamic',
  ]);

  for (const page of countryBestFors ?? []) {
    if (SUPERSEDED_INTENTS.has(page.slug)) {
      continue;
    }

    const countrySlug = countryById.get(
      Number(page.country_id)
    );

    if (
      page.slug &&
      countrySlug &&
      page.indexable
    ) {
      urls.push({
        loc: `/countries/${countrySlug}/best/${page.slug}`,
        lastmod: cleanDate(page.updated_at),
      });
    }
  }

  // Broker comparison pages
  const topBrokers = [...(brokers ?? [])]
    .filter((broker) => broker.slug)
    .sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0)
    )
    .slice(0, MAX_BROKERS_FOR_PAIRS);

  for (let i = 0; i < topBrokers.length; i++) {
    for (
      let j = i + 1;
      j < topBrokers.length;
      j++
    ) {
      const [a, b] = [
        topBrokers[i],
        topBrokers[j],
      ].sort((x, y) =>
        x.slug.localeCompare(y.slug)
      );

      const dates = [
        a.updated_at,
        b.updated_at,
      ]
        .map((value) => cleanDate(value))
        .filter(Boolean)
        .sort()
        .reverse();

      urls.push({
        loc: `/compare/${a.slug}-vs-${b.slug}`,
        lastmod: dates[0],
      });
    }
  }

  // Remove duplicate URLs
  const byLoc = new Map();

  for (const urlEntry of urls) {
    const previous = byLoc.get(urlEntry.loc);

    if (!previous) {
      byLoc.set(urlEntry.loc, urlEntry);
      continue;
    }

    if (
      (urlEntry.lastmod || '') >
      (previous.lastmod || '')
    ) {
      byLoc.set(urlEntry.loc, urlEntry);
    }
  }

  const unique = [...byLoc.values()];

  const body = unique
    .map((entry) => {
      const lastmod = entry.lastmod
        ? `\n    <lastmod>${entry.lastmod}</lastmod>`
        : '';

      return `  <url>\n    <loc>${escXml(siteUrl + entry.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  writeFileSync(
    join(DIST, 'sitemap.xml'),
    xml,
    'utf-8'
  );

  console.log(
    `[generate-sitemap] Wrote ${unique.length} production URLs.`
  );
}

main().catch((err) => {
  console.error('[generate-sitemap] ERROR:');

  if (err instanceof Error) {
    console.error(err.message);
    console.error(err.stack);
  } else {
    try {
      console.error(JSON.stringify(err, null, 2));
    } catch {
      console.error(String(err));
    }
  }

  process.exit(1);
});
