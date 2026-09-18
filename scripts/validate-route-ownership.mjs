import { canonicalKeyForDocument, canonicalPathForDocument, isCanonicalContentType, isRetiredContentType, retiredKeyMatches, localeOf } from '../src/lib/canonical-route-registry.mjs';
import { createClient } from '@supabase/supabase-js';

const CANONICAL_TYPES = new Set([
  'guide',
  'global-best-for',
  'country-guide',
  'country-best-for',
  'localized-guide',
  'localized-best-for',
  'broker',
  'country',
  'compare',
]);

const STATIC_PATHS = new Set([
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
]);

const RETIRED_TYPES = new Set(['country-topic', 'localized-seo']);

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

function fail(errors) {
  if (!errors.length) return;
  console.error('[validate-route-ownership] FAILED');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error('Supabase credentials are required for route ownership validation.');
    }
    console.log('[validate-route-ownership] Non-production build without Supabase credentials — skipped (CI has no production database credentials).');
    return;
  }

  const supabase = createClient(url, key);
  const [{ data: docs, error: docError }, { data: countries, error: countryError }, { data: intents, error: intentError }] = await Promise.all([
    supabase.from('content_documents').select('id,content_key,content_type,country_slug,slug,topic_slug,published,indexable,settings'),
    supabase.from('countries').select('slug,publishing_state'),
    supabase.from('intents').select('slug'),
  ]);
  if (docError) throw new Error(`Route ownership content query failed: ${docError.message}`);
  if (countryError) throw new Error(`Route ownership country query failed: ${countryError.message}`);
  if (intentError) throw new Error(`Route ownership intent query failed: ${intentError.message}`);

  const rows = docs || [];
  const errors = [];
  const ownedPaths = new Map();
  const ownedKeys = new Map();
  const countrySlugs = new Set((countries || []).filter((c) => c.publishing_state === 'published').map((c) => clean(c.slug)).filter(Boolean));
  const intentSlugs = new Set((intents || []).map((i) => clean(i.slug)).filter(Boolean));

  for (const path of STATIC_PATHS) ownedPaths.set(path, 'static route');

  for (const doc of rows) {
    const type = clean(doc.content_type);
    const keyValue = clean(doc.content_key);

    if (isRetiredContentType(type) || retiredKeyMatches(keyValue)) {
      errors.push(`Retired content document still exists: ${doc.content_key || doc.id}`);
      continue;
    }
    if (!isCanonicalContentType(type)) continue;

    const expectedKey = canonicalKeyForDocument(doc);
    const path = canonicalPathForDocument(doc);

    if (!expectedKey) errors.push(`${type} document has insufficient canonical identity: ${doc.id}`);
    else if (keyValue !== expectedKey) errors.push(`${type} has non-canonical content_key: ${doc.content_key} (expected ${expectedKey})`);

    if (!path) {
      errors.push(`${type} cannot resolve a canonical URL: ${doc.id}`);
      continue;
    }

    const previousPath = ownedPaths.get(path);
    if (previousPath) errors.push(`Duplicate route ownership: ${path} (${previousPath} and ${doc.content_key || doc.id})`);
    else ownedPaths.set(path, doc.content_key || String(doc.id));

    if (expectedKey) {
      const previousKey = ownedKeys.get(expectedKey);
      if (previousKey) errors.push(`Duplicate canonical key: ${expectedKey} (${previousKey} and ${doc.id})`);
      else ownedKeys.set(expectedKey, doc.id);
    }

    if (type === 'localized-best-for') {
      const settings = doc.settings && typeof doc.settings === 'object' ? doc.settings : {};
      const intentSlug = clean(settings.canonicalIntentSlug || settings.intent_slug || doc.topic_slug);
      const owner = rows.find((candidate) =>
        clean(candidate.content_type) === 'global-best-for' &&
        clean(candidate.slug) === intentSlug &&
        !candidate.country_slug
      );
      if (!intentSlug) {
        errors.push(`Localized Best-For is missing canonical intent identity: ${doc.id}`);
      } else if (!intentSlugs.has(intentSlug)) {
        errors.push(`Localized Best-For references missing intent: ${doc.id} -> ${intentSlug}`);
      } else if (!owner) {
        errors.push(`Localized Best-For references missing global Best-For owner: ${doc.id} -> ${intentSlug}`);
      }
      const sourceOwnerId = Number(settings.source_best_for_id);
      if (Number.isInteger(sourceOwnerId) && owner && Number(owner.id) !== sourceOwnerId) {
        errors.push(`Localized Best-For source_best_for_id does not match canonical owner: ${doc.id}`);
      }
    }
    if (type === 'country-best-for') {
      const intentSlug = clean(doc.topic_slug || doc.settings?.canonicalIntentSlug || doc.settings?.intent_slug);
      if (!intentSlug) errors.push(`Country Best-For is missing ranking intent: ${doc.id}`);
      else if (!intentSlugs.has(intentSlug)) errors.push(`Country Best-For references missing intent: ${doc.id} -> ${intentSlug}`);
    }

    if (doc.published && doc.indexable !== false) {
      if (type === 'localized-guide' || type === 'localized-best-for') {
        if (!doc.country_slug || !localeOf(doc)) errors.push(`Published localized document is missing country/locale: ${doc.id}`);
      }
      if ((type === 'guide' || type === 'global-best-for') && doc.country_slug) {
        errors.push(`Global ${type} incorrectly has country_slug: ${doc.id}`);
      }
      if ((type === 'country-guide' || type === 'country-best-for') && !countrySlugs.has(clean(doc.country_slug))) {
        errors.push(`Published ${type} points to a non-published country: ${doc.id} (${doc.country_slug})`);
      }
    }
  }

  for (const slug of countrySlugs) {
    const path = `/${encodeURIComponent(slug)}`;
    if (ownedPaths.has(path) && ownedPaths.get(path) !== 'static route') {
      // A canonical country document and a global Best-For document cannot share this path.
      const owners = rows.filter((doc) => canonicalPathForDocument(doc) === path && doc.published);
      if (owners.length > 1) errors.push(`Country/global collision at ${path}: ${owners.map((d) => d.content_key).join(', ')}`);
    }
  }

  for (const intentSlug of intentSlugs) {
    const canonicalIntent = ({
      beginners: 'forex-brokers-for-beginners',
      'low-spread': 'low-spread-forex-brokers',
      mt4: 'mt4-forex-brokers',
      mt5: 'mt5-forex-brokers',
      gold: 'gold-forex-brokers',
      ecn: 'ecn-forex-brokers',
      'copy-trading': 'copy-trading-forex-brokers',
      scalping: 'forex-brokers-for-scalping',
      'swing-trading': 'forex-brokers-for-swing-trading',
      'high-leverage': 'high-leverage-forex-brokers',
      islamic: 'islamic-forex-brokers',
    })[intentSlug] || intentSlug;
    const keyName = `best-for:${canonicalIntent}`;
    const owner = rows.find((doc) => clean(doc.content_type) === 'global-best-for' && clean(doc.content_key) === keyName);
    if (!owner) errors.push(`Intent has no canonical global Best-For owner: ${intentSlug} -> ${keyName}`);
  }

  fail(errors);
  console.log(`[validate-route-ownership] OK — checked ${rows.length} content documents, ${ownedPaths.size} route owners and ${intentSlugs.size} intents.`);
}

main().catch((error) => {
  console.error('[validate-route-ownership] ERROR:', error);
  process.exit(1);
});
