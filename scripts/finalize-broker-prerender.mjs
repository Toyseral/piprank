import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSiteUrlForProduction } from './seo-config.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const ORIGIN = requireSiteUrlForProduction();
const SITE_NAME = 'PipRank';
const YEAR = new Date().getFullYear();
const absolute = (path) => `${ORIGIN}${path === '/' ? '' : path}`;
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function brokerSeo(broker) {
  const title = `${broker.name} Review ${YEAR}: Spreads, Fees & Verdict | ${SITE_NAME}`;
  const description = broker.tagline && broker.tagline !== 'New broker under review'
    ? `${broker.name} review: ${broker.tagline} Real-money tested spreads, leverage, fees and withdrawal times — see if ${broker.name} is right for you.`
    : `In-depth ${broker.name} review: real-money tested spreads from ${broker.spread_eurusd ?? '—'} pips, minimum deposit, leverage up to ${broker.max_leverage ?? '—'}, and verified fees. Independently scored by ${SITE_NAME}.`;
  return { title, description, path: `/brokers/${broker.slug}` };
}

function jsonLd(data) { return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`; }
function faqSchema(faqs) { return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((faq) => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } })) }; }
function articleSchema(seo) { return { '@context': 'https://schema.org', '@type': 'Article', name: seo.title, headline: seo.title, description: seo.description, url: absolute(seo.path), isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: ORIGIN } }; }
function breadcrumbSchema(broker) { return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: absolute('/') }, { '@type': 'ListItem', position: 2, name: 'Forex Brokers', item: absolute('/brokers') }, { '@type': 'ListItem', position: 3, name: broker.name, item: absolute(`/brokers/${broker.slug}`) }] }; }
function paragraphs(items) { return (Array.isArray(items) ? items : []).filter(Boolean).map((text) => `<p>${esc(text)}</p>`).join(''); }

function brokerContentHtml(broker, content, faqs) {
  const overview = content?.overview?.length ? content.overview : [broker.tagline].filter(Boolean);
  const sections = [
    overview.length ? `<section><h2>${esc(broker.name)} at a glance</h2>${paragraphs(overview)}</section>` : '',
    content?.verdict?.length ? `<section><h2>PipRank verdict</h2>${paragraphs(content.verdict)}</section>` : '',
    content?.fees_detail?.length ? `<section><h2>Fees & commissions</h2>${paragraphs(content.fees_detail)}</section>` : '',
    content?.platform_intro?.length ? `<section><h2>Trading platforms</h2>${paragraphs(content.platform_intro)}</section>` : '',
    content?.regulation_detail?.length ? `<section><h2>Trust & regulation</h2>${paragraphs(content.regulation_detail)}</section>` : '',
    content?.accounts_intro?.length ? `<section><h2>Account types</h2>${paragraphs(content.accounts_intro)}</section>` : '',
    content?.funding_intro?.length ? `<section><h2>Deposits & withdrawals</h2>${paragraphs(content.funding_intro)}</section>` : '',
    faqs.length ? `<section><h2>${esc(broker.name)} frequently asked questions</h2>${faqs.map((faq) => `<h3>${esc(faq.q)}</h3><p>${esc(faq.a)}</p>`).join('')}</section>` : '',
  ].filter(Boolean);
  return `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/brokers">Forex Brokers</a> › <span>${esc(broker.name)}</span></nav><h1>${esc(broker.name)}</h1><p>${esc(broker.tagline || '')}</p><ul><li>Minimum deposit: ${esc(broker.min_deposit ?? '—')}</li><li>EUR/USD spread: ${esc(broker.spread_eurusd ?? '—')}</li><li>Maximum leverage: ${esc(broker.max_leverage ?? '—')}</li><li>Platforms: ${esc((broker.platforms || []).join(', ') || '—')}</li></ul>${sections.join('')}<p><a href="/go/${encodeURIComponent(broker.slug)}">Open ${esc(broker.name)} Account</a></p></main>`;
}

function replaceRootContent(html, content) {
  const start = html.indexOf('<div id="root">');
  if (start < 0) return html;
  const contentStart = start + '<div id="root">'.length;
  const end = html.lastIndexOf('</div>');
  if (end < contentStart) return html;
  return `${html.slice(0, contentStart)}${content}${html.slice(end)}`;
}

function replaceHead(html, seo, schemas) {
  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seo.title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, `<meta name="description" content="${esc(seo.description)}">`)
    .replace(/<meta\s+name=["']robots["'][^>]*>/gi, '<meta name="robots" content="index, follow, max-image-preview:large">')
    .replace(/<meta\s+property=["']og:title["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:description["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["']og:url["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:card["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:title["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:description["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
  const head = `<link rel="canonical" href="${absolute(seo.path)}"><meta property="og:title" content="${esc(seo.title)}"><meta property="og:description" content="${esc(seo.description)}"><meta property="og:type" content="article"><meta property="og:url" content="${absolute(seo.path)}"><meta property="og:site_name" content="${SITE_NAME}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(seo.title)}"><meta name="twitter:description" content="${esc(seo.description)}">${schemas.join('')}`;
  return output.replace('</head>', `${head}</head>`);
}

async function main() {
  if (!existsSync(DIST)) throw new Error('dist/ does not exist. Run vite build first.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('Supabase credentials are required for broker prerender finalization.');
    console.warn('[prerender] Supabase credentials unavailable; skipping broker SEO finalization outside production.');
    return;
  }
  const supabase = createClient(url, key);
  const [{ data: brokers, error: brokerError }, { data: brokerContents, error: contentError }] = await Promise.all([
    supabase.from('brokers').select('id,name,slug,tagline,min_deposit,spread_eurusd,max_leverage,platforms').not('slug', 'is', null),
    supabase.from('broker_content').select('broker_id,overview,verdict,fees_detail,platform_intro,regulation_detail,accounts_intro,funding_intro,faqs'),
  ]);
  if (brokerError) throw brokerError;
  if (contentError) throw contentError;
  const contentByBroker = new Map((brokerContents || []).map((row) => [Number(row.broker_id), row]));
  let finalized = 0;
  for (const broker of brokers || []) {
    const path = `/brokers/${broker.slug}`;
    const file = join(DIST, path.replace(/^\//, ''), 'index.html');
    if (!existsSync(file)) continue;
    const content = contentByBroker.get(Number(broker.id)) || null;
    const faqs = Array.isArray(content?.faqs) ? content.faqs.filter((faq) => faq?.q && faq?.a) : [];
    const seo = brokerSeo(broker);
    const html = readFileSync(file, 'utf8');
    const schemas = [articleSchema(seo), breadcrumbSchema(broker), ...(faqs.length ? [faqSchema(faqs)] : [])].map(jsonLd);
    const withHead = replaceHead(html, seo, schemas);
    const finalHtml = replaceRootContent(withHead, brokerContentHtml(broker, content, faqs));
    writeFileSync(file, finalHtml, 'utf8');
    finalized++;
  }
  console.log(`[prerender] finalized ${finalized} broker pages`);
}

main().catch((error) => { console.error('[prerender] broker finalization failed:', error); process.exit(1); });
