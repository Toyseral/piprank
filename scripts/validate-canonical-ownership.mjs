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

function localeOf(doc) {
  return String(doc?.settings?.locale || doc?.settings?.languageCode || '').trim().toLowerCase();
}

function canonicalKey(doc) {
  const country = String(doc.country_slug || '').trim();
  const slug = String(doc.slug || '').trim();
  const locale = localeOf(doc);
  switch (doc.content_type) {
    case 'guide': return slug && !country ? `guide:${slug}` : null;
    case 'global-best-for': return slug && !country ? `best-for:${slug}` : null;
    case 'country-guide': return country && slug ? `country-guide:${country}:${slug}` : null;
    case 'country-best-for': return country && slug ? `country-best-for:${country}:${slug}` : null;
    case 'localized-guide': return country && locale && slug ? `localized-guide:${country}:${locale}:${slug}` : null;
    case 'localized-best-for': return country && locale && slug ? `localized-best-for:${country}:${locale}:${slug}` : null;
    case 'broker': return slug ? `broker:${slug}:main` : null;
    case 'country': return country || slug ? `country:${country || slug}:hub` : null;
    case 'compare': return slug ? `compare:${slug}` : null;
    default: return null;
  }
}

function canonicalPath(doc) {
  const country = encodeURIComponent(String(doc.country_slug || '').trim());
  const slug = encodeURIComponent(String(doc.slug || '').trim());
  const locale = encodeURIComponent(localeOf(doc));
  switch (doc.content_type) {
    case 'guide': return slug && !doc.country_slug ? `/guides/${slug}` : null;
    case 'global-best-for': return slug && !doc.country_slug ? `/${slug}` : null;
    case 'country-guide': return country && slug ? `/${country}/guides/${slug}` : null;
    case 'country-best-for': return country && slug ? `/${country}/${slug}` : null;
    case 'localized-guide': return country && locale && slug ? `/${country}/${locale}/guides/${slug}` : null;
    case 'localized-best-for': return country && locale && slug ? `/${country}/${locale}/${slug}` : null;
    case 'broker': return slug ? `/brokers/${slug}` : null;
    case 'country': return country ? `/${country}` : slug ? `/${slug}` : null;
    case 'compare': return slug ? `/compare/${slug}` : null;
    default: return null;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('Supabase credentials are required for canonical ownership validation.');
    console.log('[validate-canonical-ownership] Non-production build without Supabase credentials — skipped.');
    return;
  }
  const supabase = createClient(url, key);
  const { data: docs, error } = await supabase.from('content_documents').select('id,content_key,content_type,country_slug,slug,published,indexable,settings');
  if (error) throw new Error(`Canonical ownership query failed: ${error.message}`);
  const rows = docs ?? [];
  const errors = [];
  const seenKeys = new Map();
  const seenPaths = new Map();

  for (const doc of rows) {
    const type = String(doc.content_type || '');
    const keyValue = String(doc.content_key || '');

    if (type === 'country-topic' || keyValue.startsWith('country-topic:')) {
      errors.push(`Retired country-topic document still exists: ${keyValue || doc.id}`);
      continue;
    }
    if (type === 'localized-seo' || keyValue.startsWith('localized-seo:')) {
      errors.push(`Retired localized-seo document still exists: ${keyValue || doc.id}`);
      continue;
    }
    if (!CANONICAL_TYPES.has(type)) continue;

    const expectedKey = canonicalKey(doc);
    if (!expectedKey) errors.push(`${type} document has insufficient canonical identity: ${doc.id}`);
    else if (keyValue !== expectedKey) errors.push(`${type} has non-canonical content_key: ${keyValue} (expected ${expectedKey})`);

    const path = canonicalPath(doc);
    if (!path && expectedKey) errors.push(`${type} document cannot resolve a canonical URL: ${doc.id}`);
    if (path) {
      if (seenPaths.has(path)) errors.push(`Duplicate canonical URL ownership: ${path} (${seenPaths.get(path)} and ${doc.id})`);
      seenPaths.set(path, doc.id);
    }

    if (expectedKey) {
      if (seenKeys.has(expectedKey)) errors.push(`Duplicate canonical ownership key: ${expectedKey} (${seenKeys.get(expectedKey)} and ${doc.id})`);
      seenKeys.set(expectedKey, doc.id);
    }

    if (type.startsWith('localized-') && !localeOf(doc)) errors.push(`Localized document is missing locale: ${doc.id}`);
    if (type.startsWith('localized-') && !doc.country_slug) errors.push(`Localized document is missing country_slug: ${doc.id}`);
    if ((type === 'guide' || type === 'global-best-for') && doc.country_slug) errors.push(`${type} must not have country_slug: ${doc.id}`);
  }

  if (errors.length) {
    console.error('[validate-canonical-ownership] FAILED');
    errors.forEach((error) => console.error(` - ${error}`));
    process.exit(1);
  }
  console.log(`[validate-canonical-ownership] OK — checked ${rows.length} content documents and ${seenPaths.size} canonical URLs.`);
}
main().catch((error) => { console.error('[validate-canonical-ownership] ERROR:', error); process.exit(1); });
