import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function warn(message) { console.warn(`[author-attribution] WARNING: ${message}`); }
function fail(message) { throw new Error(`Author attribution validation failed: ${message}`); }

if (!url || !key) {
  if (process.env.VERCEL_ENV === 'production') {
    fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
  }
  warn('Supabase credentials unavailable; skipping author attribution validation outside production.');
  process.exit(0);
}

const supabase = createClient(url, key);
const [{ data: docs, error: docsError }, { data: authors, error: authorsError }] = await Promise.all([
  supabase
    .from('content_documents')
    .select('id,content_key,content_type,slug,published,settings')
    .in('content_type', ['guide', 'global-best-for', 'country-guide', 'country-best-for', 'localized-guide', 'localized-best-for', 'broker', 'country'])
    .limit(10000),
  supabase
    .from('content_documents')
    .select('content_key,slug,published')
    .eq('content_type', 'author')
    .limit(10000),
]);

if (docsError) fail(docsError.message);
if (authorsError) fail(authorsError.message);

const publishedAuthors = new Set((authors || []).filter((author) => author.published === true).map((author) => String(author.slug || '').trim().toLowerCase()).filter(Boolean));
const explicitFields = ['author_slug', 'reviewed_by_slug', 'fact_checked_by_slug'];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let checked = 0;
const errors = [];

for (const doc of docs || []) {
  const settings = doc.settings && typeof doc.settings === 'object' && !Array.isArray(doc.settings) ? doc.settings : {};
  for (const field of explicitFields) {
    const raw = settings[field];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const slug = String(raw).trim().toLowerCase();
    checked++;
    if (!slugPattern.test(slug)) {
      errors.push(`${doc.content_key || doc.id}: ${field} "${slug}" is not a valid author slug`);
      continue;
    }
    if (!publishedAuthors.has(slug)) {
      errors.push(`${doc.content_key || doc.id}: ${field} "${slug}" does not resolve to a published canonical author profile`);
    }
  }
}

if (errors.length) {
  for (const error of errors.slice(0, 50)) console.error(`[author-attribution] ${error}`);
  if (errors.length > 50) console.error(`[author-attribution] ...and ${errors.length - 50} more`);
  fail(`${errors.length} invalid attribution reference(s) found`);
}

console.log(`Author attribution validation passed: ${checked} explicit attribution reference(s), ${publishedAuthors.size} published author profile(s).`);
