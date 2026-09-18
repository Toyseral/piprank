import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizePublicSettings } from '../api/_lib/content-sanitizer.js';
import { buildBestForPageModel, pipRankScore, rankingIntentSlug } from '../src/lib/bestForModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');


function localeFor(doc) {
  const settings = sanitizePublicSettings(doc?.settings);
  return String(settings.locale || settings.languageCode || '').trim();
}

function canonicalPath(doc) {
  if (doc.content_type === 'global-best-for') return `/${doc.slug}`;
  if (doc.content_type === 'country-best-for') return `/${doc.country_slug}/${doc.slug}`;
  if (doc.content_type === 'localized-best-for') {
    const locale = localeFor(doc);
    return locale ? `/${doc.country_slug}/${encodeURIComponent(locale)}/${doc.slug}` : null;
  }
  return null;
}

function tokens(slug) {
  return String(slug || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function matchesIntent(broker, intentSlug) {
  const wanted = tokens(intentSlug);
  const tags = Array.isArray(broker.best_for) ? broker.best_for.flatMap(tokens) : [];
  if (!wanted.length) return true;
  if (wanted.every((token) => tags.includes(token))) return true;
  const haystack = `${broker.slug || ''} ${broker.tagline || ''} ${tags.join(' ')}`.toLowerCase();
  return wanted.some((token) => haystack.includes(token));
}

function rankBrokers(brokers, doc, country, rankingRows) {
  const intentSlug = rankingIntentSlug(doc.slug, doc);
  return buildBestForPageModel({ document: doc, brokers, country, intentSlug, rankingRows }).ranked;
}

function comparisonTable(ranked) {
  if (ranked.length < 2) return '';
  return `<section class="piprank-prerender-comparison"><h2>Compare these forex brokers</h2><div class="overflow-x-auto"><table><thead><tr><th>Broker</th><th>PipRank score</th><th>Rating</th><th>Trust</th><th>EUR/USD spread</th><th>Minimum deposit</th></tr></thead><tbody>${ranked.map((b) =>
    `<tr><th><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a></th><td>${pipRankScore(b)}/100</td><td>${esc(b.rating ?? '—')}/5</td><td>${esc(b.trust_score ?? '—')}/100</td><td>${esc(b.spread_eurusd ?? '—')} pips</td><td>${esc(b.min_deposit ?? '—')}</td></tr>`
  ).join('')}</tbody></table></div></section>`;
}

function rankingSection(ranked, doc) {
  if (!ranked.length) return '';
  const label = String(doc.slug || '').replaceAll('-', ' ');
  return `<section class="piprank-prerender-ranking"><h2>Best forex brokers for ${esc(label)}</h2><ol>${ranked.map((b, i) =>
    `<li><strong>#${i + 1} <a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a></strong> — PipRank score ${pipRankScore(b)}/100. ${esc(b.tagline || '')}</li>`
  ).join('')}</ol></section>`;
}

function detailSection(ranked, doc) {
  if (!ranked.length) return '';
  return `<section class="piprank-prerender-analysis"><h2>Detailed broker analysis</h2>${ranked.map((b, i) =>
    `<article id="bestfor-${esc(b.slug)}"><h3>${i + 1}. ${esc(b.name)}</h3><p>${esc(b.tagline || '')}</p><ul><li>PipRank score: ${pipRankScore(b)}/100</li><li>Rating: ${esc(b.rating ?? '—')}/5</li><li>Trust score: ${esc(b.trust_score ?? '—')}/100</li><li>EUR/USD spread: ${esc(b.spread_eurusd ?? '—')} pips</li><li>Minimum deposit: ${esc(b.min_deposit ?? '—')}</li><li>Platforms: ${esc((b.platforms || []).map((p) => typeof p === 'object' ? p?.name : p).filter(Boolean).join(', ') || '—')}</li></ul><p><a href="/brokers/${esc(b.slug)}">Read the full ${esc(b.name)} review</a></p></article>`
  ).join('')}</section>`;
}

function criteriaSection(doc) {
  const settings = sanitizePublicSettings(doc?.settings);
  const criteria = Array.isArray(settings.criteria) ? settings.criteria : [];
  return criteria.length
    ? `<section class="piprank-prerender-criteria"><h2>What we considered</h2><ul>${criteria.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section>`
    : '';
}

function faqSection(doc) {
  const settings = sanitizePublicSettings(doc?.settings);
  const faqs = Array.isArray(settings.faqs) ? settings.faqs : [];
  return faqs.length
    ? `<section class="piprank-prerender-faq"><h2>Frequently asked questions</h2>${faqs.map((faq) => `<details><summary>${esc(faq.q)}</summary><p>${esc(faq.a)}</p></details>`).join('')}</section>`
    : '';
}

function inject(html, extra) {
  if (!extra) return html;
  const marker = '<!-- piprank-bestfor-prerender -->';
  if (html.includes(marker)) return html;
  return html.replace('</main>', `${marker}${extra}</main>`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('Supabase credentials are required for Best-For prerender enrichment.');
    console.warn('[bestfor-prerender] Supabase credentials unavailable; skipping outside production.');
    return;
  }
  if (!existsSync(DIST)) throw new Error('dist/ does not exist. Run vite build first.');

  const supabase = createClient(url, key);
  const [docsRes, brokersRes, countriesRes, rankingsRes] = await Promise.all([
    supabase.from('content_documents').select('id,content_type,country_slug,slug,settings,published,indexable').in('content_type', ['global-best-for', 'country-best-for', 'localized-best-for']).eq('published', true).eq('indexable', true),
    supabase.from('brokers').select('id,name,slug,tagline,rating,trust_score,min_deposit,spread_eurusd,commission_value,health,platforms,best_for'),
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
    const countrySlug = row.countries?.slug;
    const intentSlug = row.intents?.slug;
    if (!countrySlug || !intentSlug) continue;
    const key = `${countrySlug}:${intentSlug}`;
    const rows = rankingMap.get(key) || [];
    rows.push({ broker_id: row.broker_id, final_rank: row.final_rank });
    rankingMap.set(key, rows);
  }

  let enriched = 0;
  for (const doc of docsRes.data || []) {
    const path = canonicalPath(doc);
    if (!path) continue;
    const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path.replace(/^\//, ''), 'index.html');
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    const country = doc.country_slug ? countries.get(doc.country_slug) : null;
    const intentSlug = rankingIntentSlug(doc.slug, doc);
    const rankingRows = country ? (rankingMap.get(`${country.slug}:${intentSlug}`) || []) : [];
    const ranked = rankBrokers(brokersRes.data || [], doc, country, rankingRows);
    const extra = `${rankingSection(ranked, doc)}${comparisonTable(ranked)}${detailSection(ranked, doc)}${criteriaSection(doc)}`;
    const output = inject(html, extra);
    if (output !== html) {
      writeFileSync(file, output, 'utf8');
      enriched++;
    }
  }
  console.log(`[bestfor-prerender] Enriched ${enriched} canonical Best-For prerenders.`);
}

main().catch((error) => { console.error('[bestfor-prerender] FATAL:', error); process.exitCode = 1; });
