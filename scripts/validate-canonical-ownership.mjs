import { createClient } from '@supabase/supabase-js';

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
  for (const doc of rows) {
    if (doc.content_type === 'country-topic' || String(doc.content_key || '').startsWith('country-topic:')) errors.push(`Retired country-topic document still exists: ${doc.content_key || doc.id}`);
    if (doc.content_type === 'country-guide') {
      const expected = doc.country_slug && doc.slug ? `country-guide:${doc.country_slug}:${doc.slug}` : null;
      if (!expected) errors.push(`Country guide is missing country_slug or slug: ${doc.id}`);
      else if (doc.content_key !== expected) errors.push(`Country guide has non-canonical content_key: ${doc.content_key} (expected ${expected})`);
    }
    if (doc.content_type === 'country-best-for') {
      const expected = doc.country_slug && doc.slug ? `country-best-for:${doc.country_slug}:${doc.slug}` : null;
      if (!expected) errors.push(`Country Best-For is missing country_slug or slug: ${doc.id}`);
      else if (doc.content_key !== expected) errors.push(`Country Best-For has non-canonical content_key: ${doc.content_key} (expected ${expected})`);
    }
    if (doc.content_type === 'localized-guide' || doc.content_type === 'localized-best-for') {
      const locale = String(doc.settings?.locale || doc.settings?.languageCode || '').trim().toLowerCase();
      const prefix = doc.content_type === 'localized-guide' ? 'localized-guide' : 'localized-best-for';
      const expected = doc.country_slug && locale && doc.slug ? `${prefix}:${doc.country_slug}:${locale}:${doc.slug}` : null;
      if (!expected) errors.push(`Localized document is missing country_slug, locale or slug: ${doc.id}`);
      else if (doc.content_key !== expected) errors.push(`Localized document has non-canonical content_key: ${doc.content_key} (expected ${expected})`);
    }
  }
  const ownershipTypes = ['country-best-for', 'country-guide', 'localized-best-for', 'localized-guide'];
  const seen = new Map();
  for (const doc of rows.filter((d) => ownershipTypes.includes(d.content_type) && d.published)) {
    const locale = String(doc.settings?.locale || doc.settings?.languageCode || '').trim().toLowerCase();
    const ownership = doc.content_type.startsWith('localized-') ? `${doc.content_type}:${doc.country_slug}:${locale}:${doc.slug}` : `${doc.content_type}:${doc.country_slug}:${doc.slug}`;
    if (seen.has(ownership)) errors.push(`Duplicate canonical ownership: ${ownership}`);
    seen.set(ownership, doc);
  }
  if (errors.length) {
    console.error('[validate-canonical-ownership] FAILED');
    errors.forEach((error) => console.error(` - ${error}`));
    process.exit(1);
  }
  console.log(`[validate-canonical-ownership] OK — checked ${rows.length} content documents.`);
}
main().catch((error) => { console.error('[validate-canonical-ownership] ERROR:', error); process.exit(1); });
