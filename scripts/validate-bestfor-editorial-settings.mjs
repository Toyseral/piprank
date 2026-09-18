import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function warn(message) { console.warn(`[validate-bestfor-editorial-settings] WARNING: ${message}`); }
function fail(message) { throw new Error(`Best-For editorial settings validation failed: ${message}`); }

if (!url || !key) {
  if (process.env.VERCEL_ENV === 'production') fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
  warn('Supabase credentials unavailable; skipping outside production.');
  process.exit(0);
}

const supabase = createClient(url, key);
const { data, error } = await supabase
  .from('content_documents')
  .select('id,content_key,content_type,settings')
  .in('content_type', ['global-best-for', 'country-best-for', 'localized-best-for'])
  .limit(10000);

if (error) fail(error.message);

const offenders = (data || []).filter((doc) => {
  const settings = doc.settings && typeof doc.settings === 'object' && !Array.isArray(doc.settings) ? doc.settings : {};
  return Object.prototype.hasOwnProperty.call(settings, 'sections');
});

if (offenders.length) {
  offenders.slice(0, 50).forEach((doc) => console.error(`[validate-bestfor-editorial-settings] Legacy settings.sections remains in ${doc.content_key || doc.id}`));
  if (offenders.length > 50) console.error(`[validate-bestfor-editorial-settings] ...and ${offenders.length - 50} more`);
  fail(`${offenders.length} Best-For document(s) still use settings.sections. Run npm run migrate:bestfor-sections once before deploying this architecture.`);
}

console.log(`Best-For editorial settings validation passed: ${(data || []).length} document(s) checked.`);
