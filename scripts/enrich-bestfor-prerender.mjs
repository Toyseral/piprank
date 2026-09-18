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


function rankBrokers(brokers, doc, country, rankingRows) {
  const intentSlug = rankingIntentSlug(doc.slug, doc);
  return buildBestForPageModel({ document: doc, brokers, country, intentSlug, rankingRows }).ranked;
}

function comparisonTable(ranked, doc) {
  if (ranked.length < 2) return '';
  const settings = sanitizePublicSettings(doc?.settings);
  const requested = Array.isArray(settings.comparisonFields) && settings.comparisonFields.length ? settings.comparisonFields : ['min_deposit', 'spread_eurusd', 'commission', 'max_leverage'];
  const fields = requested.filter((field) => ['min_deposit', 'spread_eurusd', 'commission', 'max_leverage', 'platforms', 'payments', 'regulations'].includes(field));
  const labels = { min_deposit: 'Minimum deposit', spread_eurusd: 'EUR/USD spread', commission: 'Commission', max_leverage: 'Max leverage', platforms: 'Platforms', payments: 'Payment methods', regulations: 'Regulation' };
  const value = (broker, field) => {
    if (field === 'min_deposit') return broker.min_deposit ?? '—';
    if (field === 'spread_eurusd') return (broker.spread_eurusd ?? '—') + 'p';
    if (field === 'commission') return broker.commission || '—';
    if (field === 'max_leverage') return broker.max_leverage || '—';
    if (field === 'platforms') return (broker.platforms || []).map((p) => typeof p === 'object' ? p?.name : p).filter(Boolean).join(', ') || '—';
    if (field === 'payments') return (broker.payments || []).join(', ') || '—';
    if (field === 'regulations') return (broker.regulations || []).map((r) => r?.body).filter(Boolean).join(', ') || '—';
    return '—';
  };
  const headers = fields.map((field) => '<th>' + esc(labels[field]) + '</th>').join('');
  const rows = ranked.map((b) => '<tr><th><a href="/brokers/' + esc(b.slug) + '">' + esc(b.name) + '</a></th>' + fields.map((field) => '<td>' + esc(value(b, field)) + '</td>').join('') + '</tr>').join('');
  return '<section class="piprank-prerender-comparison"><h2>Compare these forex brokers</h2><div class="overflow-x-auto"><table><thead><tr><th>Broker</th>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div></section>';
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

function verdictSection(broker, intentSlug) {
  if (!broker) return '';
  const score = pipRankScore(broker);
  const category = String(intentSlug || '').replace(/-/g, ' ');
  const tags = (broker.best_for || []).slice(0, 6).map((item) => '<span>' + esc('Best for ' + item) + '</span>').join('');
  return '<section class="piprank-prerender-verdict"><p>PipRank verdict</p><h4>Is ' + esc(broker.name) + ' right for ' + esc(category) + '?</h4><p>' + esc(broker.tagline || ('Review the costs, regulation, platforms and account features before deciding.')) + ' ' + esc(broker.best_for?.length ? `PipRank considers ${broker.name} relevant for ${broker.best_for.slice(0, 3).join(', ')}.` : '') + '</p><div>' + tags + '</div></section>';
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
  const [docsRes, brokersRes, countriesRes, rankingsRes, overridesRes, availabilityRes] = await Promise.all([
    supabase.from('content_documents').select('id,content_type,country_slug,slug,settings,published,indexable').in('content_type', ['global-best-for', 'country-best-for', 'localized-best-for']).eq('published', true).eq('indexable', true),
    supabase.from('brokers').select('id,name,slug,tagline,rating,trust_score,min_deposit,spread_eurusd,commission_value,commission,max_leverage,payments,regulations,health,platforms,best_for,assets,scalping,islamic_account,copy_trading,hedging,account_types,demo_account'),
    supabase.from('countries').select('slug,recommended,publishing_state').eq('publishing_state', 'published'),
    supabase.from('country_intent_broker_final_rankings').select('final_rank,broker_id,countries!inner(slug),intents!inner(slug)'),
    supabase.from('country_intent_broker_overrides').select('broker_id,manual_rank,force_include,force_exclude,countries!inner(slug),intents!inner(slug)'),
    supabase.from('broker_country_availability').select('broker_id,status,countries!inner(slug)'),
  ]);
  if (docsRes.error) throw docsRes.error;
  if (brokersRes.error) throw brokersRes.error;
  if (countriesRes.error) throw countriesRes.error;
  if (rankingsRes.error) throw rankingsRes.error;
  if (overridesRes.error) throw overridesRes.error;
  if (availabilityRes.error) throw availabilityRes.error;

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

  const overrideMap = new Map();
  for (const row of overridesRes.data || []) {
    const countrySlug = row.countries?.slug;
    const intentSlug = row.intents?.slug;
    if (!countrySlug || !intentSlug) continue;
    const key = countrySlug + ':' + intentSlug;
    const rows = overrideMap.get(key) || [];
    rows.push(row);
    overrideMap.set(key, rows);
  }

  const availabilityMap = new Map();
  for (const row of availabilityRes.data || []) {
    const countrySlug = row.countries?.slug;
    if (!countrySlug) continue;
    availabilityMap.set(countrySlug + ':' + row.broker_id, row.status || 'available');
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
    const rankingKey = country ? country.slug + ':' + intentSlug : '';
    const baseRows = country ? (rankingMap.get(rankingKey) || []) : [];
    const overrides = country ? (overrideMap.get(rankingKey) || []) : [];
    const rankingRows = baseRows
      .map((row) => {
        const override = overrides.find((item) => Number(item.broker_id) === Number(row.broker_id));
        return {
          ...row,
          manual_rank: override?.manual_rank ?? null,
          force_exclude: Boolean(override?.force_exclude),
          availability_status: availabilityMap.get(country.slug + ':' + row.broker_id) || 'available',
        };
      })
      .filter((row) => !row.force_exclude && row.availability_status === 'available');
    const overrideOnlyRows = overrides
      .filter((row) => !row.force_exclude)
      .filter((row) => (availabilityMap.get(country.slug + ':' + row.broker_id) || 'available') === 'available')
      .filter((row) => !rankingRows.some((existing) => Number(existing.broker_id) === Number(row.broker_id)))
      .filter((row) => Boolean(row.force_include) || (Number.isInteger(Number(row.manual_rank)) && Number(row.manual_rank) >= 1 && Number(row.manual_rank) <= 9))
      .map((row) => ({
        broker_id: Number(row.broker_id),
        final_rank: Number.isInteger(Number(row.manual_rank)) ? Number(row.manual_rank) : null,
        manual_rank: Number.isInteger(Number(row.manual_rank)) ? Number(row.manual_rank) : null,
        force_include: Boolean(row.force_include),
        availability_status: 'available',
      }));
    const dedupedRankingRows = [...rankingRows, ...overrideOnlyRows];
    const ranked = rankBrokers(brokersRes.data || [], doc, country, dedupedRankingRows);
    const extra = `${rankingSection(ranked, doc)}${comparisonTable(ranked, doc)}${detailSection(ranked, doc)}${criteriaSection(doc)}${ranked.map((broker) => verdictSection(broker, intentSlug)).join('')}`;
    const output = inject(html, extra);
    if (output !== html) {
      writeFileSync(file, output, 'utf8');
      enriched++;
    }
  }
  console.log(`[bestfor-prerender] Enriched ${enriched} canonical Best-For prerenders.`);
}

main().catch((error) => { console.error('[bestfor-prerender] FATAL:', error); process.exitCode = 1; });
