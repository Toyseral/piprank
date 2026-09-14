// Remove legacy country-topic static prerenders after the legacy prerender script runs.
// Public two-segment country URLs are exclusively owned by country-best-for
// content documents. Country guides live under /:country/guides/:slug.
import { createClient } from '@supabase/supabase-js';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');

async function main() {
  if (!existsSync(DIST)) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('Supabase credentials are required to clean retired country-topic prerenders.');
    console.log('[remove-retired-country-topic-prerenders] Non-production build without Supabase credentials — skipped.');
    return;
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('content_documents')
    .select('country_slug, slug, published')
    .eq('content_type', 'country-best-for')
    .eq('published', true);
  if (error) throw new Error(`Failed to load canonical country Best-For documents: ${error.message}`);

  const allowed = new Set((data ?? []).map((row) => `${row.country_slug}/${row.slug}`));
  let removed = 0;

  for (const countryEntry of readdirSync(DIST, { withFileTypes: true })) {
    if (!countryEntry.isDirectory() || countryEntry.name === 'guides' || countryEntry.name === 'brokers' || countryEntry.name === 'compare' || countryEntry.name === 'countries') continue;
    const countryDir = join(DIST, countryEntry.name);
    for (const child of readdirSync(countryDir, { withFileTypes: true })) {
      if (!child.isDirectory() || child.name === 'guides') continue;
      const childIndex = join(countryDir, child.name, 'index.html');
      if (!existsSync(childIndex)) continue;
      if (allowed.has(`${countryEntry.name}/${child.name}`)) continue;
      rmSync(join(countryDir, child.name), { recursive: true, force: true });
      removed += 1;
    }
  }

  console.log(`[remove-retired-country-topic-prerenders] Removed ${removed} retired two-segment country prerenders.`);
}

main().catch((error) => {
  console.error('[remove-retired-country-topic-prerenders] ERROR:', error);
  process.exit(1);
});
