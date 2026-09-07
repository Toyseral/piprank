// Audit canonical SEO ownership before a production build.
// Global commercial pages are owned by intents at root-level URLs.
// Country commercial pages are owned by the static country SEO matrix.
// country_best_for and country-best-for content_documents are legacy/editorial
// sources and must not become competing indexable commercial pages.
import { createClient } from '@supabase/supabase-js';
import { countrySeoTopics, rankCountryTopicBrokers } from './country-seo-topics.mjs';

const GLOBAL_PATH = {
  beginners: '/forex-brokers-for-beginners',
  'low-spread': '/low-spread-forex-brokers',
  mt5: '/mt5-forex-brokers',
  mt4: '/mt4-forex-brokers',
  gold: '/gold-forex-brokers',
  ecn: '/ecn-forex-brokers',
  'copy-trading': '/copy-trading-forex-brokers',
  scalping: '/forex-brokers-for-scalping',
  'swing-trading': '/forex-brokers-for-swing-trading',
  'high-leverage': '/high-leverage-forex-brokers',
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const supabase = createClient(url, key);

const [
  { data: intents, error: intentsError },
  { data: countries, error: countriesError },
  { data: brokers, error: brokersError },
  { data: countryBestFors, error: countryBestForsError },
  { data: docs, error: docsError },
] = await Promise.all([
  supabase.from('intents').select('id, slug, title, indexable'),
  supabase.from('countries').select('id, slug, name, recommended'),
  supabase.from('brokers').select('*'),
  supabase.from('country_best_for').select('id, country_id, slug, title, published, indexable'),
  supabase.from('content_documents').select('id, content_type, country_slug, topic_slug, slug, title, published, indexable'),
]);
for (const [name, error] of [['intents', intentsError], ['countries', countriesError], ['brokers', brokersError], ['country_best_for', countryBestForsError], ['content_documents', docsError]]) {
  if (error) throw new Error(`[keyword-ownership] ${name}: ${error.message}`);
}

const countryById = new Map((countries ?? []).map((c) => [Number(c.id), c]));
const owners = new Map();
const keywords = new Map();
const conflicts = [];
const add = (owner) => {
  if (!owner.path) return;
  if (owners.has(owner.path)) conflicts.push({ type: 'duplicate-path', owner, existing: owners.get(owner.path) });
  else owners.set(owner.path, owner);
  const keyword = String(owner.keyword ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (keyword) {
    if (keywords.has(keyword)) conflicts.push({ type: 'duplicate-keyword', owner, existing: keywords.get(keyword) });
    else keywords.set(keyword, owner);
  }
};

for (const intent of intents ?? []) {
  if (intent.indexable === false) continue;
  const path = GLOBAL_PATH[intent.slug];
  if (!path) continue;
  add({ source: 'intents', id: intent.id, pageType: 'global-commercial', path, keyword: intent.title });
}

const matrixPaths = new Set();
for (const country of countries ?? []) {
  add({ source: 'countries', id: country.id, pageType: 'country-hub', path: `/${country.slug}`, keyword: `Best Forex Brokers in ${country.name}` });
  for (const topic of countrySeoTopics) {
    if (topic.indexable === false) continue;
    const eligible = rankCountryTopicBrokers(brokers ?? [], country, topic);
    if (eligible.length < (topic.minBrokers ?? 1)) continue;
    const path = `/${country.slug}/${topic.slug}`;
    matrixPaths.add(path);
    add({ source: 'country-seo-matrix', pageType: 'country-commercial', path, keyword: `Best ${topic.title} in ${country.name}` });
  }
}

for (const page of countryBestFors ?? []) {
  if (!page.published || !page.indexable) continue;
  const country = countryById.get(Number(page.country_id));
  if (!country) continue;
  const topic = GLOBAL_PATH[page.slug] ? page.slug : page.slug;
  const matrixSlug = GLOBAL_PATH[topic]?.slice(1);
  const path = matrixSlug && matrixPaths.has(`/${country.slug}/${matrixSlug}`)
    ? `/${country.slug}/${matrixSlug}`
    : `/countries/${country.slug}/best/${page.slug}`;
  if (matrixPaths.has(path)) conflicts.push({ type: 'superseded-country-best-for', owner: { source: 'country_best_for', id: page.id, path, keyword: page.title }, existing: { source: 'country-seo-matrix', path } });
}

for (const doc of docs ?? []) {
  if (!doc.published || !doc.indexable || doc.content_type !== 'country-best-for') continue;
  if (!doc.country_slug || !doc.slug) continue;
  const matrixSlug = GLOBAL_PATH[doc.slug]?.slice(1) ?? doc.topic_slug;
  const path = matrixSlug ? `/${doc.country_slug}/${matrixSlug}` : '';
  if (path && matrixPaths.has(path)) conflicts.push({ type: 'editorial-country-commercial-overlap', owner: { source: 'content_documents', id: doc.id, path, keyword: doc.title }, existing: { source: 'country-seo-matrix', path } });
}

for (const doc of docs ?? []) {
  if (!doc.published || !doc.indexable) continue;
  if (['country-best-for', 'country-topic', 'country-guide', 'guide', 'best-for'].includes(doc.content_type) && !doc.slug) conflicts.push({ type: 'indexable-record-without-slug', owner: { source: 'content_documents', id: doc.id, path: '', keyword: doc.title } });
}

console.log(`[keyword-ownership] Canonical URL owners: ${owners.size}`);
console.log(`[keyword-ownership] Primary keywords: ${keywords.size}`);
console.log(`[keyword-ownership] Eligible matrix URLs: ${matrixPaths.size}`);
console.log(`[keyword-ownership] Conflicts: ${conflicts.length}`);
for (const c of conflicts) console.log(`\n[${c.type}]\n  current: ${c.owner?.source ?? 'unknown'} → ${c.owner?.path ?? 'n/a'} → ${c.owner?.keyword ?? 'n/a'}\n  existing: ${c.existing?.source ?? 'unknown'} → ${c.existing?.path ?? 'n/a'} → ${c.existing?.keyword ?? 'n/a'}`);
if (conflicts.length) process.exitCode = 1;
