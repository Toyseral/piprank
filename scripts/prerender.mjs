// scripts/prerender.mjs
//
// Runs after `vite build`. Fetches real data directly from Supabase (using
// the same service-role credentials the API functions use, available as
// build-time env vars on Vercel) and writes a genuine static HTML file for
// every broker, country, guide, and curated compare-pair URL.
//
// Each generated file is the same compiled index.html shell (so the SPA JS
// bundle still loads and the page becomes fully interactive after paint),
// but with:
//   - a unique <title>, meta description, canonical, OG/Twitter tags
//   - JSON-LD (WebPage/Article + BreadcrumbList, matching src/lib/seo.ts)
//   - a real, crawlable content snapshot injected into #root — actual
//     headings, body text and <a href> links, present in the raw HTML
//     response before any JavaScript executes.
//
// This is intentionally NOT full SSR (there is no per-request server
// render). It is static prerendering at build time, which is what the
// project brief calls out explicitly as an acceptable outcome for a page
// like this, and it is compatible with the existing Vercel static+rewrite
// deployment without introducing a new serverless function (the Hobby plan
// is already at its 11/12 function ceiling).
//
// Non-fatal by design: if Supabase is unreachable at build time (e.g. a
// transient network issue), this script logs a clear warning and exits 0
// rather than failing the whole deployment — the site still works exactly
// as it does today (pure client-side rendering) as a fallback.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { requireSiteUrlForProduction } from './seo-config.mjs';
import { fileURLToPath } from 'node:url';
import { blocksToHtmlServer } from './render-blocks.mjs';
import { countrySeoTopics, rankCountryTopicBrokers, topicMeta, topicIntro, topicFaq, topicNote } from './country-seo-topics.mjs';
import { vietnameseCommercialTopics } from './vietnamese-localization.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Localization helpers (keep in sync with src/lib/localization.ts + src/lib/geo.ts)
const COUNTRY_ISO2 = {
  uk: 'GB', us: 'US', australia: 'AU', india: 'IN', singapore: 'SG', uae: 'AE',
  germany: 'DE', 'south-africa': 'ZA', nigeria: 'NG', malaysia: 'MY', ghana: 'GH',
  bahrain: 'BH', jordan: 'JO', brazil: 'BR', switzerland: 'CH', 'hong-kong': 'HK',
  thailand: 'TH', vietnam: 'VN', turkey: 'TR', kuwait: 'KW', lebanon: 'LB',
  oman: 'OM', qatar: 'QA', 'saudi-arabia': 'SA', 'south-korea': 'KR', indonesia: 'ID',
};
function englishSlugForTopicKey(topicKey) {
  if (!topicKey || topicKey === 'all') return null;
  const topic = countrySeoTopics.find((t) => t.key === topicKey);
  return topic?.slug ?? null;
}
function englishAlternatePath(countrySlug, topicKey) {
  const topicSlug = englishSlugForTopicKey(topicKey);
  return topicSlug ? `/${countrySlug}/${topicSlug}` : `/${countrySlug}`;
}
function englishHreflangForCountry(countrySlug) {
  const iso = COUNTRY_ISO2[countrySlug];
  return iso ? `en-${iso}` : 'en';
}

const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const SITE_NAME = 'PipRank';
const PRODUCTION_ORIGIN = requireSiteUrlForProduction();
const absoluteUrl = (path) => `${PRODUCTION_ORIGIN}${path === '/' ? '' : path}`;
const DEFAULT_OG_IMAGE = '/images/hero-terminal.png';

// Cap on how many broker pairs get a prerendered /compare/x-vs-y page.
// Combinations grow quadratically — with ~32 brokers that's 496 possible
// pairs, most of which nobody will ever search for. We only pre-generate
// pairs among the top-rated brokers; ComparePair.tsx itself still works for
// any pair at runtime (client-rendered), this just controls what gets a
// static, crawlable, sitemap-listed page.
const MAX_BROKERS_FOR_PAIRS = 12;

function log(msg) {
  console.log(`[prerender] ${msg}`);
}

