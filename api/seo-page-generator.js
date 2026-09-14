import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const ROLES = ['super_admin', 'admin', 'content_admin'];

const TOPICS = {
  'eur-usd-forex-brokers': { title: 'EUR/USD Forex Brokers', short: 'EUR/USD', criteria: 'EUR/USD trading' },
  'gold-forex-brokers': { title: 'Gold Forex Brokers', short: 'Gold', criteria: 'gold and commodity trading' },
  'mt5-forex-brokers': { title: 'MT5 Forex Brokers', short: 'MT5', criteria: 'MetaTrader 5 trading' },
  'low-spread-forex-brokers': { title: 'Low Spread Forex Brokers', short: 'Low Spread', criteria: 'competitive EUR/USD spreads' },
  'forex-brokers-for-beginners': { title: 'Forex Brokers for Beginners', short: 'Beginners', criteria: 'beginner-friendly trading' },
  'forex-brokers-for-scalping': { title: 'Forex Brokers for Scalping', short: 'Scalping', criteria: 'scalping' },
  'islamic-forex-brokers': { title: 'Islamic Forex Brokers', short: 'Islamic / Swap-Free', criteria: 'Islamic or swap-free accounts' },
  'copy-trading-forex-brokers': { title: 'Copy Trading Forex Brokers', short: 'Copy Trading', criteria: 'copy trading' },
  'forex-brokers-for-swing-trading': { title: 'Forex Brokers for Swing Trading', short: 'Swing Trading', criteria: 'swing trading' },
  'high-leverage-forex-brokers': { title: 'High Leverage Forex Brokers', short: 'High Leverage', criteria: 'high-leverage trading' },
  'ecn-forex-brokers': { title: 'ECN Forex Brokers', short: 'ECN', criteria: 'ECN-style accounts' },
};

const slugify = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const matches = (broker, key) => {
  const checks = {
    'eur-usd': () => Number.isFinite(Number(broker.spread_eurusd)),
    gold: () => Number(broker.assets?.commodities ?? 0) > 0,
    mt5: () => Array.isArray(broker.platforms) && broker.platforms.some((x) => String(x).toLowerCase() === 'mt5'),
    'low-spread': () => Number.isFinite(Number(broker.spread_eurusd)),
    beginners: () => Boolean(broker.demo_account) || Number(broker.min_deposit ?? 999999) <= 100 || (broker.best_for ?? []).includes('beginners'),
    scalping: () => Boolean(broker.scalping),
    islamic: () => Boolean(broker.islamic_account),
    'copy-trading': () => Boolean(broker.copy_trading),
    'swing-trading': () => (broker.best_for ?? []).includes('swing-trading'),
    'high-leverage': () => (broker.best_for ?? []).includes('high-leverage'),
    ecn: () => (broker.account_types ?? []).some((x) => /ecn/i.test(String(x))),
  };
  return Boolean(checks[key]?.());
};

function blocks(country, topic, brokers) {
  const names = brokers.slice(0, 5).map((b) => b.name).join(', ');
  return [
    { id: `h-${Date.now()}`, type: 'heading', title: `${topic.title} in ${country.name}` },
    { id: `t-${Date.now()}`, type: 'richtext', html: `<p>This PipRank page compares ${topic.title.toLowerCase()} available to traders in ${country.name}. The shortlist starts with brokers recommended for ${country.name}, then applies the ${topic.criteria} criteria for this page.</p>` },
    { id: `b-${Date.now()}`, type: 'richtext', html: `<p>Current qualifying brokers: ${names || 'No broker currently meets the eligibility threshold.'}</p>` },
    { id: `m-${Date.now()}`, type: 'heading', title: 'How PipRank evaluates this page' },
    { id: `x-${Date.now()}`, type: 'richtext', html: `<p>PipRank considers country availability first, then applies the trading intent, regulation, costs, platforms and account features relevant to ${topic.criteria}.</p>` },
  ];
}

