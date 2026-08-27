// Central SEO metadata builder.
//
// This is the single source of truth for page titles, meta descriptions,
// canonical URLs and JSON-LD structured data across the whole site. It is
// imported by:
//   1. src/hooks/useSEO.ts   — applies metadata client-side on every route
//                               change (covers JS-executing crawlers and
//                               real users navigating via the SPA router)
//   2. scripts/prerender.mjs — applies the exact same metadata server-side
//                               into the static HTML shipped for each URL
//                               (covers non-JS crawlers, social-share
//                               scrapers, and first-paint content)
//
// Keeping both in one place guarantees the prerendered HTML and the
// client-rendered result never drift apart.

export const SITE_NAME = 'PipRank';

// The final production domain is intentionally configurable. Set VITE_SITE_URL
// when the permanent domain is chosen. Preview builds are blocked from indexing
// by the generated robots/noindex safeguards.
const configuredSiteUrl = (import.meta.env.VITE_SITE_URL ?? '').trim();

// The final production domain has intentionally not been chosen yet. Keep the
// origin configurable; in the browser fall back to the current origin so local
// development and temporary deployments never inherit a hard-coded domain.
export const PRODUCTION_ORIGIN = configuredSiteUrl
  ? configuredSiteUrl.replace(/\/+$/, '')
  : (typeof window !== 'undefined' ? window.location.origin : '');

export const DEFAULT_OG_IMAGE = '/images/hero-terminal.png';

export interface SeoInput {
  title: string;
  description: string;
  path: string; // e.g. "/brokers/vantage" — no origin, no trailing slash
  ogImage?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  alternates?: { hreflang: string; path: string }[];
  /** BCP-47 language tag (e.g. "vi", "vi-VN"). Sets <html lang>; defaults to "en" when omitted. */
  lang?: string;
}

export interface Breadcrumb {
  name: string;
  path: string; // e.g. "/brokers"
}

export function absoluteUrl(path: string): string {
  const clean = path === '/' ? '' : path.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(path)) return path;
  return `${PRODUCTION_ORIGIN}${clean}`;
}

export function buildBreadcrumbJsonLd(crumbs: Breadcrumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export function buildWebPageJsonLd(input: SeoInput) {
  return {
    '@context': 'https://schema.org',
    '@type': input.type === 'article' ? 'Article' : 'WebPage',
    name: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: PRODUCTION_ORIGIN,
    },
  };
}


export function buildFAQPageJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function buildItemListJsonLd(name: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.path),
    })),
  };
}

// ---------------------------------------------------------------------------
// Per-entity metadata builders. Each mirrors the shape of the corresponding
// Supabase row so the exact same function works whether called client-side
// (from fetched API data) or at build time (from a direct Supabase query).
// ---------------------------------------------------------------------------

interface BrokerLike {
  name: string;
  slug: string;
  tagline?: string | null;
  rating?: number | null;
  min_deposit?: number | null;
  spread_eurusd?: number | null;
  max_leverage?: string | null;
}


export function intentSeo(i: { title: string; slug: string; meta_title?: string | null; meta_description?: string | null; intro?: string[]; indexable?: boolean }): SeoInput {
  const year = new Date().getFullYear();
  return {
    title: i.meta_title || `${i.title}${/\b20\d{2}\b/.test(i.title) ? '' : ` ${year}`} | ${SITE_NAME}`,
    description: i.meta_description || i.intro?.[0] || `Compare the best forex brokers for ${i.title.toLowerCase().replace(/^best forex brokers for\s*/i, '')}.`,
    path: `/best/${i.slug}`,
    type: 'website',
    noindex: i.indexable === false,
  };
}