function warn(msg) {
  console.warn(`[prerender] WARNING: ${msg}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const message = 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for a production SEO build.';
    if (process.env.VERCEL_ENV === 'production') throw new Error(message);
    warn(`${message} Skipping prerender for non-production build.`);
    return;
  }

  if (!existsSync(DIST)) {
    warn('dist/ not found — run `vite build` before this script. Skipping prerender.');
    return;
  }

  const shell = readFileSync(join(DIST, 'index.html'), 'utf-8');
  const supabase = createClient(url, key);

  let brokers = [];
  let countries = [];
  let guides = [];
  let countryBestFors = [];
  let intents = [];
  let reviews = [];
  let brokerContents = [];
  let contentDocs = [];
  let localizedSeoPages = [];

  try {
    const [{ data: b, error: be }, { data: c, error: ce }, { data: g, error: ge }, { data: i, error: ie }, { data: cbf, error: cbfe }, { data: rv, error: rve }, { data: lsp, error: lspe }] = await Promise.all([
      supabase.from('brokers').select('*'),
      supabase.from('countries').select('*'),
      supabase.from('guides').select('*'),
      supabase.from('intents').select('*').order('id', { ascending: true }),
      supabase.from('country_best_for').select('*, countries!inner(name, slug)').eq('indexable', true),
      supabase.from('reviews').select('broker_id, rating, verified, created_at'),
      supabase.from('localized_seo_pages').select('*, countries!inner(name,slug), country_languages!inner(name,native_name,code,locale,url_prefix,active)').eq('published', true).eq('indexable', true),
    ]);
    if (be) throw be;
    if (ce) throw ce;
    if (ge) throw ge;
    if (ie) throw ie;
    if (cbfe) throw cbfe;
    if (rve) throw rve;
    if (lspe) throw lspe;
    brokers = b ?? [];
    countries = c ?? [];
    guides = g ?? [];
    intents = i ?? [];
    countryBestFors = (cbf ?? []).map((x) => ({ ...x, country_name: x.countries?.name, country_slug: x.countries?.slug }));
    reviews = rv ?? [];

    localizedSeoPages = lsp ?? [];
    // Option B: load linked Content Studio bodies for prerender HTML
    try {
      const docIds = [...new Set((localizedSeoPages || []).map((x) => x.content_document_id).filter(Boolean))];
      if (docIds.length) {
        const { data: docs } = await supabase.from('content_documents').select('id,html,blocks,published').in('id', docIds);
        globalThis.__piprankContentDocsById = new Map((docs || []).map((d) => [Number(d.id), d]));
      } else {
        globalThis.__piprankContentDocsById = new Map();
      }
    } catch {
      globalThis.__piprankContentDocsById = new Map();
    }
  } catch (err) {
    if (process.env.VERCEL_ENV === 'production') throw new Error(`Failed to fetch data from Supabase during production prerender: ${err.message}`);
    warn(`Failed to fetch data from Supabase — skipping prerender for non-production build. Error: ${err.message}`);
    return;
  }

  // Optional during migration: once broker_content exists and is populated,
  // every production prerender automatically includes the richer broker content.
  try {
    const { data: bc, error: bce } = await supabase.from('broker_content').select('*');
    if (bce) {
      warn(`broker_content unavailable during prerender; broker pages will use base broker fields. ${bce.message}`);
    } else {
      brokerContents = bc ?? [];
      log(`Fetched ${brokerContents.length} broker content records.`);
    }
  } catch (err) {
    warn(`broker_content fetch skipped: ${err.message}`);
  }

  // Optional during migration: once content_documents exists and is populated
  // (via the Content Studio / Bulk SEO Generator), every production prerender
  // automatically reflects admin edits on country-topic pages instead of
  // silently regenerating from the template every time.
  const contentDocByKey = new Map();
  try {
    const { data: cd, error: cde } = await supabase.from('content_documents').select('*').eq('content_type', 'country-topic');
    if (cde) {
      warn(`content_documents unavailable during prerender; country-topic pages will use template defaults only. ${cde.message}`);
    } else {
      contentDocs = cd ?? [];
      for (const doc of contentDocs) {
        if (doc.country_slug && doc.topic_slug) contentDocByKey.set(`${doc.country_slug}:${doc.topic_slug}`, doc);
      }
      log(`Fetched ${contentDocs.length} content_documents records.`);
    }
  } catch (err) {
    warn(`content_documents fetch skipped: ${err.message}`);
  }

  const brokerContentById = new Map((brokerContents ?? []).map((row) => [Number(row.broker_id), row]));

  log(`Fetched ${brokers.length} brokers, ${countries.length} countries, ${guides.length} guides, ${intents.length} global best-for pages, ${countryBestFors.length} country best-for pages.`);

  let written = 0;
  const writtenPaths = new Set();

  // --- Static/top-level pages -----------------------------------------
  // These pages are also prerendered so important directory and methodology
  // content is present in the initial HTML rather than waiting for React.
  const sortedBrokers = [...brokers].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const staticPages = [
    {
      path: '/',
      title: `PipRank — Best Forex Brokers ${new Date().getFullYear()}: Reviews, Comparison & Free Trading Tools`,
      description: 'Compare forex brokers using PipRank data on regulation, trading costs, platforms, execution and account features.',
      content: `<main><h1>Best Forex Brokers ${new Date().getFullYear()}</h1><p>Compare forex brokers using PipRank data on regulation, trading costs, platforms, execution and account features.</p><h2>Top forex brokers</h2><ul>${sortedBrokers.slice(0, 10).map((b) => `<li><a href=\"/brokers/${esc(b.slug)}\">${esc(b.name)}</a> — ${esc(b.tagline || 'Broker profile and comparison')}</li>`).join('')}</ul><p><a href=\"/brokers\">See all forex brokers</a> · <a href=\"/countries\">Find brokers by country</a> · <a href=\"/compare\">Compare brokers</a></p></main>`,
      jsonLd: [webSiteJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }])],
    },
    {
      path: '/brokers',
      title: `Best Forex Brokers ${new Date().getFullYear()}: Full Rankings | ${SITE_NAME}`,
      description: 'Compare forex brokers by regulation, trading costs, platforms, execution and account features.',
      content: `<main><h1>Best Forex Brokers ${new Date().getFullYear()}</h1><p>Compare forex brokers by regulation, trading costs, platforms, execution and account features.</p><ol>${sortedBrokers.map((b) => `<li><a href=\"/brokers/${esc(b.slug)}\">${esc(b.name)}</a> — ${esc(b.tagline || '')}</li>`).join('')}</ol></main>`,
      jsonLd: [webPageJsonLd(staticPageSeo('brokers').title, staticPageSeo('brokers').description, '/brokers', 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Brokers', path: '/brokers' }]), itemListJsonLd('Forex brokers', sortedBrokers.map((b) => ({ name: b.name, path: `/brokers/${b.slug}` })))],
    },
    {
      path: '/countries',
      title: `Best Forex Brokers by Country | ${SITE_NAME}`,
      description: 'Find forex brokers available in different countries, with country-specific regulation and broker recommendations.',
      content: `<main><h1>Best Forex Brokers by Country</h1><p>Find forex brokers available in different countries, with country-specific regulation and broker recommendations.</p><ul>${countries.map((c) => `<li><a href=\"/countries/${esc(c.slug)}\">Best Forex Brokers in ${esc(c.name)}</a></li>`).join('')}</ul></main>`,
      jsonLd: [webPageJsonLd(staticPageSeo('countries').title, staticPageSeo('countries').description, '/countries', 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Countries', path: '/countries' }]), itemListJsonLd('Forex brokers by country', countries.map((c) => ({ name: c.name, path: `/countries/${c.slug}` })))],
    },
    {
      path: '/guides',
      title: `Forex Trading Guides & Education | ${SITE_NAME}`,
      description: 'Forex trading guides covering brokers, spreads, leverage, platforms, regulation and trading costs.',
      content: `<main><h1>Forex Trading Guides & Education</h1><p>Learn about forex brokers, spreads, leverage, platforms, regulation and trading costs.</p><ul>${guides.map((g) => `<li><a href=\"/guides/${esc(g.slug)}\">${esc(g.title)}</a> — ${esc(g.excerpt || '')}</li>`).join('')}</ul></main>`,
      jsonLd: [webPageJsonLd(staticPageSeo('guides').title, staticPageSeo('guides').description, '/guides', 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides' }]), itemListJsonLd('Forex trading guides', guides.map((g) => ({ name: g.title, path: `/guides/${g.slug}` })))],
    },
    {
      path: '/compare',
      title: `Compare Forex Brokers Side by Side | ${SITE_NAME}`,
      description: 'Compare forex brokers side by side across spreads, fees, regulation, platforms and trading features.',
      content: `<main><h1>Compare Forex Brokers Side by Side</h1><p>Compare brokers across spreads, fees, regulation, platforms and trading features.</p><h2>Popular comparisons</h2><ul>${sortedBrokers.slice(0, 6).map((a, i) => sortedBrokers.slice(i + 1, i + 4).map((b) => { const [x,y]=[a,b].sort((m,n)=>m.slug.localeCompare(n.slug)); return `<li><a href=\"/compare/${esc(x.slug)}-vs-${esc(y.slug)}\">${esc(x.name)} vs ${esc(y.name)}</a></li>`; }).join('')).join('')}</ul></main>`,
      jsonLd: [webPageJsonLd(staticPageSeo('compare').title, staticPageSeo('compare').description, '/compare', 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Compare', path: '/compare' }])],
    },
    {
      path: '/methodology',
      title: `Broker Health Score Methodology | ${SITE_NAME}`,
      description: 'Learn how PipRank evaluates forex brokers across regulation, withdrawals, execution, longevity, support and user sentiment.',
      content: `<main><h1>Broker Health Score Methodology</h1><p>PipRank evaluates brokers across regulation quality, withdrawal reliability, execution quality, years in business, customer support and user sentiment.</p><p><a href=\"/brokers\">Explore broker rankings</a> · <a href=\"/countries\">Browse country guides</a></p></main>`,
      jsonLd: [webPageJsonLd(`Broker Health Score Methodology | ${SITE_NAME}`, 'Learn how PipRank evaluates forex brokers.', '/methodology', 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Methodology', path: '/methodology' }])],
    },
    {
      path: '/quiz',
      title: `Find Your Best Forex Broker | Broker Match Quiz | ${SITE_NAME}`,
      description: 'Answer a few questions about your trading goals, experience, budget and preferred platform to find forex brokers that fit your needs.',
      content: `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Broker Match Quiz</span></nav><h1>Find Your Best Forex Broker</h1><p>Answer a few questions about your trading experience, budget, preferred platform and trading style to get a personalized broker shortlist.</p><h2>How the broker quiz works</h2><ol><li>Tell us about your experience and trading goals.</li><li>Choose the features that matter most to you.</li><li>Review your broker matches and compare the strongest options.</li></ol><p><a href="/quiz">Start the broker match quiz</a></p></main>`,
      jsonLd: [webPageJsonLd(`Find Your Best Forex Broker | Broker Match Quiz | ${SITE_NAME}`, 'Find forex brokers matched to your trading needs.', '/quiz', 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Broker Match Quiz', path: '/quiz' }])],
    },
    {
      path: '/tools',
      title: `Forex Trading Tools & Calculators | ${SITE_NAME}`,
      description: 'Use PipRank forex trading tools and calculators to compare trading costs, understand spreads and make better broker decisions.',
      content: `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Forex Trading Tools</span></nav><h1>Forex Trading Tools & Calculators</h1><p>Use practical forex tools to understand trading costs, compare broker conditions and make more informed decisions.</p><h2>Explore PipRank tools</h2><p>Use the available calculators and trading utilities to estimate costs and evaluate broker options before opening an account.</p><p><a href="/tools">Explore all forex tools</a> · <a href="/quiz">Find your broker match</a></p></main>`,
      jsonLd: [webPageJsonLd(`Forex Trading Tools & Calculators | ${SITE_NAME}`, 'Forex trading tools and calculators for broker research.', '/tools', 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Forex Trading Tools', path: '/tools' }])],
    },
    {
      path: '/about',
      title: `About PipRank: Editorial Policy, Methodology & Affiliate Disclosure | ${SITE_NAME}`,
      description: 'How PipRank works: our editorial independence policy, how we make money, broker review and scoring methodology, data sources, update cadence, corrections policy and reviewer information.',
      content: `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>About PipRank</span></nav><h1>About PipRank</h1><p>PipRank is an independent forex broker research site. We compare brokers on regulation, real-money-tested trading costs, execution quality, withdrawal reliability and platform features, and roll those factors into a single Health Score.</p><h2>Editorial policy</h2><p>No broker can pay for a higher score, a better rank, or a more favorable review. Brokers do not see review or scoring content before publication, and affiliate relationships have zero weight in the Health Score formula.</p><h2>How we make money</h2><p>PipRank is reader-supported. Links marked Visit are partner links and we may earn a commission if you open an account through one, at no extra cost to you. Compensation never changes a Health Score, a ranking position, or the content of a review.</p><h2>Review and scoring methodology</h2><p>Every broker review follows the same structure: regulation and entity check, real-money trading-cost measurement, execution testing, withdrawal timing, support testing, and a sentiment read from verified user reviews. <a href="/methodology">See the full Health Score methodology</a>.</p><h2>Data sources</h2><p>Regulator registers for licence status, real-money testing for spreads and execution, verified user reviews for sentiment, and broker-provided information only for non-scored factual details such as platform names.</p><h2>Update policy</h2><p>Health Scores are fully recomputed monthly. Withdrawal timing is re-tested quarterly. Licence registers are scanned twice a year. Complaint and sentiment signals refresh weekly.</p><h2>Corrections policy</h2><p>If you spot an inaccuracy, we re-verify the claim against its original source and correct confirmed errors as soon as the fix is verified. Report an error to hello@piprank.io.</p><h2>Author and reviewer information</h2><p>Reviews and scores are produced and maintained by the PipRank editorial team following the methodology above. Bylines are editorial identities used consistently across our reviews. See our editorial team page for who covers regulation, trading-cost testing, methodology and country compliance.</p><h2>Understanding forex regulators</h2><p>Not all regulated claims mean the same thing. A broker can hold a strong licence in one jurisdiction while your specific account is opened under a lighter-touch entity elsewhere, including regulators such as the FCA, ASIC, CySEC, SEC/FINRA and FSCA.</p></main>`,
      jsonLd: [webPageJsonLd(`About PipRank: Editorial Policy, Methodology & Affiliate Disclosure | ${SITE_NAME}`, 'How PipRank works: editorial policy, how we make money, methodology, data sources, update cadence, corrections policy and reviewer information.', '/about', 'AboutPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'About PipRank', path: '/about' }])],
    },
    {
      path: '/authors',
      title: `Our Editorial Team | ${SITE_NAME}`,
      description: 'Meet the PipRank editorial team responsible for broker regulation checks, real-money testing, Health Score methodology and country coverage.',
      content: `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Editorial Team</span></nav><h1>Our Editorial Team</h1><p>Reviews are attributed to the editor responsible for that section of our process, each following the same published methodology. Bylines are editorial identities used consistently across our reviews.</p><ul>${TEAM.map((t) => `<li id="${esc(t.slug)}"><strong>${esc(t.penName)}</strong> — ${esc(t.role)}</li>`).join('')}</ul><p><a href="/methodology">Full Health Score methodology</a> · <a href="/about">Editorial policy</a></p></main>`,
      jsonLd: [webPageJsonLd(`Our Editorial Team | ${SITE_NAME}`, 'Meet the PipRank editorial team.', '/authors', 'CollectionPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Editorial Team', path: '/authors' }])],
    },
    {
      path: '/promotions',
      title: `Forex Broker Promotions & Offers | ${SITE_NAME}`,
      description: 'Browse current forex broker promotions and offers available through PipRank, with eligibility details and important terms to check before participating.',
      content: `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Broker Promotions</span></nav><h1>Forex Broker Promotions & Offers</h1><p>Browse current broker promotions and offers listed by PipRank. Always check eligibility, terms, expiry dates and applicable country restrictions before participating.</p><h2>Compare the broker behind an offer</h2><p>A promotion should not be the only reason you choose a forex broker. Review regulation, costs, platforms and suitability before opening an account.</p><p><a href="/brokers">Compare forex brokers</a> · <a href="/countries">Browse brokers by country</a></p></main>`,
      jsonLd: [webPageJsonLd(`Forex Broker Promotions & Offers | ${SITE_NAME}`, 'Current forex broker promotions and offers.', '/promotions', 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Broker Promotions', path: '/promotions' }])],
    },
  ];

  for (const page of staticPages) {
    writePage(page.path, { title: page.title, description: page.description, path: page.path, type: 'website' }, page.jsonLd, page.content, shell, writtenPaths);
    written++;
  }

  // --- Country guides ----------------------------------------------------
  // Generic, data-driven — replaces the old hardcoded Malaysia/Ghana-only
  // loops. Any country automatically gets a guide page the moment a
  // published content_documents row (content_type: 'country-guide') exists
  // for it; no new route or component is needed per country.
  const countryBySlug = new Map(countries.map((c) => [c.slug, c]));
  const guideDocs = contentDocs.filter((d) => d.content_type === 'country-guide' && d.published !== false && d.country_slug && d.slug);
  for (const doc of guideDocs) {
    const country = countryBySlug.get(doc.country_slug);
    if (!country) continue;
    const path = `/${country.slug}/guides/${doc.slug}`;
    const title = doc.seo_title || `${doc.title} | ${SITE_NAME}`;
    const description = doc.seo_description || doc.excerpt || '';
    const reviewer = reviewerFor(`${country.slug}-guide-${doc.slug}`);
    const settings = doc.settings || {};
    const faqs = Array.isArray(settings.faqs) ? settings.faqs : [];
    const internalLinks = Array.isArray(settings.internalLinks) ? settings.internalLinks : [];
    const bodyHtml = Array.isArray(doc.blocks) && doc.blocks.length ? blocksToHtmlServer(doc.blocks) : (doc.html || '');
    const content = `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/${esc(country.slug)}">${esc(country.name)}</a> &rsaquo; <span>${esc(doc.title)}</span></nav><h1>${esc(doc.title)}</h1><p>Reviewed by <a href="/authors#${esc(reviewer.slug)}">${esc(reviewer.penName)}</a>, ${esc(reviewer.role)} · Updated ${esc(new Date(doc.updated_at).toISOString().slice(0, 10))}</p>${doc.excerpt ? `<p>${esc(doc.excerpt)}</p>` : ''}${bodyHtml}${faqs.length ? `<h2>Frequently Asked Questions</h2>${faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}` : ''}<p><a href="/${esc(country.slug)}">Compare forex brokers in ${esc(country.name)}</a> · <a href="/quiz">Find my broker</a>${internalLinks.map((l) => ` · <a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}</p></main>`;
    const jsonLd = [
      { ...webPageJsonLd(title, description, path, 'Article'), author: { '@type': 'Person', name: reviewer.penName, jobTitle: reviewer.role, url: absoluteUrl(`/authors#${reviewer.slug}`) } },
      breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: country.name, path: `/${country.slug}` }, { name: doc.title, path }]),
      ...(faqs.length ? [faqPageJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a })))] : []),
    ];
    writePage(path, { title, description, path, type: 'article' }, jsonLd, content, shell, writtenPaths);
    written++;
  }

  // --- Brokers ---------------------------------------------------------
  for (const b of brokers) {
    if (!b.slug) continue;
    const year = new Date().getFullYear();
    const reviewer = reviewerFor(b.slug);
    const title = `${b.name} Review ${year}: Spreads, Fees & Verdict | ${SITE_NAME}`;
    const description =
      b.tagline && b.tagline !== 'New broker under review'
        ? `${b.name} review: ${b.tagline} Real-money tested spreads, leverage, fees and withdrawal times — see if ${b.name} is right for you.`
        : `In-depth ${b.name} review: real-money tested spreads from ${b.spread_eurusd ?? '—'} pips, minimum deposit, leverage up to ${b.max_leverage ?? '—'}, and verified fees. Independently scored by ${SITE_NAME}.`;

    const content = `
      <main>
        <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/brokers">Brokers</a> &rsaquo; <span>${esc(b.name)}</span></nav>
        <h1>${esc(b.name)} Review ${year}</h1>
        <p>Reviewed by <a href="/authors#${reviewer.slug}">${esc(reviewer.penName)}</a>, ${esc(reviewer.role)}${b.updated_at ? ` · Updated ${esc(new Date(b.updated_at).toISOString().slice(0, 10))}` : ''}</p>
        <p>${esc(b.tagline || '')}</p>
        ${b.risk_warning ? `<p><strong>${esc(b.risk_warning)}</strong></p>` : ''}
        <ul>
          <li>Rating: ${esc(String(b.rating ?? '—'))} / 5</li>
          <li>Minimum deposit: ${esc(String(b.min_deposit ?? '—'))}</li>
          <li>EUR/USD spread: ${esc(String(b.spread_eurusd ?? '—'))} pips</li>
          <li>Max leverage: ${esc(b.max_leverage ?? '—')}</li>
          <li>Founded: ${esc(String(b.founded ?? '—'))}</li>
          <li>Headquarters: ${esc(b.headquarters ?? '—')}</li>
        </ul>
        ${Array.isArray(b.review) ? b.review.map((p) => `<p>${esc(p)}</p>`).join('\n') : ''}
        ${Array.isArray(b.pros) && b.pros.length ? `<h2>Pros</h2><ul>${b.pros.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        ${Array.isArray(b.cons) && b.cons.length ? `<h2>Cons</h2><ul>${b.cons.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        <h2>Is ${esc(b.name)} right for you?</h2>
        <p>${esc(b.tagline || '')} ${Array.isArray(b.best_for) && b.best_for.length ? `PipRank lists this broker for ${b.best_for.slice(0, 4).join(', ')}.` : 'Review the broker costs, regulation, platforms and account features before deciding.'}</p>
        ${Array.isArray(b.best_for) && b.best_for.length ? `<h3>Best for</h3><ul>${b.best_for.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${(() => {
          const bc = brokerContentById.get(Number(b.id));
          const renderItems = (items) => Array.isArray(items) && items.length ? `<ul>${items.map((item) => {
            if (typeof item === 'string') return `<li>${esc(item)}</li>`;
            if (item && typeof item === 'object') {
              const label = item.title || item.name || item.label || item.type;
              const text = item.description || item.details || item.value || item.text || '';
              return `<li>${label ? `<strong>${esc(label)}</strong>` : ''}${text ? ` — ${esc(text)}` : ''}</li>`;
            }
            return '';
          }).join('')}</ul>` : '';
          if (!bc) return '';
          const para = (items) => Array.isArray(items) && items.length ? items.map((x) => `<p>${esc(String(x))}</p>`).join('') : '';
          const faq = Array.isArray(bc.faqs) && bc.faqs.length ? `<h2>${esc(b.name)} FAQs</h2>${bc.faqs.map((f) => `<details><summary>${esc(f.q || '')}</summary><p>${esc(f.a || '')}</p></details>`).join('')}` : '';
          return `${para(bc.overview)}${bc.verdict?.length ? `<h2>PipRank verdict</h2>${para(bc.verdict)}` : ''}${bc.why_recommend?.length ? `<h2>Why PipRank recommends ${esc(b.name)}</h2>${para(bc.why_recommend)}` : ''}${bc.best_for_detail?.length ? `<h2>Who ${esc(b.name)} is best for</h2>${para(bc.best_for_detail)}` : ''}${bc.avoid_if?.length ? `<h2>Consider alternatives if…</h2>${para(bc.avoid_if)}` : ''}${bc.regulation_detail?.length ? `<h2>${esc(b.name)} regulation and safety</h2>${para(bc.regulation_detail)}` : ''}${bc.fees_detail?.length ? `<h2>${esc(b.name)} trading costs explained</h2>${para(bc.fees_detail)}` : ''}${bc.platform_intro?.length ? `<h2>Platforms</h2>${para(bc.platform_intro)}` : ''}${Array.isArray(bc.platforms) && bc.platforms.length ? renderItems(bc.platforms) : ''}${bc.accounts_intro?.length ? `<h2>Account types</h2>${para(bc.accounts_intro)}` : ''}${Array.isArray(bc.accounts) && bc.accounts.length ? renderItems(bc.accounts) : ''}${bc.funding_intro?.length ? `<h2>Deposits and withdrawals</h2>${para(bc.funding_intro)}` : ''}${Array.isArray(bc.payments) && bc.payments.length ? renderItems(bc.payments) : ''}${faq}`;
        })()}
        <h2>Regulation and safety</h2>
        ${Array.isArray(b.regulations) && b.regulations.length ? `<ul>${b.regulations.map((r) => `<li>${esc(r.body)} — ${esc(r.country)} — Tier ${esc(String(r.tier))}</li>`).join('')}</ul>` : '<p>Regulatory information is not confirmed in the current dataset.</p>'}
        <h2>Trading costs and key features</h2>
        <ul>
          <li>EUR/USD spread: ${esc(String(b.spread_eurusd ?? '—'))} pips</li>
          <li>Commission: ${esc(String(b.commission ?? '—'))}</li>
          <li>Maximum leverage: ${esc(b.max_leverage ?? '—')}</li>
          <li>Platforms: ${esc((b.platforms ?? []).join(', ') || '—')}</li>
          <li>Account types: ${esc((b.account_types ?? []).join(', ') || '—')}</li>
          <li>Minimum deposit: ${esc(String(b.min_deposit ?? '—'))}</li>
        </ul>
        <h2>How PipRank evaluates ${esc(b.name)}</h2>
        <p>PipRank considers regulation quality, withdrawal reliability, execution quality, years in business, customer support and user sentiment, alongside trading costs and platform features.</p>
        <ul>${['regulation','withdrawals','execution','longevity','support','sentiment'].map((k) => `<li>${esc(k)}: ${esc(String(b.health?.[k] ?? '—'))}/100</li>`).join('')}</ul>
        ${Array.isArray(b.faqs) && b.faqs.length ? `<h2>${esc(b.name)} FAQs</h2>${b.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}` : ''}
        <h2>Compare ${esc(b.name)}</h2>
        <ul>${sortedBrokers.filter((x) => x.slug !== b.slug).slice(0, 3).map((other) => { const [a,b2] = [b, other].sort((x,y) => x.slug.localeCompare(y.slug)); return `<li><a href="/compare/${esc(a.slug)}-vs-${esc(b2.slug)}">${esc(a.name)} vs ${esc(b2.name)}</a></li>`; }).join('')}</ul>
        <p><a href="/brokers">See all brokers</a></p>
      </main>
    `;

    const brokerReviews = (reviews ?? []).filter((r) => Number(r.broker_id) === Number(b.id));
    const verifiedReviews = brokerReviews.filter((r) => r.verified === true);
    const reviewRatings = verifiedReviews;
    const aggregate = reviewRatings.length
      ? {
          '@type': 'AggregateRating',
          ratingValue: (reviewRatings.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewRatings.length).toFixed(2),
          reviewCount: reviewRatings.length,
          bestRating: 5,
          worstRating: 1,
        }
      : null;
    const brokerSchema = {
      '@context': 'https://schema.org',
      '@type': 'FinancialProduct',
      name: b.name,
      description,
      url: absoluteUrl(`/brokers/${b.slug}`),
      ...(b.website ? { sameAs: [b.website] } : {}),
      ...(aggregate ? { aggregateRating: aggregate } : {}),
    };
    const jsonLd = [
      { ...webPageJsonLd(title, description, `/brokers/${b.slug}`, 'website'), author: { '@type': 'Person', name: reviewer.penName, jobTitle: reviewer.role, url: absoluteUrl(`/authors#${reviewer.slug}`) } },
      brokerSchema,
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Brokers', path: '/brokers' },
        { name: b.name, path: `/brokers/${b.slug}` },
      ]),
      ...(Array.isArray(b.faqs) && b.faqs.length ? [faqPageJsonLd(b.faqs.map((f) => ({ question: f.q, answer: f.a })))] : []),
    ];

    writePage(`/brokers/${b.slug}`, { title, description, path: `/brokers/${b.slug}` }, jsonLd, content, shell, writtenPaths);
    written++;
  }

  // --- Countries ---------------------------------------------------------
  // 10 intents (beginners, low-spread, mt5, gold, scalping, ecn,
  // copy-trading, swing-trading, high-leverage, islamic) are a strict
  // subset of the Phase 10 country-topic matrix and now 301-redirect (see
  // vercel.json) to their canonical /:country/:topic URL rather than
  // getting separate content. Used below both to skip generating those
  // country_best_for pages directly and to link straight to the canonical
  // URL from country-hub cross-links, instead of routing through a
  // redirect. Kept in sync with vercel.json, generate-sitemap.mjs and
  // SUPERSEDED_INTENT_SLUGS in src/pages/Admin.tsx.
  const INTENT_TO_TOPIC = {
    beginners: 'forex-brokers-for-beginners',
    'low-spread': 'low-spread-forex-brokers',
    mt5: 'mt5-forex-brokers',
    gold: 'gold-forex-brokers',
    scalping: 'forex-brokers-for-scalping',
    ecn: 'ecn-forex-brokers',
    'copy-trading': 'copy-trading-forex-brokers',
    'swing-trading': 'forex-brokers-for-swing-trading',
    'high-leverage': 'high-leverage-forex-brokers',
    islamic: 'islamic-forex-brokers',
  };
  for (const c of countries) {
    if (!c.slug) continue;
    const year = new Date().getFullYear();
    const title = c.seo_title?.trim() || `Best Forex Brokers in ${c.name} ${year} | ${SITE_NAME}`;
    const description =
      c.seo_description?.trim() || (c.subtitle && c.subtitle.trim()
        ? `${c.subtitle} Compare forex brokers available to traders in ${c.name}, including trading costs, platforms, regulation and country availability.`
        : `Compare forex brokers available to traders in ${c.name}. Review regulation, trading costs, platforms, account features and country availability with ${SITE_NAME}.`);

    const recommended = Array.isArray(c.recommended) ? c.recommended : [];
    const unavailable = Array.isArray(c.unavailable) ? c.unavailable : [];
    const intro = Array.isArray(c.intro) ? c.intro : [];
    const seoIntro = Array.isArray(c.seo_intro) && c.seo_intro.length ? c.seo_intro : intro;
    const seoSections = Array.isArray(c.seo_sections) ? c.seo_sections : [];
    const facts = Array.isArray(c.facts) ? c.facts : [];
    const recBrokers = recommended.map((r) => brokers.find((b) => b.slug === r.slug)).filter(Boolean);

    const byRating = (arr) => [...arr].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const bestBeginner = byRating(brokers.filter((b) => Array.isArray(b.best_for) && b.best_for.includes('beginners'))).slice(0, 3);
    const bestMt5 = byRating(brokers.filter((b) => Array.isArray(b.platforms) && b.platforms.some((p) => String(p).toLowerCase() === 'mt5'))).slice(0, 3);
    const bestScalping = byRating(brokers.filter((b) => b.scalping)).slice(0, 3);
    const bestGold = byRating(brokers.filter((b) => Number(b.assets?.commodities ?? 0) > 0)).slice(0, 3);
    const bestIslamic = byRating(brokers.filter((b) => b.islamic_account)).slice(0, 3);
    const bestCopy = byRating(brokers.filter((b) => b.copy_trading)).slice(0, 3);
    const bestLowSpread = [...brokers].sort((a, b) => {
      const ca = Number(a.spread_eurusd ?? 0) + Number(a.commission_value ?? 0) / 10;
      const cb = Number(b.spread_eurusd ?? 0) + Number(b.commission_value ?? 0) / 10;
      return ca - cb;
    }).slice(0, 3);

    const category = [
      ['Best for beginners', bestBeginner],
      ['Best for low spreads', bestLowSpread],
      ['Best MT5 broker', bestMt5],
      ['Best for scalping', bestScalping],
      ['Best for gold trading', bestGold],
      ['Best Islamic / swap-free option', bestIslamic],
      ['Best for copy trading', bestCopy],
    ].filter(([, list]) => list.length);

    const defaultFaq = [
      { q: `What are the best forex brokers in ${c.name}?`, a: recBrokers.length ? `${SITE_NAME} currently recommends ${recBrokers.slice(0, 3).map((b) => b.name).join(', ')} based on the country recommendations in our database. Compare the full broker profiles and confirm current terms before opening an account.` : `${SITE_NAME} evaluates broker availability and trading features for ${c.name}. Review the current broker information on this page before opening an account.` },
      { q: `How should I choose a forex broker in ${c.name}?`, a: `Compare the legal entity serving you, regulation, trading costs, platform, minimum deposit, withdrawal terms and the features that matter to your trading style. Country availability can differ even when the broker brand is the same.` },
      { q: `Are all forex brokers available in ${c.name}?`, a: `No. Broker availability varies by country and legal entity. ${SITE_NAME} flags brokers that do not currently onboard retail residents of ${c.name} in its dataset, but you should always confirm availability directly with the broker before depositing.` },
      { q: `What should I check before depositing with a forex broker?`, a: `Confirm the exact legal entity you will contract with, the regulator responsible for that entity, current fees and spreads, withdrawal methods, account requirements and the broker's current terms.` },
    ];
    const faq = Array.isArray(c.seo_faqs) && c.seo_faqs.length ? c.seo_faqs.filter((x) => x?.q && x?.a) : defaultFaq;
    const uniqueSectionHtml = seoSections.map((section) => `<section><h2>${esc(section.heading || '')}</h2>${(Array.isArray(section.body) ? section.body : []).map((x) => `<p>${esc(x)}</p>`).join('')}${Array.isArray(section.bullets) && section.bullets.length ? `<ul>${section.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section>`).join('');

    const comparisonRows = recBrokers.slice(0, 4).map((b) => `
      <tr>
        <th><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a></th>
        <td>${esc(String(b.rating ?? '—'))}/5</td>
        <td>${esc(String(b.min_deposit ?? '—'))}</td>
        <td>${esc(String(b.spread_eurusd ?? '—'))} pips</td>
        <td>${esc(b.max_leverage ?? '—')}</td>
        <td>${esc((b.platforms ?? []).slice(0, 3).join(', '))}</td>
      </tr>`).join('');

    const countryBestForLinks = countryBestFors.filter((p) => p.country_slug === c.slug && p.indexable);
    const bestForHtml = countryBestForLinks.length
      ? `<h2>Best Forex Brokers by Trading Need</h2><ul>${countryBestForLinks.map((p) => `<li><a href="${INTENT_TO_TOPIC[p.slug] ? `/${esc(c.slug)}/${esc(INTENT_TO_TOPIC[p.slug])}` : `/countries/${esc(c.slug)}/best/${esc(p.slug)}`}">${esc(p.label || p.title)}</a> — ${esc(p.intro?.[0] || '')}</li>`).join('')}</ul>`
      : '';
    const categoryHtml = category.map(([label, list]) => `
      <section>
        <h3>${esc(label)}</h3>
        <ul>${list.map((b, i) => `<li>${i + 1}. <a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a> — Trust score ${esc(String(b.trust_score ?? '—'))}</li>`).join('')}</ul>
      </section>`).join('');

    const faqHtml = faq.map((item) => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join('');

    const content = `
      <main>
        <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/countries">Countries</a> &rsaquo; <span>${esc(c.name)}</span></nav>
        <h1>Best Forex Brokers in ${esc(c.name)} ${year}</h1>
        <p>${esc(c.subtitle || '')}</p>
        ${seoIntro.map((p) => `<p>${esc(p)}</p>`).join('\n')}
        ${uniqueSectionHtml}

        ${facts.length ? `<h2>Forex trading facts for ${esc(c.name)}</h2><ul>${facts.map((f) => `<li><strong>${esc(f.label ?? '')}:</strong> ${esc(f.value ?? '')}</li>`).join('')}</ul>` : ''}

        <h2>Top Forex Brokers in ${esc(c.name)}</h2>
        <p>These recommendations reflect the brokers currently available in the ${esc(c.name)} dataset. Compare full broker profiles and confirm current terms before opening an account.</p>
        <ol>${recommended.map((r) => {
          const b = brokers.find((x) => x.slug === r.slug);
          return b ? `<li><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a> — ${esc(r.note || '')}</li>` : '';
        }).join('')}</ol>

        ${recBrokers.length >= 2 ? `
        <h2>Forex Broker Comparison in ${esc(c.name)}</h2>
        <table>
          <caption>Comparison of recommended forex brokers available in ${esc(c.name)}</caption>
          <thead><tr><th>Broker</th><th>Rating</th><th>Min. deposit</th><th>EUR/USD spread</th><th>Max leverage</th><th>Platforms</th></tr></thead>
          <tbody>${comparisonRows}</tbody>
        </table>` : ''}

        ${categoryHtml ? `<h2>Which Forex Broker Is Best for You?</h2>${categoryHtml}` : ''}
        ${bestForHtml}

        <h2>Regulation and Broker Availability in ${esc(c.name)}</h2>
        <p>A broker's brand name does not necessarily tell you which legal entity you will contract with. Regulation, leverage, account protections, products and onboarding rules can vary by entity and country.</p>
        <p>Before funding an account, check the exact legal entity named in the broker's current terms, the regulator responsible for that entity, the available account type and the withdrawal conditions that apply to you.</p>
        ${unavailable.length ? `<p>${esc(unavailable.length)} broker(s) are currently flagged as unavailable to retail residents of ${esc(c.name)} in our dataset. Verify directly with each broker because availability can change.</p>` : ''}

        <h2>How PipRank Evaluates Forex Brokers</h2>
        <ul>
          <li><strong>Regulation and trust:</strong> regulatory information and trust signals available for each broker.</li>
          <li><strong>Trading costs and execution:</strong> spreads, commissions, execution and account requirements where data is available.</li>
          <li><strong>Trader fit:</strong> platforms, account features and trading preferences so the best choice is not identical for every trader.</li>
        </ul>
        <p><a href="/methodology">See the full PipRank broker scoring methodology</a>.</p>

        <h2>Forex Brokers in ${esc(c.name)}: FAQs</h2>
        ${faqHtml}

        ${unavailable.length ? `<h2>Rated but not currently available in ${esc(c.name)}</h2><ul>${unavailable.map((slug) => {
          const b = brokers.find((x) => x.slug === slug);
          return b ? `<li><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a></li>` : '';
        }).join('')}</ul>` : ''}

        <p><a href="/countries">See all country guides</a> · <a href="/quiz">Get a personal broker match</a></p>
      </main>
    `;

    const jsonLd = [
      webPageJsonLd(title, description, `/countries/${c.slug}`, 'WebPage'),
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Countries', path: '/countries' },
        { name: c.name, path: `/countries/${c.slug}` },
      ]),
      itemListJsonLd(
        `Recommended forex brokers in ${c.name}`,
        recBrokers.map((b) => ({ name: b.name, path: `/brokers/${b.slug}` })),
      ),
      faqPageJsonLd(faq),
    ];

    writePage(`/countries/${c.slug}`, { title, description, path: `/countries/${c.slug}` }, jsonLd, content, shell, writtenPaths);
    writePage(`/${c.slug}`, { title, description, path: `/${c.slug}` }, [webPageJsonLd(title, description, `/${c.slug}`, 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: c.name, path: `/${c.slug}` }]), itemListJsonLd(`Recommended forex brokers in ${c.name}`, recBrokers.map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))), faqPageJsonLd(faq)], content.replaceAll(`/countries/${c.slug}`, `/${c.slug}`), shell, writtenPaths);
    written += 2;
  }

  // --- Global Best-For SEO pages ----------------------------------------
  for (const p of intents) {
    if (!p.slug) continue;
    const year = new Date().getFullYear();
    const title = p.meta_title?.trim() || `${p.title}${/\b20\d{2}\b/.test(p.title) ? '' : ` ${year}`} | ${SITE_NAME}`;
    const description = p.meta_description?.trim() || p.intro?.[0] || `Compare the best forex brokers for ${String(p.label || p.title).toLowerCase()} with ${SITE_NAME}.`;
    const criteria = Array.isArray(p.criteria) ? p.criteria : [];
    const sections = Array.isArray(p.sections) ? p.sections : [];
    const faqs = Array.isArray(p.faqs) ? p.faqs.filter((f) => f?.q && f?.a) : [];
    const ranked = brokers.filter((b) => Array.isArray(b.best_for) && b.best_for.includes(p.slug)).sort((a,b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.trust_score ?? 0) - (a.trust_score ?? 0));
    const sectionHtml = sections.map((section) => `<section><h2>${esc(section.heading || '')}</h2>${(section.body ?? []).map((x) => `<p>${esc(x)}</p>`).join('')}${(section.bullets ?? []).length ? `<ul>${section.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section>`).join('');
    const faqHtml = faqs.length ? `<h2>Frequently Asked Questions</h2>${faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}` : '';
    const content = `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/best">Best Forex Brokers</a> &rsaquo; <span>${esc(p.title)}</span></nav><h1>${esc(p.title)}</h1>${(p.intro ?? []).map((x) => `<p>${esc(x)}</p>`).join('')}${criteria.length ? `<h2>How PipRank ranks this category</h2><ul>${criteria.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<h2>${esc(p.title)}</h2><ol>${ranked.slice(0,10).map((b) => `<li><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a> — ${esc(b.tagline || 'Broker profile and comparison')}</li>`).join('')}</ol>${sectionHtml}${faqHtml}<p><a href="/countries">Find brokers by country</a> · <a href="/quiz">Get a personal broker match</a></p></main>`;
    const jsonLd = [webPageJsonLd(title, description, `/best/${p.slug}`, 'WebPage'), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Best Forex Brokers', path: '/best' }, { name: p.title, path: `/best/${p.slug}` }]), itemListJsonLd(p.title, ranked.slice(0,10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))), ...(faqs.length ? [faqPageJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a })))] : [])];
    writePage(`/best/${p.slug}`, { title, description, path: `/best/${p.slug}` }, jsonLd, content, shell, writtenPaths);
    written++;
  }

  // --- Country Best-For SEO pages --------------------------------------
  // (INTENT_TO_TOPIC is defined once, above, before the country loop.)
  for (const p of countryBestFors) {
    if (!p.slug || !p.country_slug || !p.indexable) continue;
    if (INTENT_TO_TOPIC[p.slug]) continue; // superseded — see vercel.json redirect
    const year = new Date().getFullYear();
    const countryName = p.country_name || p.countries?.name || p.country_slug;
    const title = p.meta_title?.trim() || `${p.title} ${year} | ${SITE_NAME}`;
    const description = p.meta_description?.trim() || `${p.title}. Compare forex brokers available in ${countryName} with ${SITE_NAME}.`;
    const intro = Array.isArray(p.intro) ? p.intro : [];
    const criteria = Array.isArray(p.criteria) ? p.criteria : [];
    const sections = Array.isArray(p.sections) ? p.sections : [];
    const faqs = Array.isArray(p.faqs) ? p.faqs.filter((f) => f?.q && f?.a) : [];
    const country = countries.find((c) => c.slug === p.country_slug);
    const recommendedSlugs = Array.isArray(country?.recommended) ? country.recommended.map((r) => r.slug) : [];
    const ranked = brokers
      .filter((b) => Array.isArray(b.best_for) && b.best_for.includes(p.slug) && (recommendedSlugs.length === 0 || recommendedSlugs.includes(b.slug)))
      .sort((a, b) => {
        const ai = recommendedSlugs.indexOf(a.slug); const bi = recommendedSlugs.indexOf(b.slug);
        if (ai >= 0 && bi >= 0) return ai - bi;
        return (b.rating ?? 0) - (a.rating ?? 0) || (b.trust_score ?? 0) - (a.trust_score ?? 0);
      });
    // Country Best-For pages must not silently fall back to the global broker
    // pool. An empty country recommendation set means the page is not ready
    // to make a country-specific broker recommendation. Keep the page
    // crawlable only when its editorial content is ready, but never claim
    // global brokers are country recommendations.
    const fallback = ranked;
    const sectionHtml = sections.map((section) => `<section><h2>${esc(section.heading || '')}</h2>${(section.body ?? []).map((x) => `<p>${esc(x)}</p>`).join('')}${(section.bullets ?? []).length ? `<ul>${section.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section>`).join('');
    const faqHtml = faqs.length ? `<h2>Frequently Asked Questions</h2>${faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}` : '';
    const content = `<main>
      <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/countries">Countries</a> &rsaquo; <a href="/countries/${esc(p.country_slug)}">${esc(countryName)}</a> &rsaquo; <span>${esc(p.title)}</span></nav>
      <h1>${esc(p.title)}</h1>
      ${intro.map((x) => `<p>${esc(x)}</p>`).join('')}
      ${criteria.length ? `<h2>How PipRank ranks this category</h2><ul>${criteria.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h2>Best Forex Brokers in ${esc(countryName)} for ${esc(p.label)}</h2>
      <ol>${fallback.map((b) => `<li><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a> — ${esc(b.tagline || 'Broker profile and comparison')}</li>`).join('')}</ol>
      ${sectionHtml}
      ${faqHtml}
      <p><a href="/countries/${esc(p.country_slug)}">See all forex brokers in ${esc(countryName)}</a> · <a href="/quiz">Get a personal broker match</a></p>
    </main>`;
    const jsonLd = [
      webPageJsonLd(title, description, `/countries/${p.country_slug}/best/${p.slug}`, 'WebPage'),
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Countries', path: '/countries' },
        { name: countryName, path: `/countries/${p.country_slug}` },
        { name: p.title, path: `/countries/${p.country_slug}/best/${p.slug}` },
      ]),
      itemListJsonLd(`Best ${p.label} forex brokers in ${countryName}`, fallback.map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
      ...(faqs.length ? [faqPageJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a })))] : []),
    ];
    writePage(`/countries/${p.country_slug}/best/${p.slug}`, { title, description, path: `/countries/${p.country_slug}/best/${p.slug}` }, jsonLd, content, shell, writtenPaths);
    written++;
  }

  // --- Country-first commercial topic matrix --------------------------
  // Phase 10 uses one shared registry for eligibility, ranking, metadata and
  // URL generation. This lets PipRank add new dimensions without creating a
  // new React route for every category.
  // (blocksToHtmlServer is defined once, early — see above.)

  for (const c of countries) {
    if (!c.slug || !c.name) continue;
    const countryBrokers = brokers.filter((b) => (c.recommended ?? []).some((r) => r?.slug === b.slug));
    for (const topic of countrySeoTopics) {
      if (topic.indexable === false) continue;
      const eligible = rankCountryTopicBrokers(brokers, c, topic);
      if (eligible.length < (topic.minBrokers ?? 1)) continue;

      const path = `/${c.slug}/${topic.slug}`;
      const { metaTitle, description } = topicMeta(topic, c.name);
      const intro = topicIntro(topic, c.name);
      const faqs = topicFaq(topic, c.name);
      const rankingNotes = (b) => topicNote(topic, b);
      const reviewer = reviewerFor(`${c.slug}-${topic.slug}`);

      // If a Content Studio / Bulk SEO Generator document exists for this
      // exact country+topic and has been published, it overrides the
      // template-generated defaults above — this is what makes admin edits
      // via Page Builder actually reach crawlers instead of only ever
      // appearing on the hydrated client view.
      const doc = contentDocByKey.get(`${c.slug}:${topic.slug}`);
      const useDoc = doc && doc.published !== false;
      const finalTitle = useDoc && doc.title ? doc.title : `${topic.title} in ${c.name}`;
      const finalMetaTitle = useDoc && doc.seo_title ? doc.seo_title : metaTitle;
      const finalDescription = useDoc && doc.seo_description ? doc.seo_description : description;
      const finalFaqs = useDoc && Array.isArray(doc.settings?.faqs) && doc.settings.faqs.length ? doc.settings.faqs : faqs;
      const docBlocksHtml = useDoc && Array.isArray(doc.blocks) && doc.blocks.length ? blocksToHtmlServer(doc.blocks) : '';
      const extraLinks = useDoc && Array.isArray(doc.settings?.internalLinks) ? doc.settings.internalLinks : [];

      const content = `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/${esc(c.slug)}">${esc(c.name)}</a> &rsaquo; <span>${esc(topic.title)}</span></nav><h1>${esc(finalTitle)} ${new Date().getFullYear()}</h1><p>Reviewed by <a href="/authors#${esc(reviewer.slug)}">${esc(reviewer.penName)}</a>, ${esc(reviewer.role)}${useDoc && doc.updated_at ? ` · Updated ${esc(new Date(doc.updated_at).toISOString().slice(0, 10))}` : ''}</p>${
        docBlocksHtml
          ? docBlocksHtml
          : `${intro.map((x) => `<p>${esc(x)}</p>`).join('')}<h2>Best ${esc(topic.shortTitle)} brokers in ${esc(c.name)}</h2><ol>${eligible.slice(0,10).map((b) => `<li><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a> — ${esc(rankingNotes(b))}</li>`).join('')}</ol><h2>Why this page is country-specific</h2><ul><li>PipRank starts with brokers currently recommended for ${esc(c.name)} instead of substituting a global broker list.</li><li>The eligible set is then filtered against the exact trading intent represented by this URL.</li><li>Broker availability, regulation, pricing, platforms and account terms can vary by country.</li></ul>`
      }<h2>Frequently Asked Questions</h2>${finalFaqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}<p><a href="/${esc(c.slug)}">View all forex brokers in ${esc(c.name)}</a> · <a href="/quiz">Get a personal broker match</a>${extraLinks.map((l) => ` · <a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}</p></main>`;
      const jsonLd = [
        { ...webPageJsonLd(finalMetaTitle, finalDescription, path, 'WebPage'), author: { '@type': 'Person', name: reviewer.penName, jobTitle: reviewer.role, url: absoluteUrl(`/authors#${reviewer.slug}`) } },
        breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: c.name, path: `/${c.slug}` }, { name: topic.title, path }]),
        itemListJsonLd(`${topic.title} in ${c.name}`, eligible.slice(0,10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
        faqPageJsonLd(finalFaqs.map((f) => ({ question: f.q, answer: f.a }))),
      ];
      writePage(path, { title: finalMetaTitle, description: finalDescription, path }, jsonLd, content, shell, writtenPaths);
      written++;
    }
    if (countryBrokers.length === 0) warn(`No country recommendation set for ${c.slug}; no Phase 10 matrix pages generated.`);
  }

  // This is the generic path for every language added from the Admin dashboard.
  // Vietnam's legacy cluster above remains as a compatibility fallback until
  // its content is migrated into this table.
  for (const lp of localizedSeoPages) {
    const c = countries.find((x) => Number(x.id) === Number(lp.country_id));
    if (!c || !lp.slug || !lp.language_id) continue;
    const lang = lp.country_languages || {};
    const path = `/${c.slug}/${lang.url_prefix}/${lp.slug}`;
    const eligible = brokers.filter((b) => (c.recommended ?? []).some((r) => (typeof r === 'string' ? r : r?.slug) === b.slug));
    if (eligible.length < 1) continue;
    const title = lp.meta_title || lp.title;
    const description = lp.meta_description || `${lp.title} in ${c.name} — country-specific broker comparisons and trading information from PipRank.`;
    const bodyHtml = (() => {
      const doc = lp.content_document_id && globalThis.__piprankContentDocsById
        ? globalThis.__piprankContentDocsById.get(Number(lp.content_document_id))
        : null;
      if (doc && doc.published !== false && (doc.html || (doc.blocks && doc.blocks.length))) {
        if (Array.isArray(doc.blocks) && doc.blocks.length) {
          return doc.blocks.map((b) => b.html || (b.type === 'heading' ? `<h2>${esc(b.title || '')}</h2>` : '')).join('');
        }
        return doc.html || '';
      }
      return lp.content ? String(lp.content).split(/\n{2,}/).map((x) => `<p>${esc(x)}</p>`).join('') : '';
    })();
    const content = `<main><nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/${esc(c.slug)}">${esc(c.name)}</a> &rsaquo; <span>${esc(lp.title)}</span></nav><h1>${esc(lp.h1 || lp.title)} ${new Date().getFullYear()}</h1>${bodyHtml}<h2>${esc(lp.title)}</h2><ol>${eligible.slice(0,10).map((b) => `<li><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a> — ${esc(b.tagline || 'Broker profile and comparison')}</li>`).join('')}</ol>${Array.isArray(lp.faqs) && lp.faqs.length ? `<h2>Frequently asked questions</h2>${lp.faqs.map((f) => `<details><summary>${esc(f.q || f.question || '')}</summary><p>${esc(f.a || f.answer || '')}</p></details>`).join('')}` : ''}<p><a href="/quiz">Find My Broker</a> · <a href="/${esc(c.slug)}">View ${esc(c.name)} brokers</a></p></main>`;
    const englishPath = englishAlternatePath(c.slug, lp.topic_key);
    const enHreflang = englishHreflangForCountry(c.slug);
    const jsonLd = [
      { ...webPageJsonLd(title, description, path, 'WebPage'), inLanguage: lang.locale || lang.code },
      breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: c.name, path: `/${c.slug}` }, { name: lp.title, path }]),
      itemListJsonLd(lp.title, eligible.slice(0,10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
      faqPageJsonLd((lp.faqs || []).map((f) => ({ question: f.q || f.question, answer: f.a || f.answer }))),
    ];
    writePage(path, { title, description, path, lang: lang.locale || lang.code, alternates: [{ hreflang: lang.locale || lang.code, path }, { hreflang: enHreflang, path: englishPath }, { hreflang: 'x-default', path: englishPath }] }, jsonLd, content, shell, writtenPaths);
    written++;
  }

  // --- Vietnamese country × language commercial cluster ----------------
  // Only generate localized URLs when the Vietnam country record has enough
  // recommended brokers to support the relevant intent. No global fallback.
  const vietnam = countries.find((c) => c.slug === 'vietnam');
  if (vietnam) {
    const recommended = new Set((vietnam.recommended ?? []).map((r) => r?.slug));
    for (const localized of vietnameseCommercialTopics) {
      let eligible = brokers.filter((b) => recommended.has(b.slug));
      if (localized.englishTopicSlug) {
        const topic = countrySeoTopics.find((t) => t.slug === localized.englishTopicSlug);
        if (!topic) continue;
        eligible = rankCountryTopicBrokers(brokers, vietnam, topic);
      } else {
        eligible.sort((a,b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.trust_score ?? 0) - (a.trust_score ?? 0));
      }
      if (eligible.length < 1) continue;
      const path = `/vietnam/vi/${localized.slug}`;
      if (writtenPaths.has(path)) continue;
      const englishPath = localized.englishTopicSlug ? `/vietnam/${localized.englishTopicSlug}` : '/vietnam';
      const content = `<main><nav aria-label="Breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/vietnam">Việt Nam</a> &rsaquo; <span>${esc(localized.title)}</span></nav><h1>${esc(localized.title)} ${new Date().getFullYear()}</h1>${localized.intro.map((x) => `<p>${esc(x)}</p>`).join('')}<h2>${esc(localized.ui.best)} tại Việt Nam</h2><ol>${eligible.slice(0,10).map((b) => `<li><a href="/brokers/${esc(b.slug)}">${esc(b.name)}</a> — ${esc(b.tagline || 'Hồ sơ broker và đánh giá PipRank')}</li>`).join('')}</ol><h2>PipRank đánh giá như thế nào?</h2><ul><li>Bắt đầu từ nhóm broker được đề xuất cho Việt Nam.</li><li>Lọc theo nhu cầu giao dịch của trang.</li><li>So sánh chi phí, nền tảng, tài khoản và tín hiệu về độ tin cậy khi có dữ liệu.</li><li>Kiểm tra pháp nhân và điều kiện áp dụng cho cư dân Việt Nam trước khi nạp tiền.</li></ul><h2>Câu hỏi thường gặp</h2>${localized.faqs.map(([q,a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}<p><a href="${englishPath}">English version</a> · <a href="/quiz">${esc(localized.ui.find)}</a> · <a href="/vietnam">${esc(localized.ui.allBrokers)}</a></p></main>`;
      const jsonLd = [
        { ...webPageJsonLd(localized.metaTitle, localized.description, path, 'WebPage'), inLanguage: 'vi-VN' },
        breadcrumbJsonLd([{ name: 'Trang chủ', path: '/' }, { name: 'Việt Nam', path: '/vietnam' }, { name: localized.title, path }]),
        itemListJsonLd(localized.title, eligible.slice(0,10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
        faqPageJsonLd(localized.faqs.map(([q,a]) => ({ question: q, answer: a }))),
      ];
      writePage(path, { title: localized.metaTitle, description: localized.description, path, lang: 'vi-VN', alternates: [{ hreflang: 'vi-VN', path }, { hreflang: 'en-VN', path: englishPath }] }, jsonLd, content, shell, writtenPaths);
      written++;
    }
  } else warn('Vietnam country record not found; Vietnamese cluster was not prerendered.');

  // --- Admin-managed Country × Language commercial cluster ------------
  // --- Guides ---------------------------------------------------------
  for (const g of guides) {
    if (!g.slug) continue;
    const title = `${g.title} | ${SITE_NAME} Guides`;
    const description = g.excerpt && g.excerpt.trim() ? g.excerpt : `${g.title} — a ${g.category ?? 'trading'} guide from ${SITE_NAME}.`;
    const sections = Array.isArray(g.sections) ? g.sections : [];

    const content = `
      <main>
        <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/guides">Guides</a> &rsaquo; <span>${esc(g.title)}</span></nav>
        <h1>${esc(g.title)}</h1>
        <p>${esc(g.excerpt || '')}</p>
        ${sections
          .map((s) => `<h2>${esc(s.heading ?? '')}</h2>${Array.isArray(s.paragraphs) ? s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('') : ''}`)
          .join('\n')}
        <p><a href="/guides">See all guides</a></p>
      </main>
    `;

    const jsonLd = [
      webPageJsonLd(title, description, `/guides/${g.slug}`, 'Article'),
      breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Guides', path: '/guides' },
        { name: g.title, path: `/guides/${g.slug}` },
      ]),
    ];

    writePage(`/guides/${g.slug}`, { title, description, path: `/guides/${g.slug}` }, jsonLd, content, shell, writtenPaths);
    written++;
  }

  // --- Compare pairs ---------------------------------------------------
  const topBrokers = [...brokers]
    .filter((b) => b.slug)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, MAX_BROKERS_FOR_PAIRS);

  const year = new Date().getFullYear();
  for (let i = 0; i < topBrokers.length; i++) {
    for (let j = i + 1; j < topBrokers.length; j++) {
      // Canonical URL order is always alphabetical by slug, independent of
      // rating rank — this must match generate-sitemap.mjs and any UI links
      // (see BrokerDetail.tsx's "Popular comparisons" links) exactly, or a
      // link/sitemap entry could point at a URL with no prerendered page
      // behind it.
      const [a, b] = [topBrokers[i], topBrokers[j]].sort((x, y) => x.slug.localeCompare(y.slug));
      const title = `${a.name} vs ${b.name} (${year}): Which Is Better? | ${SITE_NAME}`;
      const description = `${a.name} vs ${b.name} head-to-head: spreads, fees, leverage, regulation and execution speed compared side by side, with a clear verdict.`;
      const path = `/compare/${a.slug}-vs-${b.slug}`;

      const aCost = Number(a.spread_eurusd ?? 0) + Number(a.commission_value ?? 0) / 10;
      const bCost = Number(b.spread_eurusd ?? 0) + Number(b.commission_value ?? 0) / 10;
      const winner = (a.rating ?? 0) >= (b.rating ?? 0) ? a : b;
      const cheaper = aCost <= bCost ? a : b;
      const lowerDeposit = Number(a.min_deposit ?? Infinity) <= Number(b.min_deposit ?? Infinity) ? a : b;
      const fasterExecution = Number(a.execution_ms ?? Infinity) <= Number(b.execution_ms ?? Infinity) ? a : b;
      const faq = [
        { q: `Is ${a.name} or ${b.name} better?`, a: `${winner.name} currently has the higher PipRank rating in this comparison. The better choice depends on your priorities, so compare costs, regulation, platforms and account features before deciding.` },
        { q: `Which is cheaper, ${a.name} or ${b.name}?`, a: `${cheaper.name} currently has the lower estimated EUR/USD all-in cost in the PipRank dataset, based on the displayed spread and commission assumptions. Check the broker's current pricing before trading.` },
        { q: `Which broker is better for beginners?`, a: `Compare minimum deposit, platform usability, account requirements, education and customer support rather than choosing on price alone. See the individual ${a.name} and ${b.name} reviews for the detailed fit analysis.` },
        { q: `Are ${a.name} and ${b.name} available in every country?`, a: `No. Availability, legal entity, regulation and account terms can vary by country. Check the relevant PipRank country page and confirm the exact entity directly with the broker.` },
      ];
      const content = `
        <main>
          <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/compare">Compare</a> &rsaquo; <span>${esc(a.name)} vs ${esc(b.name)}</span></nav>
          <h1>${esc(a.name)} vs ${esc(b.name)}: Which Is Better in ${year}?</h1>
          <p>Compare ${esc(a.name)} and ${esc(b.name)} side by side on trading costs, regulation, minimum deposit, execution, withdrawals, leverage and platforms.</p>
          <h2>Our verdict</h2>
          <p><strong>${esc(winner.name)}</strong> currently leads this matchup on PipRank's overall rating. ${esc(cheaper.name)} has the lower estimated EUR/USD all-in cost, ${esc(lowerDeposit.name)} has the lower minimum deposit, and ${esc(fasterExecution.name)} has the faster recorded execution time.</p>
          <h2>${esc(a.name)} vs ${esc(b.name)}: Quick Comparison</h2>
          <table>
            <caption>Side-by-side comparison of ${esc(a.name)} and ${esc(b.name)}</caption>
            <thead><tr><th>Metric</th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead>
            <tbody>
              <tr><td>PipRank rating</td><td>${esc(String(a.rating ?? '—'))}/5</td><td>${esc(String(b.rating ?? '—'))}/5</td></tr>
              <tr><td>Trust score</td><td>${esc(String(a.trust_score ?? '—'))}/100</td><td>${esc(String(b.trust_score ?? '—'))}/100</td></tr>
              <tr><td>EUR/USD spread</td><td>${esc(String(a.spread_eurusd ?? '—'))} pips</td><td>${esc(String(b.spread_eurusd ?? '—'))} pips</td></tr>
              <tr><td>Estimated all-in EUR/USD cost</td><td>${esc(aCost.toFixed(2))} pips</td><td>${esc(bCost.toFixed(2))} pips</td></tr>
              <tr><td>Minimum deposit</td><td>${esc(String(a.min_deposit ?? '—'))}</td><td>${esc(String(b.min_deposit ?? '—'))}</td></tr>
              <tr><td>Execution speed</td><td>${esc(String(a.execution_ms ?? '—'))} ms</td><td>${esc(String(b.execution_ms ?? '—'))} ms</td></tr>
              <tr><td>Withdrawal test average</td><td>~${esc(String(a.withdrawal_hours ?? '—'))}h</td><td>~${esc(String(b.withdrawal_hours ?? '—'))}h</td></tr>
              <tr><td>Max leverage</td><td>${esc(a.max_leverage ?? '—')}</td><td>${esc(b.max_leverage ?? '—')}</td></tr>
              <tr><td>Platforms</td><td>${esc((a.platforms ?? []).join(', ') || '—')}</td><td>${esc((b.platforms ?? []).join(', ') || '—')}</td></tr>
            </tbody>
          </table>
          <h2>Who Should Choose ${esc(a.name)}?</h2>
          <p>${esc(a.tagline || '')} ${Array.isArray(a.best_for) && a.best_for.length ? `PipRank identifies ${esc(a.name)} for ${esc(a.best_for.slice(0, 5).join(', '))}.` : `Review its costs, regulation and account features before deciding.`}</p>
          <p><a href="/brokers/${esc(a.slug)}">Read the full ${esc(a.name)} review</a></p>
          <h2>Who Should Choose ${esc(b.name)}?</h2>
          <p>${esc(b.tagline || '')} ${Array.isArray(b.best_for) && b.best_for.length ? `PipRank identifies ${esc(b.name)} for ${esc(b.best_for.slice(0, 5).join(', '))}.` : `Review its costs, regulation and account features before deciding.`}</p>
          <p><a href="/brokers/${esc(b.slug)}">Read the full ${esc(b.name)} review</a></p>
          <h2>Regulation and Country Availability</h2>
          <p>The broker brand alone does not determine the legal entity you will contract with. Regulation, leverage, protections, products and onboarding can vary by country. Confirm the exact entity and current terms before opening an account.</p>
          <h2>How PipRank Compares Brokers</h2>
          <p>PipRank considers rating, trust, trading costs, execution, withdrawal performance and account features. The comparison is intended as decision-support, not a guarantee of future trading results.</p>
          <h2>Frequently Asked Questions</h2>
          ${faq.map((item) => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join('')}
          <h2>Related Comparisons</h2>
          <ul>${topBrokers.filter((x) => x.slug !== a.slug && x.slug !== b.slug).slice(0, 4).map((other) => { const [x,y] = [a, other].sort((m,n)=>m.slug.localeCompare(n.slug)); return `<li><a href="/compare/${esc(x.slug)}-vs-${esc(y.slug)}">${esc(x.name)} vs ${esc(y.name)}</a></li>`; }).join('')}</ul>
          <p><a href="/brokers/${esc(a.slug)}">Full ${esc(a.name)} review</a> &middot; <a href="/brokers/${esc(b.slug)}">Full ${esc(b.name)} review</a> &middot; <a href="/compare">Compare more brokers</a></p>
        </main>
      `;

      const jsonLd = [
        webPageJsonLd(title, description, path, 'WebPage'),
        breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Compare', path: '/compare' },
          { name: `${a.name} vs ${b.name}`, path },
        ]),
        faqPageJsonLd(faq),
      ];

      writePage(path, { title, description, path }, jsonLd, content, shell, writtenPaths);
      written++;
    }
  }

  log(`Wrote ${written} prerendered pages.`);
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Mirrors src/lib/team.ts — kept in sync manually, same pattern as staticPageSeo()
// below being duplicated for the client hook vs. this build-time script.
const TEAM = [
  { slug: 'r-adeyemi', penName: 'R. Adeyemi', role: 'Lead Broker Reviewer' },
  { slug: 'j-okafor', penName: 'J. Okafor', role: 'Trading Costs & Execution Editor' },
  { slug: 'l-mensah', penName: 'L. Mensah', role: 'Data & Methodology Lead' },
  { slug: 's-nwachukwu', penName: 'S. Nwachukwu', role: 'Country & Compliance Editor' },
];

function reviewerFor(brokerSlug) {
  let hash = 0;
  const s = brokerSlug || '';
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return TEAM[hash % TEAM.length];
}

function staticPageSeo(key) {
  const map = {
    brokers: { title: `Best Forex Brokers ${new Date().getFullYear()}: Full Rankings | ${SITE_NAME}`, description: 'Compare forex brokers by regulation, trading costs, platforms, execution and account features.', path: '/brokers', type: 'website' },
    countries: { title: `Best Forex Brokers by Country | ${SITE_NAME}`, description: 'Find forex brokers available in different countries.', path: '/countries', type: 'website' },
    guides: { title: `Forex Trading Guides & Education | ${SITE_NAME}`, description: 'Forex trading guides covering brokers, spreads, leverage, platforms and regulation.', path: '/guides', type: 'website' },
    compare: { title: `Compare Forex Brokers Side by Side | ${SITE_NAME}`, description: 'Compare forex brokers across spreads, fees, regulation and platforms.', path: '/compare', type: 'website' },
  };
  return map[key];
}

function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: 'Independent forex broker reviews, comparisons and trading tools.',
    url: PRODUCTION_ORIGIN,
  };
}

function webPageJsonLd(title, description, path, type) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: title,
    description,
    url: `${PRODUCTION_ORIGIN}${path}`,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: PRODUCTION_ORIGIN },
  };
}

