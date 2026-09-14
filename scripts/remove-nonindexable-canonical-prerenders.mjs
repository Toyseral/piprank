// Canonical prerendering may materialize published documents that are deliberately
// marked noindex. Those documents must not leave static HTML that can be discovered
// independently of the SPA metadata. Keep only published + indexable canonical docs.
import { createClient } from '@supabase/supabase-js';
import { existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');

function localeOf(doc) {
  return String(doc?.settings?.locale || doc?.settings?.languageCode || '').trim();
}
function canonicalPath(doc) {
  const country = String(doc.country_slug || '').trim();
  const slug = String(doc.slug || '').trim();
  const locale = localeOf(doc);
  switch (doc.content_type) {
    case 'guide': return slug && !country ? `/guides/${slug}` : null;
    case 'global-best-for': return slug && !country ? `/${slug}` : null;
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
function fileForPath(path) {
  return path === '/' ? join(DIST, 'index.html') : join(DIST, path.slice(1), 'index.html');
}

async function main() {
  if (!existsSync(DIST)) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('Supabase credentials are required to clean non-indexable canonical prerenders.');
    console.log('[remove-nonindexable-canonical-prerenders] Non-production build without Supabase credentials — skipped.');
    return;
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('content_documents')
    .select('content_type,country_slug,slug,published,indexable,settings')
    .in('content_type', ['guide', 'global-best-for', 'country-guide', 'country-best-for', 'localized-guide', 'localized-best-for', 'broker', 'country', 'compare']);
  if (error) throw new Error(`Failed to load canonical content documents: ${error.message}`);

  const allowed = new Set((data ?? []).filter((doc) => doc.published && doc.indexable !== false).map(canonicalPath).filter(Boolean));
  let removed = 0;
  for (const doc of data ?? []) {
    const path = canonicalPath(doc);
    if (!path || allowed.has(path)) continue;
    const file = fileForPath(path);
    if (!existsSync(file)) continue;
    rmSync(path === '/' ? file : join(DIST, path.slice(1)), { recursive: true, force: true });
    removed += 1;
  }
  console.log(`[remove-nonindexable-canonical-prerenders] Removed ${removed} non-indexable canonical prerenders.`);
}

main().catch((error) => {
  console.error('[remove-nonindexable-canonical-prerenders] ERROR:', error);
  process.exit(1);
});
