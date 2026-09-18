import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBestForPageModel, rankingIntentSlug } from '../src/lib/bestForModel.js';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

function canonicalPath(doc) {
  if (doc.content_type === 'global-best-for') return `/${doc.slug}`;
  if (doc.content_type === 'country-best-for') return `/${doc.country_slug}/${doc.slug}`;
  if (doc.content_type === 'localized-best-for') {
    const settings = doc.settings || {};
    const locale = String(settings.locale || settings.languageCode || '').trim();
    return locale ? `/${doc.country_slug}/${encodeURIComponent(locale)}/${doc.slug}` : null;
  }
  return null;
}

function rankingNames(html) {
  const names = [];
  const re = /<section class="piprank-prerender-ranking">[\s\S]*?<ol>([\s\S]*?)<\/ol>/g;
  const match = re.exec(html);
  if (!match) return names;
  const itemRe = /<li><strong>#[0-9]+ <a [^>]+>([^<]+)<\/a><\/strong>/g;
  let item;
  while ((item = itemRe.exec(match[1]))) names.push(item[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'").replaceAll('&quot;', '"'));
  return names;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('Supabase credentials are required for Best-For prerender parity validation.');
    console.warn('[bestfor-parity] Supabase credentials unavailable; skipping outside production.');
    return;
  }
  if (!existsSync(DIST)) throw new Error('dist/ does not exist. Run vite build first.');

  const supabase = createClient(url, key);
  const [docsRes, brokersRes, countriesRes, rankingsRes] = await Promise.all([
    supabase.from('content_documents').select('id,content_type,country_slug,slug,settings,published,indexable').in('content_type', ['global-best-for', 'country-best-for', 'localized-best-for']).eq('published', true).eq('indexable', true),
    supabase.from('brokers').select('id,name,slug,rating,trust_score,best_for,spread_eurusd,min_deposit,commission_value,health,platforms,assets,scalping,islamic_account,copy_trading,hedging,account_types,demo_account'),
    supabase.from('countries').select('slug,recommended,publishing_state').eq('publishing_state', 'published'),
    supabase.from('country_intent_broker_final_rankings').select('final_rank,broker_id,countries!inner(slug),intents!inner(slug)'),
  ]);
  if (docsRes.error) throw docsRes.error;
  if (brokersRes.error) throw brokersRes.error;
  if (countriesRes.error) throw countriesRes.error;
  if (rankingsRes.error) throw rankingsRes.error;

  const countries = new Map((countriesRes.data || []).map((country) => [country.slug, country]));
  const rankingMap = new Map();
  for (const row of rankingsRes.data || []) {
    const key = `${row.countries?.slug}:${row.intents?.slug}`;
    const rows = rankingMap.get(key) || [];
    rows.push({ broker_id: row.broker_id, final_rank: row.final_rank });
    rankingMap.set(key, rows);
  }

  const failures = [];
  for (const doc of docsRes.data || []) {
    const path = canonicalPath(doc);
    if (!path) continue;
    const file = join(DIST, path.replace(/^\//, ''), 'index.html');
    if (!existsSync(file)) { failures.push(`${path}: prerender file missing`); continue; }
    const country = doc.country_slug ? countries.get(doc.country_slug) : null;
    const intentSlug = rankingIntentSlug(doc.slug, doc);
    const rankingRows = country ? (rankingMap.get(`${country.slug}:${intentSlug}`) || []) : [];
    const model = buildBestForPageModel({ document: doc, brokers: brokersRes.data || [], country, intentSlug, rankingRows });
    const actual = rankingNames(readFileSync(file, 'utf8')).slice(0, 9);
    const expected = model.top9.map((broker) => broker.name);
    if (actual.join('\n') !== expected.join('\n')) failures.push(`${path}: expected [${expected.join(', ')}] but prerender contains [${actual.join(', ')}]`);
  }
  if (failures.length) {
    console.error('[bestfor-parity] FAIL');
    failures.forEach((failure) => console.error(` - ${failure}`));
    throw new Error(`Best-For prerender parity failed for ${failures.length} page(s).`);
  }
  console.log(`[bestfor-parity] PASS — checked ${(docsRes.data || []).length} canonical Best-For documents.`);
}

main().catch((error) => { console.error('[bestfor-parity] FATAL:', error); process.exitCode = 1; });