function faqs(country, topic) {
  return [
    { q: `What are the best ${topic.short} forex brokers in ${country.name}?`, a: `PipRank starts with brokers recommended for traders in ${country.name}, then filters them against the ${topic.criteria} criteria.` },
    { q: `How does PipRank rank ${topic.short.toLowerCase()} brokers in ${country.name}?`, a: `We establish the country-specific broker pool first, then compare relevant broker data such as spreads, platforms, account features and minimum deposits.` },
    { q: `Can forex broker conditions differ in ${country.name}?`, a: `Yes. Legal entities, regulators, leverage, payment methods and account conditions can differ by country. Confirm the current terms before opening an account.` },
  ];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const actor = await requireRole(req, res, ROLES);
  if (!actor) return;

  const countrySlug = slugify(req.body?.country_slug);
  const topicSlug = slugify(req.body?.topic_slug);
  const topic = TOPICS[topicSlug];
  if (!countrySlug || !topic) return res.status(400).json({ error: 'Valid country_slug and supported topic_slug are required' });

  const [{ data: country, error: countryError }, { data: brokers, error: brokerError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from('countries').select('*').eq('slug', countrySlug).maybeSingle(),
    supabase.from('brokers').select('*'),
    supabase.from('content_documents').select('id,content_key').eq('content_key', `country-best-for:${countrySlug}:${topicSlug}`).maybeSingle(),
  ]);
  if (countryError) throw countryError;
  if (brokerError) throw brokerError;
  if (existingError) throw existingError;
  if (!country) return res.status(404).json({ error: `Country not found: ${countrySlug}` });
  if (existing) return res.status(409).json({ error: 'This SEO page already exists', document: existing });

  const recommended = Array.isArray(country.recommended) ? country.recommended.map((x) => typeof x === 'string' ? x : x?.slug).filter(Boolean) : [];
  const unavailable = new Set(Array.isArray(country.unavailable) ? country.unavailable.map(String) : []);
  const pool = (brokers || []).filter((b) => recommended.includes(b.slug) && !unavailable.has(b.slug));
  const key = topicSlug.replace(/-forex-brokers(?:-for-)?/g, '').replace(/-brokers/g, '');
  const qualifying = pool.filter((b) => matches(b, key));
  const minBrokers = 2;
  const eligible = qualifying.length >= minBrokers;
  const year = new Date().getFullYear();
  const title = `${topic.title} in ${country.name}`;
  const faq = faqs(country, topic);

  const payload = {
    content_key: `country-best-for:${countrySlug}:${topicSlug}`,
    content_type: 'country-best-for',
    country_slug: countrySlug,
    topic_slug: topicSlug,
    slug: topicSlug,
    title,
    excerpt: `Compare ${topic.title.toLowerCase()} available to traders in ${country.name}.`,
    html: '',
    blocks: blocks(country, topic, qualifying),
    seo_title: `Best ${topic.title} in ${country.name} ${year} | PipRank`,
    seo_description: `Compare ${topic.title.toLowerCase()} available to traders in ${country.name}, including country-specific broker recommendations, costs, platforms and key trading features.`,
    indexable: eligible,
    published: false,
    settings: {
      rankingMode: 'auto',
      pinnedBrokerSlugs: [],
      excludedBrokerSlugs: [],
      faqs: faq,
      internalLinks: [
        { label: `Best Forex Brokers in ${country.name}`, href: `/${countrySlug}` },
        { label: 'Find My Broker', href: '/quiz' },
      ],
      generator: { version: 2, generatedAt: new Date().toISOString(), qualifyingBrokerCount: qualifying.length, minBrokers, eligibleForIndexing: eligible, actor: actor.email },
    },
    updated_by: actor.email,
  };

  const { data, error } = await supabase.from('content_documents').insert(payload).select().single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This SEO page already exists' });
    throw error;
  }
  return res.status(201).json({ document: data, qualifyingBrokerCount: qualifying.length, eligibleForIndexing: eligible });
}