function breadcrumbJsonLd(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${PRODUCTION_ORIGIN}${c.path === '/' ? '' : c.path}`,
    })),
  };
}

function faqPageJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

function itemListJsonLd(name, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: `${PRODUCTION_ORIGIN}${it.path}`,
    })),
  };
}

function writePage(routePath, seo, jsonLdArr, contentHtml, shell, writtenPaths) {
  writtenPaths.add(routePath || seo.path);
  const canonical = `${PRODUCTION_ORIGIN}${seo.path}`;
  const ogImage = `${PRODUCTION_ORIGIN}${DEFAULT_OG_IMAGE}`;

  let html = shell;

  // Language of the document. Defaults to the shell's own <html lang="en">
  // when the page doesn't specify one (every non-localized page).
  if (seo.lang) {
    html = html.replace(/<html lang="[^"]*">/, `<html lang="${esc(seo.lang)}">`);
  }

  // Title
  html = html.replace(/<title>.*?<\/title>/s, `<title>${esc(seo.title)}</title>`);

  // Description
  html = html.replace(/<meta name="description" content=".*?"\s*\/>/s, `<meta name="description" content="${esc(seo.description)}" />`);

  // OG tags
  html = html.replace(/<meta property="og:title" content=".*?"\s*\/>/s, `<meta property="og:title" content="${esc(seo.title)}" />`);
  html = html.replace(/<meta property="og:description" content=".*?"\s*\/>/s, `<meta property="og:description" content="${esc(seo.description)}" />`);
  html = html.replace(/<meta property="og:image" content=".*?"\s*\/>/s, `<meta property="og:image" content="${ogImage}" />`);
  if (!html.includes('og:url')) {
    html = html.replace('</head>', `<meta property="og:url" content="${canonical}" />\n</head>`);
  } else {
    html = html.replace(/<meta property="og:url" content=".*?"\s*\/>/s, `<meta property="og:url" content="${canonical}" />`);
  }

  // Twitter tags
  html = html.replace(/<meta name="twitter:title" content=".*?"\s*\/>/s, `<meta name="twitter:title" content="${esc(seo.title)}" />`);
  html = html.replace(/<meta name="twitter:description" content=".*?"\s*\/>/s, `<meta name="twitter:description" content="${esc(seo.description)}" />`);
  html = html.replace(/<meta name="twitter:image" content=".*?"\s*\/>/s, `<meta name="twitter:image" content="${ogImage}" />`);

  // Canonical (index.html has none by default — always insert fresh)
  html = html.replace('</head>', `<link rel="canonical" href="${canonical}" />\n</head>`);

  // Language alternates. Localized country pages self-canonicalize and expose
  // their English counterpart (and vice versa where configured).
  if (Array.isArray(seo.alternates)) {
    const links = seo.alternates.filter((a) => a?.hreflang && a?.path)
      .map((a) => `<link rel="alternate" hreflang="${esc(a.hreflang)}" href="${absoluteUrl(a.path)}" />`).join('\n');
    if (links) html = html.replace('</head>', `${links}\n</head>`);
  }

  // Replace the two static WebSite/Organization JSON-LD blocks with this
  // page's specific JSON-LD (WebPage/Article + Breadcrumb [+ ItemList]).
  // Organization schema stays site-wide and is re-added once, separately.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    description: 'Independent forex broker intelligence: reviews, comparisons, calculators and education.',
    email: 'hello@piprank.io',
    url: PRODUCTION_ORIGIN,
    logo: `${PRODUCTION_ORIGIN}/favicon.svg`,
  };
  const websiteLd = webSiteJsonLd();
  const jsonLdHtml = [orgLd, websiteLd, ...jsonLdArr]
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n');
  html = html.replace('</head>', `${jsonLdHtml}\n</head>`);

  // Inject the real content snapshot into #root, before the JS bundle takes
  // over. React's createRoot(...).render() replaces #root's children on
  // mount, so this is safely overwritten once the app boots — real users
  // never see a flash of unstyled content beyond the very first paint, and
  // crawlers/tools that don't execute JS see this content directly.
  html = html.replace('<div id="root"></div>', `<div id="root">${contentHtml}</div>`);

  const outDir = join(DIST, seo.path.replace(/^\//, ''));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
}

main().catch((err) => {
  console.error(`[prerender] ERROR: ${err.stack || err}`);
  process.exit(1);
});
