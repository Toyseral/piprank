import { createClient } from '@supabase/supabase-js';

if (process.env.VERCEL_ENV !== 'production') {
  console.log('[validate-country-hub-canonical] Non-production build — skipped (CI has no production database credentials).');
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const supabase = createClient(url, key);

const { data: countries, error: ce } = await supabase
  .from('countries')
  .select('slug,publishing_state');
if (ce) throw ce;

const { data: docs, error: de } = await supabase
  .from('content_documents')
  .select('content_key,title,published,indexable')
  .eq('content_type', 'country');
if (de) throw de;

const byKey = new Map((docs || []).map((d) => [d.content_key, d]));
const missing = [];
const invalid = [];

for (const country of countries || []) {
  const key = `country:${country.slug}:hub`;
  const document = byKey.get(key);

  if (!document) {
    missing.push(country.slug);
    continue;
  }

  if (!String(document.title || '').trim()) {
    invalid.push({ slug: country.slug, reason: 'missing_title' });
    continue;
  }

  // A draft country may intentionally have an empty editorial document while it is
  // being prepared in the CMS. Published countries, however, must have a published
  // and indexable canonical hub document.
  if (country.publishing_state === 'published' && (!document.published || !document.indexable)) {
    invalid.push({
      slug: country.slug,
      reason: 'published_country_requires_published_indexable_document',
      document_published: Boolean(document.published),
      document_indexable: Boolean(document.indexable),
    });
  }
}

if (missing.length || invalid.length) {
  console.error('[validate-country-hub-canonical] FAILED');
  console.error(JSON.stringify({ missing, invalid }, null, 2));
  process.exit(1);
}

console.log(
  `[validate-country-hub-canonical] OK — ${countries?.length || 0} countries have canonical hub documents; published hubs are published and indexable.`,
);
