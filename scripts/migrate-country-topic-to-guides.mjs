// One-time migration for the retired country-topic owner.
//
// Safe behavior:
// - If a canonical country-guide already exists, the legacy row is unpublished
//   and noindexed so the canonical document remains the sole owner.
// - Otherwise the existing row is converted in place to country-guide with
//   the canonical content key and /:country/guides/:slug namespace.
// - No country-best-for document is touched.
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const supabase = createClient(url, key);
const { data: legacyRows, error } = await supabase
  .from('content_documents')
  .select('*')
  .eq('content_type', 'country-topic');

if (error) throw error;

let converted = 0;
let retired = 0;

for (const row of legacyRows ?? []) {
  const country = String(row.country_slug || '').trim();
  const slug = String(row.slug || row.topic_slug || '').trim();
  if (!country || !slug) {
    console.warn(`[country-topic-migration] Skipping ${row.id}: missing country_slug or slug.`);
    continue;
  }

  const keyForGuide = `country-guide:${country}:${slug}`;
  const { data: existing, error: existingError } = await supabase
    .from('content_documents')
    .select('id')
    .eq('content_key', keyForGuide)
    .neq('id', row.id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error: retireError } = await supabase
      .from('content_documents')
      .update({ published: false, indexable: false })
      .eq('id', row.id);
    if (retireError) throw retireError;
    retired += 1;
    console.log(`[country-topic-migration] Retired duplicate ${row.content_key}; canonical document ${keyForGuide} already exists.`);
    continue;
  }

  const { error: updateError } = await supabase
    .from('content_documents')
    .update({
      content_key: keyForGuide,
      content_type: 'country-guide',
      country_slug: country,
      topic_slug: null,
      slug,
    })
    .eq('id', row.id);
  if (updateError) throw updateError;

  converted += 1;
  console.log(`[country-topic-migration] Converted ${row.content_key} -> ${keyForGuide}`);
}

console.log(`[country-topic-migration] Complete: ${converted} converted, ${retired} retired duplicates.`);
