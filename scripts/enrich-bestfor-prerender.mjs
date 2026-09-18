import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizePublicSettings } from '../api/_lib/content-sanitizer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE_NAME = 'PipRank';

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const score = (broker) => {
  const rating = Number(broker.rating || 0);
  const trust = Number(broker.trust_score || 0);
  const spread = Number(broker.spread_eurusd || 0);
  return Math.max(1, Math.min(99, Math.round(
    rating * 4 + trust * 0.55 + Math.max(0, 30 - spread * 3)
  )));
};

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

function rankBrokers(brokers, doc, countryRecommended) {
  const settings = sanitizePublicSettings(doc?.settings);
  const excluded = new Set(Array.isArray(settings.excludedBrokerSlugs) ? settings.excludedBrokerSlugs : []);
  const eligible = brokers.filter((broker) => {
    if (!broker.slug || excluded.has(broker.slug)) return false;
    if (doc.country_slug && countryRecommended?.size && !countryRecommended.has(broker.slug)) return false;
    return matchesIntent(broker, doc.slug);
  });

  const base = eligible.length >= 2 ? eligible : brokers.filter((broker) =>
    broker.slug && !excluded.has(broker.slug) &&
    (!doc.country_slug || !countryRecommended?.size || countryRecommended.has(broker.slug))
  );

  const ranked = [...base].sort((a, b) =>
    score(b) - score(a) ||
    Number(b.trust_score || 0) - Number(a.trust_score || 0) ||
    String(a.name).localeCompare(String(b.name))
  );

  if (settings.rankingMode === 'manual' && Array.isArray(settings.pinnedBrokerSlugs)) {
    const order = new Map(settings.pinnedBrokerSlugs.map((slug, i) => [String(slug), i]));
    ranked.sort((a, b) => {
      const ai = order.has(a.slug) ? order.get(a.slug) : Number.MAX_SAFE_INTEGER;
      const bi = order.has(b.slug) ? order.get(b.slug) : Number.MAX_SAFE_INTEGER;
      return ai - bi || score(b) - score(a);
    });
  }
  return ranked.slice(0, 9);
}

function comparisonTable(ranked) {
  if (ranked.length < 2) return '';
  return `<section class="piprank-prerender-comparison"><h2>Compare these forex brokers</h2><div class="overflow-x-auto"><table><thead><tr><th>Broker</th><th>PipRank score</th><th>Rating</th><th>Trust</th><th>EUR/USD spread</th><th>Minimum deposit</th></tr></thead><tbody>${ranked.map((b) =>
    `<tr><th><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a></th><td>${score(b)}/100</td><td>${esc(b.rating ?? '—')}/5</td><td>${esc(b.trust_score ?? '—')}/100</td><td>${esc(b.spread_eurusd ?? '—')} pips</td><td>${esc(b.min_deposit ?? '—')}</td></tr>`
  ).join('')}</tbody></table></div></section>`;
}

function rankingSection(ranked, doc) {
  if (!ranked.length) return '';
  const label = String(doc.slug || '').replaceAll('-', ' ');
  return `<section class="piprank-prerender-ranking"><h2>Best forex brokers for ${esc(label)}</h2><ol>${ranked.map((b, i) =>
    `<li><strong>#${i + 1} <a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a></strong> — PipRank score ${score(b)}/100. ${esc(b.tagline || '')}</li>`
  ).join('')}</ol></section>`;
}

function detailSection(ranked, doc) {
  if (!ranked.length) return '';
  return `<section class="piprank-prerender-analysis"><h2>Detailed broker analysis</h2>${ranked.map((b, i) =>
    `<article id="bestfor-${esc(b.slug)}"><h3>${i + 1}. ${esc(b.name)}</h3><p>${esc(b.tagline || '')}</p><ul><li>PipRank score: ${score(b)}/100</li><li>Rating: ${esc(b.rating ?? '—')}/5</li><li>Trust score: ${esc(b.trust_score ?? '—')}/100</li><li>EUR/USD spread: ${esc(b.spread_eurusd ?? '—')} pips</li><li>Minimum deposit: ${esc(b.min_deposit ?? '—')}</li><li>Platforms: ${esc((b.platforms || []).join(', ') || '—')}</li></ul><p><a href="/brokers/${esc(b.slug)}">Read the full ${esc(b.name)} review</a></p></article>`
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
  const [docsRes, brokersRes, countriesRes] = await Promise.all([
    supabase.from('content_documents').select('id,content_type,country_slug,slug,settings,published,indexable').in('content_type', ['global-best-for', 'country-best-for', 'localized-best-for']).eq('published', true).eq('indexable', true),
    supabase.from('brokers').select('id,name,slug,tagline,rating,trust_score,min_deposit,spread_eurusd,platforms,best_for'),
    supabase.from('countries').select('slug,recommended,publishing_state').eq('publishing_state', 'published'),
  ]);
  if (docsRes.error) throw docsRes.error;
  if (brokersRes.error) throw brokersRes.error;
  if (countriesRes.error) throw countriesRes.error;

  const countries = new Map((countriesRes.data || []).map((country) => [
    country.slug,
    new Set((Array.isArray(country.recommended) ? country.recommended : [])
      .map((item) => typeof item === 'string' ? item : item?.slug)
      .filter(Boolean))
  ]));

  let enriched = 0;
  for (const doc of docsRes.data || []) {
    const path = canonicalPath(doc);
    if (!path) continue;
    const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path.replace(/^\//, ''), 'index.html');
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    const ranked = rankBrokers(brokersRes.data || [], doc, countries.get(doc.country_slug));
    const extra = `${rankingSection(ranked, doc)}${comparisonTable(ranked)}${detailSection(ranked, doc)}${criteriaSection(doc)}${faqSection(doc)}`;
    const output = inject(html, extra);
    if (output !== html) {
      writeFileSync(file, output, 'utf8');
      enriched++;
    }
  }
  console.log(`[bestfor-prerender] Enriched ${enriched} canonical Best-For prerenders.`);
}

main().catch((error) => { console.error('[bestfor-prerender] FATAL:', error); process.exitCode = 1; });
