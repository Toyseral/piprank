import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizePublicSettings } from '../api/_lib/content-sanitizer.js';
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

function hasClass(html, className) { return html.includes('class="' + className + '"'); }

function expectedAdditionalTitles(doc) {
  const settings = sanitizePublicSettings(doc?.settings);
  const sections = Array.isArray(settings.sections) ? settings.sections : [];
  const reserved = new Set(['__bestfor_ranking_description', '__bestfor_comparison_description', '__bestfor_broker_analysis_description']);
  return sections.filter((section) => section && (section.title || section.html) && !reserved.has(String(section.title || ''))).map((section) => String(section.title || '').trim()).filter(Boolean);
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
  const [docsRes, brokersRes, countriesRes, rankingsRes, overridesRes, availabilityRes, settingsRes] = await Promise.all([
    supabase.from('content_documents').select('id,content_type,country_slug,slug,settings,published,indexable').in('content_type', ['global-best-for', 'country-best-for', 'localized-best-for']).eq('published', true).eq('indexable', true),
    supabase.from('brokers').select('id,name,slug,rating,trust_score,best_for,spread_eurusd,min_deposit,commission_value,health,platforms,assets,scalping,islamic_account,copy_trading,hedging,account_types,demo_account'),
    supabase.from('countries').select('slug,publishing_state').eq('publishing_state', 'published'),
    supabase.from('country_intent_broker_final_rankings').select('final_rank,broker_id,countries!inner(slug),intents!inner(slug)'),
    supabase.from('country_intent_broker_overrides').select('broker_id,manual_rank,force_include,force_exclude,countries!inner(slug),intents!inner(slug)'),
    supabase.from('broker_country_availability').select('broker_id,status,countries!inner(slug)'),
    supabase.from('country_intent_ranking_settings').select('ranking_mode,countries!inner(slug),intents!inner(slug)'),
  ]);
  if (docsRes.error) throw docsRes.error;
  if (brokersRes.error) throw brokersRes.error;
  if (countriesRes.error) throw countriesRes.error;
  if (rankingsRes.error) throw rankingsRes.error;
  if (overridesRes.error) throw overridesRes.error;
  if (availabilityRes.error) throw availabilityRes.error;

  const countries = new Map((countriesRes.data || []).map((country) => [country.slug, country]));
  const settingsMap = new Map((settingsRes.data || []).map((row) => [`${row.countries?.slug}:${row.intents?.slug}`, row.ranking_mode === 'manual' ? 'manual' : 'automatic']));
  const rankingMap = new Map();
  for (const row of rankingsRes.data || []) {
    const key = `${row.countries?.slug}:${row.intents?.slug}`;
    const rows = rankingMap.get(key) || [];
    rows.push({ broker_id: row.broker_id, final_rank: row.final_rank });
    rankingMap.set(key, rows);
  }

  const overrideMap = new Map();
  for (const row of overridesRes.data || []) {
    const key = String(row.countries?.slug || '') + ':' + String(row.intents?.slug || '');
    const rows = overrideMap.get(key) || [];
    rows.push(row);
    overrideMap.set(key, rows);
  }
  const availabilityMap = new Map();
  for (const row of availabilityRes.data || []) {
    availabilityMap.set(String(row.countries?.slug || '') + ':' + String(row.broker_id), row.status || 'available');
  }

  const failures = [];
  for (const doc of docsRes.data || []) {
    const path = canonicalPath(doc);
    if (!path) continue;
    const file = join(DIST, path.replace(/^\//, ''), 'index.html');
    if (!existsSync(file)) { failures.push(`${path}: prerender file missing`); continue; }
    const country = doc.country_slug ? countries.get(doc.country_slug) : null;
    const intentSlug = rankingIntentSlug(doc.slug, doc);
    const rankingKey = country ? String(country.slug) + ':' + String(intentSlug) : '';
    const rankingMode = country ? (settingsMap.get(rankingKey) || 'automatic') : 'automatic';
    const baseRows = country ? (rankingMap.get(rankingKey) || []) : [];
    const overrides = country ? (overrideMap.get(rankingKey) || []) : [];
    const rankingRows = baseRows
      .map((row) => {
        const override = overrides.find((item) => Number(item.broker_id) === Number(row.broker_id));
        return { ...row, manual_rank: rankingMode === 'manual' ? (override?.manual_rank ?? null) : null, force_exclude: Boolean(override?.force_exclude), availability_status: availabilityMap.get(String(country.slug) + ':' + String(row.broker_id)) || 'available' };
      })
      .filter((row) => !row.force_exclude && row.availability_status === 'available');
    const overrideOnlyRows = overrides
      .filter((row) => !row.force_exclude)
      .filter((row) => (availabilityMap.get(String(country.slug) + ':' + String(row.broker_id)) || 'available') === 'available')
      .filter((row) => !rankingRows.some((existing) => Number(existing.broker_id) === Number(row.broker_id)))
      .filter((row) => rankingMode === 'manual' ? (Number.isInteger(Number(row.manual_rank)) && Number(row.manual_rank) >= 1 && Number(row.manual_rank) <= 9) || Boolean(row.force_include) : Boolean(row.force_include))
      .map((row) => ({ broker_id: Number(row.broker_id), final_rank: rankingMode === 'manual' && Number.isInteger(Number(row.manual_rank)) ? Number(row.manual_rank) : null, manual_rank: rankingMode === 'manual' && Number.isInteger(Number(row.manual_rank)) ? Number(row.manual_rank) : null, force_include: Boolean(row.force_include), availability_status: 'available' }));
    const model = buildBestForPageModel({ document: doc, brokers: brokersRes.data || [], country, intentSlug, rankingRows: [...rankingRows, ...overrideOnlyRows] });
    const html = readFileSync(file, 'utf8');
    const actual = rankingNames(html).slice(0, 9);
    const expected = model.top9.map((broker) => broker.name);
    if (actual.join('\n') !== expected.join('\n')) failures.push(`${path}: expected [${expected.join(', ')}] but prerender contains [${actual.join(', ')}]`);
    if (expected.length > 0 && !hasClass(html, 'piprank-prerender-ranking')) failures.push(`${path}: ranking section missing`);
    if (expected.length > 1 && !hasClass(html, 'piprank-prerender-comparison')) failures.push(`${path}: comparison section missing`);
    if (model.criteria.length > 0 && !hasClass(html, 'piprank-prerender-criteria')) failures.push(`${path}: criteria section missing`);
    if (expected.length > 0 && !hasClass(html, 'piprank-prerender-verdict')) failures.push(`${path}: verdict section missing`);
    const expectedTitles = expectedAdditionalTitles(doc);
    for (const title of expectedTitles) {
      const escapedTitle = title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
      if (!html.includes('<h3>' + escapedTitle + '</h3>')) failures.push(`${path}: additional section missing: ${title}`);
    }
  }
  if (failures.length) {
    console.error('[bestfor-parity] FAIL');
    failures.forEach((failure) => console.error(` - ${failure}`));
    throw new Error(`Best-For prerender parity failed for ${failures.length} page(s).`);
  }
  console.log(`[bestfor-parity] PASS — checked ${(docsRes.data || []).length} canonical Best-For documents.`);
}

main().catch((error) => { console.error('[bestfor-parity] FATAL:', error); process.exitCode = 1; });