export function countryBestForSeo(countrySlug: string, p: { title: string; slug: string; meta_title?: string | null; meta_description?: string | null; intro?: string[]; indexable?: boolean }): SeoInput {
  const year = new Date().getFullYear();
  return {
    title: p.meta_title || `${p.title}${/\b20\d{2}\b/.test(p.title) ? '' : ` ${year}`} | ${SITE_NAME}`,
    description: p.meta_description || p.intro?.[0] || `${p.title} — country-specific forex broker recommendations and comparison from ${SITE_NAME}.`,
    path: `/countries/${countrySlug}/best/${p.slug}`,
    type: 'website',
    noindex: p.indexable === false,
  };
}
export function brokerSeo(b: BrokerLike): SeoInput {
  const year = new Date().getFullYear();
  return {
    title: `${b.name} Review ${year}: Spreads, Fees & Verdict | ${SITE_NAME}`,
    description:
      b.tagline && b.tagline !== 'New broker under review'
        ? `${b.name} review: ${b.tagline} Real-money tested spreads, leverage, fees and withdrawal times — see if ${b.name} is right for you.`
        : `In-depth ${b.name} review: real-money tested spreads from ${b.spread_eurusd ?? '—'} pips, minimum deposit, leverage up to ${b.max_leverage ?? '—'}, and verified fees. Independently scored by ${SITE_NAME}.`,
    path: `/brokers/${b.slug}`,
    type: 'article',
  };
}

interface CountryLike {
  name: string;
  slug: string;
  subtitle?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
}

export function countrySeo(c: CountryLike, pathOverride?: string): SeoInput {
  const year = new Date().getFullYear();
  return {
    title: c.seo_title?.trim() || `Best Forex Brokers in ${c.name} ${year} | ${SITE_NAME}`,
    description:
      c.seo_description?.trim() || (c.subtitle && c.subtitle.trim()
        ? `${c.subtitle} Compare regulated forex brokers available to traders in ${c.name}, with real-money tested spreads and fees.`
        : `Compare the best forex brokers available to traders in ${c.name}. Regulation, spreads, deposit methods and verdicts — independently tested by ${SITE_NAME}.`),
    path: pathOverride || `/countries/${c.slug}`,
    type: 'website',
  };
}

interface GuideLike {
  title: string;
  slug: string;
  excerpt?: string | null;
  category?: string | null;
}

export function guideSeo(g: GuideLike): SeoInput {
  return {
    title: `${g.title} | ${SITE_NAME} Guides`,
    description: g.excerpt && g.excerpt.trim() ? g.excerpt : `${g.title} — a ${g.category ?? 'trading'} guide from ${SITE_NAME}.`,
    path: `/guides/${g.slug}`,
    type: 'article',
  };
}

export function comparePairSeo(a: BrokerLike, b: BrokerLike): SeoInput {
  const year = new Date().getFullYear();
  return {
    title: `${a.name} vs ${b.name} (${year}): Which Is Better? | ${SITE_NAME}`,
    description: `${a.name} vs ${b.name} head-to-head: spreads, fees, leverage, regulation and execution speed compared side by side, with a clear verdict.`,
    path: `/compare/${a.slug}-vs-${b.slug}`,
    type: 'article',
  };
}

export const staticPageSeo = {
  brokers: {
    title: `Best Forex Brokers ${new Date().getFullYear()}: Full Rankings | ${SITE_NAME}`,
    description: 'Every broker in our directory, ranked by real-money tested spreads, execution speed, regulation and fees. Filter and compare in seconds.',
    path: '/brokers',
    type: 'website' as const,
  },
  countries: {
    title: `Best Forex Brokers by Country | ${SITE_NAME}`,
    description: 'Find the best regulated forex brokers available in your country, with local payment methods, tax notes and verified availability.',
    path: '/countries',
    type: 'website' as const,
  },
  guides: {
    title: `Forex Trading Guides & Education | ${SITE_NAME}`,
    description: 'Learn how spreads, leverage, execution and regulation actually work, from beginner basics to advanced strategy — written by traders who test brokers for a living.',
    path: '/guides',
    type: 'website' as const,
  },
  compare: {
    title: `Compare Forex Brokers Side by Side | ${SITE_NAME}`,
    description: 'Pick any two brokers and see a full side-by-side breakdown of spreads, fees, leverage, execution speed and regulation.',
    path: '/compare',
    type: 'website' as const,
  },
  about: {
    title: `About PipRank: Editorial Policy, Methodology & Affiliate Disclosure | ${SITE_NAME}`,
    description: 'How PipRank works: our editorial independence policy, how we make money, broker review and scoring methodology, data sources, update cadence, corrections policy and reviewer information.',
    path: '/about',
    type: 'website' as const,
  },
};
