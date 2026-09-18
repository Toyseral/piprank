import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';
import { sanitizeBlocks, sanitizeHtml, sanitizePublicSettings } from '../api/_lib/content-sanitizer.js';


const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE_NAME = 'PipRank';
const ORIGIN = requireSiteUrlForProduction();
const absolute = (path) => `${ORIGIN}${path === '/' ? '' : path}`;
const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function log(message) { console.log(`[prerender] ${message}`); }
function warn(message) { console.warn(`[prerender] WARNING: ${message}`); }

function pageJsonLd(title, description, path, type = 'WebPage', author = null) {
  return { '@context': 'https://schema.org', '@type': type, name: title, description, url: absolute(path), ...(author ? { author } : {}) };
}
function breadcrumbJsonLd(items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absolute(item.path) })) };
}
function faqJsonLd(faqs) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
}

// Content Studio data is treated as untrusted at this boundary even though
// the write API sanitizes it. This protects builds from pre-existing rows,
// direct database writes, migrations, and future code paths that bypass the API.
function normalizePublicDocument(doc) {
  const settings = sanitizePublicSettings(doc?.settings);
  return {
    ...doc,
    title: String(doc?.title ?? '').slice(0, 500),
    excerpt: String(doc?.excerpt ?? '').slice(0, 5000),
    seo_title: String(doc?.seo_title ?? '').slice(0, 500),
    seo_description: String(doc?.seo_description ?? '').slice(0, 5000),
    html: sanitizeHtml(doc?.html || ''),
    blocks: sanitizeBlocks(doc?.blocks),
    settings,
  };
}

