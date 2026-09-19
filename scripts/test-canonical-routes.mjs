import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { canonicalPathForDocument, localeOf } from '../src/lib/canonical-route-registry.mjs';
import { sanitizeBlocks, sanitizeHtml, sanitizePublicSettings } from '../api/_lib/content-sanitizer.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for canonical route tests.');

const db = createClient(url, key);
const canonicalTypes = ['guide','global-best-for','country-guide','country-best-for','localized-guide','localized-best-for','broker','country'];

const [{ data: countries, error: countriesError }, { data: docs, error: docsError }] = await Promise.all([
  db.from('countries').select('id,slug,publishing_state').eq('publishing_state','published'),
  db.from('content_documents').select('content_type,country_slug,topic_slug,slug,content_key,published,indexable,settings,html,blocks').in('content_type', canonicalTypes).eq('published', true).eq('indexable', true),
]);
if (countriesError) throw countriesError;
if (docsError) throw docsError;

const countrySet = new Set((countries || []).map((row) => row.slug));
assert.ok(countrySet.has('nigeria'), '/nigeria must resolve to a published country');
assert.ok(countrySet.has('vietnam'), '/vietnam must resolve to a published country');

const docByKey = new Map((docs || []).map((doc) => [doc.content_key, doc]));
const publishedGlobal = new Set((docs || []).filter((d) => d.content_type === 'global-best-for').map((d) => d.slug));
assert.ok(publishedGlobal.has('mt5-forex-brokers'), '/mt5-forex-brokers must resolve to a published global canonical document');
assert.equal(publishedGlobal.has('eur-usd-forex-brokers'), false, '/eur-usd-forex-brokers must not resolve while its canonical document is unpublished');
assert.equal(publishedGlobal.has('crypto-brokers'), false, '/crypto-brokers must not resolve while its canonical document is unpublished');
assert.equal(docByKey.has('country-best-for:nigeria:forex-brokers-for-beginners'), false, '/nigeria/forex-brokers-for-beginners must not resolve without a published canonical country document');

for (const doc of docs || []) {
  const path = canonicalPathForDocument(doc);
  assert.ok(path, `Published canonical document has no canonical path: ${doc.content_key}`);
  if (doc.content_type === 'localized-guide' || doc.content_type === 'localized-best-for') assert.ok(localeOf(doc), `Localized document has no resolvable locale: ${doc.content_key}`);
  sanitizePublicSettings(doc.settings);
  sanitizeBlocks(doc.blocks);
  sanitizeHtml(doc.html || '');
}

const localized = (docs || []).find((doc) => ['localized-guide','localized-best-for'].includes(doc.content_type));
if (localized) {
  const locale = localeOf(localized);
  assert.ok(locale);
  assert.match(canonicalPathForDocument(localized), new RegExp(`^/${localized.country_slug}/${locale}/`));
}

const { error: rpcError } = await db.rpc('replace_broker_country_availability', { p_broker_id: -1, p_rows: [] });
assert.ok(rpcError, 'RPC contract probe should reject the intentionally invalid broker id');
assert.match(String(rpcError.message || rpcError), /broker_id is required|Broker not found/i, 'RPC exists but did not expose the expected application contract');

console.log(`Canonical route contract passed: ${(countries || []).length} countries, ${(docs || []).length} published/indexable canonical documents.`);
