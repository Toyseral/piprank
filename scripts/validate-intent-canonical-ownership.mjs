import { createClient } from '@supabase/supabase-js';

if (process.env.VERCEL_ENV !== 'production') {
  console.log('[validate-intent-canonical-ownership] Non-production build — skipped (CI has no production database credentials).');
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const supabase = createClient(url, key);
const canonical = {
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
};
const { data: intents, error: ie } = await supabase.from('intents').select('id,slug,label').order('id');
if (ie) throw ie;
const { data: docs, error: de } = await supabase.from('content_documents').select('content_key,slug,published,indexable').eq('content_type','global-best-for');
if (de) throw de;

const docsBySlug = new Map((docs ?? []).map((d) => [d.slug, d]));
const missing = [];
for (const intent of intents ?? []) {
  const slug = canonical[intent.slug] || intent.slug;
  const doc = docsBySlug.get(slug);
  if (!doc) missing.push({ intent: intent.slug, expected: slug });
}
const orphaned = (docs ?? [])
  .filter((doc) => ![...intents ?? []].some((intent) => (canonical[intent.slug] || intent.slug) === doc.slug))
  .map((doc) => doc.slug);

if (missing.length || orphaned.length) {
  console.error('[validate-intent-canonical-ownership] FAILED');
  console.error(JSON.stringify({ missing, orphaned }, null, 2));
  process.exit(1);
}
console.log(`[validate-intent-canonical-ownership] OK — ${intents?.length ?? 0} intents have canonical global Best-For documents.`);