function renderBlock(block, brokersById) {
  if (!block || typeof block !== 'object') return '';
  if (block.type === 'heading') return `<h2>${esc(block.title || 'Section')}</h2>`;
  if (block.type === 'richtext') return block.html || '';
  if (block.type === 'image') return `<figure><img src="${esc(block.src || '')}" alt="${esc(block.alt || '')}" loading="lazy"><figcaption>${esc(block.alt || '')}</figcaption></figure>`;
  if (block.type === 'divider') return '<hr>';
  if (block.type === 'callout') return `<aside class="piprank-callout">${block.html || ''}</aside>`;
  if (block.type === 'piprank_verdict') return `<section><h2>${esc(block.title || 'PipRank verdict')}</h2>${block.html || ''}</section>`;
  if (block.type === 'links') return `<nav class="piprank-internal-links"><ul>${(block.links || []).map((x) => `<li><a href="${esc(x.href)}">${esc(x.label)}</a></li>`).join('')}</ul></nav>`;
  if (block.type === 'table') {
    const rows = block.rows || [['Feature', 'Details']];
    return `<div class="overflow-x-auto"><table><thead><tr>${(rows[0] || []).map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((row) => `<tr>${row.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if (block.type === 'broker_card') {
    const broker = brokersById.get(Number(block.brokerId));
    if (!broker) return '';
    return `<article><h3><a href="/brokers/${esc(broker.slug)}">${esc(broker.name)}</a></h3><p>${esc(broker.tagline || '')}</p><p>Rating: ${esc(broker.rating ?? '—')} / 5 · Trust: ${esc(broker.trust_score ?? '—')} / 100</p><a href="/brokers/${esc(broker.slug)}">Read broker review</a></article>`;
  }
  if (block.type === 'broker_grid') {
    return `<section class="grid">${(block.brokerIds || []).map((id) => renderBlock({ type: 'broker_card', brokerId: id }, brokersById)).join('')}</section>`;
  }
  if (block.type === 'comparison_table') {
    const brokers = (block.brokerIds || []).map((id) => brokersById.get(Number(id))).filter(Boolean);
    const fields = block.fields?.length ? block.fields : ['rating', 'trust_score', 'min_deposit', 'spread_eurusd'];
    const value = (broker, field) => ({
      rating: `${broker.rating ?? '—'}/5`, trust_score: `${broker.trust_score ?? '—'}/100`,
      min_deposit: broker.min_deposit ?? '—', spread_eurusd: broker.spread_eurusd == null ? '—' : `${broker.spread_eurusd} pips`,
      commission: broker.commission || '—', max_leverage: broker.max_leverage || '—', platforms: (broker.platforms || []).join(', ') || '—',
    }[field] ?? '—');
    return `<section><h3>${esc(block.title || 'Broker comparison')}</h3><div class="overflow-x-auto"><table><thead><tr><th>Feature</th>${brokers.map((broker) => `<th>${esc(broker.name)}</th>`).join('')}</tr></thead><tbody>${fields.map((field) => `<tr><th>${esc(String(field).replaceAll('_', ' '))}</th>${brokers.map((broker) => `<td>${esc(value(broker, field))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }
  if (block.type === 'broker_cta') {
    const broker = brokersById.get(Number(block.brokerId));
    if (!broker) return '';
    const href = `/go/${encodeURIComponent(broker.slug)}`;
    return `<section><h3>${esc(block.title || `Consider ${broker.name}`)}</h3><p>${esc(broker.tagline || '')}</p><a href="${href}">${esc(block.buttonLabel || `View ${broker.name}`)}</a></section>`;
  }
  return '';
}

const AUTHOR_FALLBACKS = {
  'r-adeyemi': { penName: 'R. Adeyemi', role: 'Lead Broker Reviewer', bio: 'Leads broker onboarding at PipRank: verifying licence status against regulator registers, identifying the specific legal entity behind each account, and writing the regulation sections of our reviews.' },
  'j-okafor': { penName: 'J. Okafor', role: 'Trading Costs & Execution Editor', bio: 'Runs the real-money testing process behind every spread, execution-speed and withdrawal-timing figure published on PipRank, and maintains the trading-cost sections of broker reviews.' },
  'l-mensah': { penName: 'L. Mensah', role: 'Data & Methodology Lead', bio: 'Maintains the Health Score methodology and the data pipeline behind it — refresh cadence, factor weighting, and keeping scores consistent as broker conditions change.' },
  's-nwachukwu': { penName: 'S. Nwachukwu', role: 'Country & Compliance Editor', bio: 'Covers country-level broker availability, local regulatory context, and the country-specific guides published on PipRank.' },
};
function deterministicReviewer(fallbackKey) {
  let hash = 0;
  const value = String(fallbackKey || '');
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return ['r-adeyemi', 'j-okafor', 'l-mensah', 's-nwachukwu'][hash % 4];
}

function reviewerForDocument(doc, authorsByKey, fallbackKey) {
  const settings = doc?.settings || {};
  const slug = String(settings.reviewed_by_slug || settings.author_slug || '').trim().toLowerCase();
  const fallbackSlug = fallbackKey ? deterministicReviewer(fallbackKey) : null;
  const fallbackMeta = fallbackSlug ? AUTHOR_FALLBACKS[fallbackSlug] : null;
  const fallback = fallbackSlug && fallbackMeta ? { slug: fallbackSlug, title: fallbackMeta.penName, settings: { role: fallbackMeta.role, short_bio: fallbackMeta.bio } } : null;
  const author = slug ? authorsByKey.get(`author:${slug}`) : null;
  return author || (fallback ? { slug: fallback.slug, title: fallback.penName, settings: { role: fallback.role, short_bio: fallback.bio } } : null);
}

function attributionHtml(author, label = 'Written & reviewed by') {
  if (!author) return '';
  const settings = author.settings || {};
  const slug = String(author.slug || '').trim();
  return `<aside class="piprank-attribution"><strong>${esc(label)} ${esc(author.title || '')}</strong>${settings.role ? `<span> · ${esc(settings.role)}</span>` : ''}${settings.short_bio ? `<p>${esc(settings.short_bio)}</p>` : ''}${slug ? `<a href="/authors#${encodeURIComponent(slug)}">View author profile</a>` : ''}</aside>`;
}

function reviewerJsonLd(author) {
  if (!author) return null;
  const settings = author.settings || {};
  const slug = String(author.slug || '').trim();
  return { '@type': 'Person', name: author.title || '', ...(settings.role ? { jobTitle: settings.role } : {}), ...(slug ? { url: absolute(`/authors#${encodeURIComponent(slug)}`) } : {}), ...(settings.photo_url ? { image: settings.photo_url } : {}) };
}

function renderDocument(doc, brokersById) {
  const blocks = Array.isArray(doc.blocks) ? doc.blocks.map((block) => renderBlock(block, brokersById)).join('\n') : '';
  return blocks || doc.html || '';
}

function replaceMeta(html, meta) {
  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${esc(meta.description)}">`)
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:title["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:description["'][^>]*>/gi, '');
  if (!/<title>[\s\S]*?<\/title>/i.test(output)) output = output.replace('</head>', `<title>${esc(meta.title)}</title></head>`);
  if (!/<meta\s+name=["']description["']/i.test(output)) output = output.replace('</head>', `<meta name="description" content="${esc(meta.description)}"></head>`);
  return output;
}

function writePage(shell, writtenPaths, path, meta, content, jsonLd = []) {
  if (writtenPaths.has(path)) return false;
  const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  const json = jsonLd.map((item) => `<script type="application/ld+json">${JSON.stringify(item).replace(/</g, '\\u003c')}</script>`).join('');
  const html = replaceMeta(shell, meta)
    .replace('</head>', `<link rel="canonical" href="${absolute(path)}"><meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(meta.description)}">${json}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  writeFileSync(file, html, 'utf8');
  writtenPaths.add(path);
  return true;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for prerendering.');
    warn('Supabase credentials unavailable; skipping canonical prerender outside production.');
    return;
  }
  if (!existsSync(DIST)) throw new Error('dist/ does not exist. Run vite build first.');

  const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
  const supabase = createClient(url, key);
  const [brokersRes, countriesRes, docsRes, authorsRes] = await Promise.all([
    supabase.from('brokers').select('id,name,slug,tagline,rating,trust_score,min_deposit,spread_eurusd,max_leverage,platforms,regulations,commission,website'),
    supabase.from('countries').select('id,slug,name,recommended,intro,publishing_state').eq('publishing_state', 'published'),
    supabase.from('content_documents').select('id,content_key,content_type,country_slug,topic_slug,slug,title,excerpt,html,blocks,settings,seo_title,seo_description,indexable,published,updated_at').in('content_type', ['guide', 'global-best-for', 'country-guide', 'country-best-for', 'localized-guide', 'localized-best-for', 'broker', 'country']).eq('published', true).eq('indexable', true),
    supabase.from('content_documents').select('id,content_key,content_type,slug,title,excerpt,settings').eq('content_type', 'author').eq('published', true),
  ]);
  if (brokersRes.error) throw brokersRes.error;
  if (countriesRes.error) throw countriesRes.error;
  if (docsRes.error) throw docsRes.error;
  if (authorsRes.error) throw authorsRes.error;

  const brokers = brokersRes.data || [];
  const countries = countriesRes.data || [];
  const docs = docsRes.data || [];
  const authorsByKey = new Map((authorsRes.data || []).map((author) => [author.content_key, normalizePublicDocument(author)]));
  const brokersById = new Map(brokers.map((broker) => [Number(broker.id), broker]));
  const countriesBySlug = new Map(countries.map((country) => [country.slug, country]));
  const publicDocs = docs.map(normalizePublicDocument);
  const writtenPaths = new Set();
  let written = 0;

  const guides = publicDocs.filter((doc) => doc.content_type === 'guide' && !doc.country_slug && doc.slug);
  const globalBestFors = publicDocs.filter((doc) => doc.content_type === 'global-best-for' && doc.slug);
  const countryGuides = publicDocs.filter((doc) => doc.content_type === 'country-guide' && doc.country_slug && doc.slug);
  const countryBestFors = publicDocs.filter((doc) => doc.content_type === 'country-best-for' && doc.country_slug && doc.slug);
  const localizedGuides = publicDocs.filter((doc) => doc.content_type === 'localized-guide' && doc.country_slug && doc.slug && ((doc.settings || {}).locale || (doc.settings || {}).languageCode));
  const localizedBestFors = publicDocs.filter((doc) => doc.content_type === 'localized-best-for' && doc.country_slug && doc.slug && ((doc.settings || {}).locale || (doc.settings || {}).languageCode));

  const sortedBrokers = [...brokers].filter((broker) => broker.slug).sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  const homeContent = `<main><h1>Best Forex Brokers ${new Date().getFullYear()}</h1><p>Compare forex brokers using PipRank data on regulation, trading costs, platforms, execution and account features.</p><h2>Top forex brokers</h2><ol>${sortedBrokers.slice(0, 10).map((broker) => `<li><a href="/brokers/${esc(broker.slug)}">${esc(broker.name)}</a></li>`).join('')}</ol><p><a href="/countries">Find brokers by country</a> · <a href="/guides">Read forex guides</a></p></main>`;
  if (writePage(shell, writtenPaths, '/', { title: `PipRank — Best Forex Brokers ${new Date().getFullYear()}`, description: 'Compare forex brokers by regulation, trading costs, platforms, execution and account features.' }, homeContent, [pageJsonLd(`PipRank — Best Forex Brokers ${new Date().getFullYear()}`, 'Compare forex brokers by regulation, trading costs, platforms, execution and account features.', '/')])) written++;

  const brokerIndex = `<main><h1>Best Forex Brokers</h1><ol>${sortedBrokers.map((broker) => `<li><a href="/brokers/${esc(broker.slug)}">${esc(broker.name)}</a> — ${esc(broker.tagline || '')}</li>`).join('')}</ol></main>`;
  if (writePage(shell, writtenPaths, '/brokers', { title: `Best Forex Brokers | ${SITE_NAME}`, description: 'Compare forex brokers by regulation, trading costs, platforms and account features.' }, brokerIndex, [pageJsonLd('Best Forex Brokers', 'Compare forex brokers.', '/brokers'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Brokers', path: '/brokers' }])])) written++;

  for (const broker of sortedBrokers) {
    const path = `/brokers/${broker.slug}`;
    const title = `${broker.name} Review ${new Date().getFullYear()} | ${SITE_NAME}`;
    const description = `${broker.name} review covering regulation, trading costs, platforms, minimum deposit and key account features.`;
    const content = `<main><nav><a href="/">Home</a> › <a href="/brokers">Brokers</a> › <span>${esc(broker.name)}</span></nav><h1>${esc(broker.name)} Review</h1><p>${esc(broker.tagline || '')}</p><ul><li>Rating: ${esc(broker.rating ?? '—')} / 5</li><li>Trust score: ${esc(broker.trust_score ?? '—')} / 100</li><li>Minimum deposit: ${esc(broker.min_deposit ?? '—')}</li><li>EUR/USD spread: ${esc(broker.spread_eurusd ?? '—')}</li><li>Max leverage: ${esc(broker.max_leverage ?? '—')}</li><li>Platforms: ${esc((broker.platforms || []).join(', ') || '—')}</li></ul><h2>Regulation and safety</h2><p>${esc((broker.regulations || []).map((regulation) => regulation.body).filter(Boolean).join(' · ') || 'Regulatory information is not confirmed in the current dataset.')}</p><p><a href="/brokers">Compare all brokers</a></p></main>`;
    if (writePage(shell, writtenPaths, path, { title, description }, content, [pageJsonLd(title, description, path, 'Article'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Brokers', path: '/brokers' }, { name: broker.name, path }])])) written++;
  }

  for (const country of countries.filter((item) => item.slug)) {
    const recommended = Array.isArray(country.recommended) ? country.recommended.map((item) => typeof item === 'string' ? item : item?.slug).filter(Boolean) : [];
    const countryBrokers = sortedBrokers.filter((broker) => recommended.includes(broker.slug));
    const path = `/${country.slug}`;
    const title = `Best Forex Brokers in ${country.name} | ${SITE_NAME}`;
    const description = `Compare forex brokers available to traders in ${country.name}, including regulation, costs, platforms and account features.`;
    const content = `<main><h1>Best Forex Brokers in ${esc(country.name)}</h1><p>${esc(country.intro || description)}</p><h2>Recommended forex brokers</h2><ol>${countryBrokers.slice(0, 10).map((broker) => `<li><a href="/brokers/${esc(broker.slug)}">${esc(broker.name)}</a> — ${esc(broker.tagline || '')}</li>`).join('')}</ol><h2>Country guides</h2><ul>${countryGuides.filter((doc) => doc.country_slug === country.slug).map((doc) => `<li><a href="/${esc(country.slug)}/guides/${esc(doc.slug)}">${esc(doc.title)}</a></li>`).join('')}</ul><p><a href="/countries">Browse all countries</a></p></main>`;
    if (writePage(shell, writtenPaths, path, { title, description }, content, [pageJsonLd(title, description, path), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: country.name, path }])])) written++;
  }

  for (const doc of guides) {
    const path = `/guides/${doc.slug}`;
    const title = doc.seo_title || `${doc.title} | ${SITE_NAME} Guides`;
    const description = doc.seo_description || doc.excerpt || '';
    const faqs = Array.isArray(doc.settings?.faqs) ? doc.settings.faqs : [];
    const author = reviewerForDocument(doc, authorsByKey, `${doc.country_slug ?? ''}-guide-${doc.slug}`);
    const content = `<main><nav><a href="/">Home</a> › <a href="/guides">Guides</a> › <span>${esc(doc.title)}</span></nav><h1>${esc(doc.title)}</h1>${doc.excerpt ? `<p>${esc(doc.excerpt)}</p>` : ''}${attributionHtml(author)}${renderDocument(doc, brokersById)}${faqs.length ? `<h2>Frequently Asked Questions</h2>${faqs.map((faq) => `<details><summary>${esc(faq.q)}</summary><p>${esc(faq.a)}</p></details>`).join('')}` : ''}</main>`;
    if (writePage(shell, writtenPaths, path, { title, description }, content, [pageJsonLd(title, description, path, 'Article', reviewerJsonLd(author)), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }, { name: doc.title, path }]), ...(faqs.length ? [faqJsonLd(faqs)] : [])])) written++;
  }

  for (const doc of globalBestFors) {
    const author = reviewerForDocument(doc, authorsByKey, `best-for-${doc.country_slug ?? 'global'}-${doc.slug}-${doc.settings?.locale || doc.settings?.languageCode || ''}`);
    const path = `/${doc.slug}`;
    const title = doc.seo_title || `${doc.title} | ${SITE_NAME}`;
    const description = doc.seo_description || doc.excerpt || '';
    const faqs = Array.isArray(doc.settings?.faqs) ? doc.settings.faqs : [];
    const content = `<main><h1>${esc(doc.title)}</h1>${doc.excerpt ? `<p>${esc(doc.excerpt)}</p>` : ''}${attributionHtml(author)}${renderDocument(doc, brokersById)}${faqs.length ? `<h2>Frequently Asked Questions</h2>${faqs.map((faq) => `<details><summary>${esc(faq.q)}</summary><p>${esc(faq.a)}</p></details>`).join('')}` : ''}</main>`;
    if (writePage(shell, writtenPaths, path, { title, description }, content, [pageJsonLd(title, description, path, 'Article', reviewerJsonLd(author)), ...(faqs.length ? [faqJsonLd(faqs)] : [])])) written++;
  }

  for (const doc of countryGuides) {
    const author = reviewerForDocument(doc, authorsByKey, `${doc.country_slug ?? ''}-guide-${doc.slug}`);
    if (!countriesBySlug.has(doc.country_slug)) continue;
    const path = `/${doc.country_slug}/guides/${doc.slug}`;
    const title = doc.seo_title || `${doc.title} | ${SITE_NAME}`;
    const description = doc.seo_description || doc.excerpt || '';
    const faqs = Array.isArray(doc.settings?.faqs) ? doc.settings.faqs : [];
    const countryName = countriesBySlug.get(doc.country_slug)?.name || doc.country_slug;
    const content = `<main><h1>${esc(doc.title)}</h1>${doc.excerpt ? `<p>${esc(doc.excerpt)}</p>` : ''}${attributionHtml(author)}${renderDocument(doc, brokersById)}${faqs.length ? `<h2>Frequently Asked Questions</h2>${faqs.map((faq) => `<details><summary>${esc(faq.q)}</summary><p>${esc(faq.a)}</p></details>`).join('')}` : ''}<p><a href="/${esc(doc.country_slug)}">Compare brokers in ${esc(countryName)}</a></p></main>`;
    if (writePage(shell, writtenPaths, path, { title, description }, content, [pageJsonLd(title, description, path, 'Article', reviewerJsonLd(author)), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: countryName, path: `/${doc.country_slug}` }, { name: doc.title, path }]), ...(faqs.length ? [faqJsonLd(faqs)] : [])])) written++;
  }

  for (const doc of countryBestFors) {
    const author = reviewerForDocument(doc, authorsByKey, `best-for-${doc.country_slug ?? 'global'}-${doc.slug}-${doc.settings?.locale || doc.settings?.languageCode || ''}`);
    if (!countriesBySlug.has(doc.country_slug)) continue;
    const path = `/${doc.country_slug}/${doc.slug}`;
    const title = doc.seo_title || `${doc.title} | ${SITE_NAME}`;
    const description = doc.seo_description || doc.excerpt || '';
    const faqs = Array.isArray(doc.settings?.faqs) ? doc.settings.faqs : [];
    const countryName = countriesBySlug.get(doc.country_slug)?.name || doc.country_slug;
    const content = `<main><h1>${esc(doc.title)}</h1>${doc.excerpt ? `<p>${esc(doc.excerpt)}</p>` : ''}${attributionHtml(author)}${renderDocument(doc, brokersById)}${faqs.length ? `<h2>Frequently Asked Questions</h2>${faqs.map((faq) => `<details><summary>${esc(faq.q)}</summary><p>${esc(faq.a)}</p></details>`).join('')}` : ''}</main>`;
    if (writePage(shell, writtenPaths, path, { title, description }, content, [pageJsonLd(title, description, path, 'Article', reviewerJsonLd(author)), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: countryName, path: `/${doc.country_slug}` }, { name: doc.title, path }]), ...(faqs.length ? [faqJsonLd(faqs)] : [])])) written++;
  }

  for (const doc of localizedGuides) {
    const author = reviewerForDocument(doc, authorsByKey, `${doc.country_slug ?? ''}-guide-${doc.slug}`);
    const locale = String(doc.settings?.locale || doc.settings?.languageCode || '').trim();
    if (!locale || !countriesBySlug.has(doc.country_slug)) continue;
    const path = `/${doc.country_slug}/${encodeURIComponent(locale)}/guides/${doc.slug}`;
    const title = doc.seo_title || doc.title;
    const description = doc.seo_description || doc.excerpt || '';
    const content = `<main><h1>${esc(doc.title)}</h1>${doc.excerpt ? `<p>${esc(doc.excerpt)}</p>` : ''}${attributionHtml(author)}${renderDocument(doc, brokersById)}</main>`;
    if (writePage(shell, writtenPaths, path, { title, description }, content, [pageJsonLd(title, description, path, 'Article', reviewerJsonLd(author))])) written++;
  }

  for (const doc of localizedBestFors) {
    const author = reviewerForDocument(doc, authorsByKey, `best-for-${doc.country_slug ?? 'global'}-${doc.slug}-${doc.settings?.locale || doc.settings?.languageCode || ''}`);
    const locale = String(doc.settings?.locale || doc.settings?.languageCode || '').trim();
    if (!locale || !countriesBySlug.has(doc.country_slug)) continue;
    const path = `/${doc.country_slug}/${encodeURIComponent(locale)}/${doc.slug}`;
    const title = doc.seo_title || doc.title;
    const description = doc.seo_description || doc.excerpt || '';
    const faqs = Array.isArray(doc.settings?.faqs) ? doc.settings.faqs : [];
    const countryName = countriesBySlug.get(doc.country_slug)?.name || doc.country_slug;
    const content = `<main><h1>${esc(doc.title)}</h1>${doc.excerpt ? `<p>${esc(doc.excerpt)}</p>` : ''}${attributionHtml(author)}${renderDocument(doc, brokersById)}${faqs.length ? `<h2>Frequently Asked Questions</h2>${faqs.map((faq) => `<details><summary>${esc(faq.q)}</summary><p>${esc(faq.a)}</p></details>`).join('')}` : ''}</main>`;
    if (writePage(shell, writtenPaths, path, { title, description }, content, [pageJsonLd(title, description, path, 'Article', reviewerJsonLd(author)), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: countryName, path: `/${doc.country_slug}` }, { name: doc.title, path }]), ...(faqs.length ? [faqJsonLd(faqs)] : [])])) written++;
  }

  log(`Canonical prerender complete: ${written} pages from ${publicDocs.length} published, indexable content documents.`);
}

main().catch((error) => { console.error('[prerender] FATAL:', error); process.exitCode = 1; });
