// PipRank Phase 10: country-first SEO matrix.
// This registry is intentionally data-driven so the same eligibility rules can
// be used by the React page, prerenderer and sitemap generator.

export const COUNTRY_SEO_MATRIX_VERSION = '10.0.0';

const baseTopics = [
  { key: 'eur-usd', slug: 'eur-usd-forex-brokers', title: 'EUR/USD Forex Brokers', shortTitle: 'EUR/USD', dimensions: ['instrument'], priority: 100 },
  { key: 'gold', slug: 'gold-forex-brokers', title: 'Gold Forex Brokers', shortTitle: 'Gold', dimensions: ['instrument'], priority: 95 },
  { key: 'mt5', slug: 'mt5-forex-brokers', title: 'MT5 Forex Brokers', shortTitle: 'MT5', dimensions: ['platform'], priority: 100 },
  { key: 'mt4', slug: 'mt4-forex-brokers', title: 'MT4 Forex Brokers', shortTitle: 'MT4', dimensions: ['platform'], priority: 100 },
  { key: 'low-spread', slug: 'low-spread-forex-brokers', title: 'Low Spread Forex Brokers', shortTitle: 'Low Spreads', dimensions: ['cost'], priority: 95 },
  { key: 'beginners', slug: 'forex-brokers-for-beginners', title: 'Forex Brokers for Beginners', shortTitle: 'Beginners', dimensions: ['trader'], priority: 90 },
  { key: 'scalping', slug: 'forex-brokers-for-scalping', title: 'Forex Brokers for Scalping', shortTitle: 'Scalping', dimensions: ['strategy'], priority: 95 },
  { key: 'islamic', slug: 'islamic-forex-brokers', title: 'Islamic Forex Brokers', shortTitle: 'Islamic / Swap-Free', dimensions: ['account'], priority: 85 },
  { key: 'low-deposit', slug: 'low-minimum-deposit-forex-brokers', title: 'Low Minimum Deposit Forex Brokers', shortTitle: 'Low Minimum Deposit', dimensions: ['cost'], priority: 85 },
  { key: 'copy-trading', slug: 'copy-trading-forex-brokers', title: 'Copy Trading Forex Brokers', shortTitle: 'Copy Trading', dimensions: ['feature'], priority: 80 },
  { key: 'demo', slug: 'forex-brokers-with-demo-accounts', title: 'Forex Brokers with Demo Accounts', shortTitle: 'Demo Accounts', dimensions: ['feature'], priority: 75 },
  { key: 'hedging', slug: 'forex-brokers-for-hedging', title: 'Forex Brokers for Hedging', shortTitle: 'Hedging', dimensions: ['strategy'], priority: 70 },
  { key: 'raw-spread', slug: 'raw-spread-forex-brokers', title: 'Raw Spread Forex Brokers', shortTitle: 'Raw Spread', dimensions: ['cost', 'account'], priority: 80 },
  { key: 'ecn', slug: 'ecn-forex-brokers', title: 'ECN Forex Brokers', shortTitle: 'ECN', dimensions: ['account'], priority: 75 },
  { key: 'standard', slug: 'standard-account-forex-brokers', title: 'Standard Account Forex Brokers', shortTitle: 'Standard Accounts', dimensions: ['account'], priority: 70 },
  { key: 'swing-trading', slug: 'forex-brokers-for-swing-trading', title: 'Forex Brokers for Swing Trading', shortTitle: 'Swing Trading', dimensions: ['strategy'], priority: 75 },
  { key: 'high-leverage', slug: 'high-leverage-forex-brokers', title: 'High Leverage Forex Brokers', shortTitle: 'High Leverage', dimensions: ['account'], priority: 75 },
];

const comboTopics = [
  { key: 'eur-usd-mt5', slug: 'eur-usd-mt5-forex-brokers', title: 'EUR/USD MT5 Forex Brokers', shortTitle: 'EUR/USD MT5', requirements: ['eur-usd', 'mt5'], dimensions: ['instrument', 'platform'], priority: 88 },
  { key: 'eur-usd-scalping', slug: 'eur-usd-forex-brokers-for-scalping', title: 'EUR/USD Forex Brokers for Scalping', shortTitle: 'EUR/USD Scalping', requirements: ['eur-usd', 'scalping'], dimensions: ['instrument', 'strategy'], priority: 86 },
  { key: 'gold-mt5', slug: 'mt5-gold-forex-brokers', title: 'MT5 Gold Forex Brokers', shortTitle: 'MT5 Gold', requirements: ['gold', 'mt5'], dimensions: ['instrument', 'platform'], priority: 86 },
  { key: 'gold-scalping', slug: 'gold-forex-brokers-for-scalping', title: 'Gold Forex Brokers for Scalping', shortTitle: 'Gold Scalping', requirements: ['gold', 'scalping'], dimensions: ['instrument', 'strategy'], priority: 84 },
  { key: 'mt5-scalping', slug: 'mt5-forex-brokers-for-scalping', title: 'MT5 Forex Brokers for Scalping', shortTitle: 'MT5 Scalping', requirements: ['mt5', 'scalping'], dimensions: ['platform', 'strategy'], priority: 90 },
  { key: 'low-spread-mt5', slug: 'low-spread-mt5-forex-brokers', title: 'Low Spread MT5 Forex Brokers', shortTitle: 'Low Spread MT5', requirements: ['low-spread', 'mt5'], dimensions: ['cost', 'platform'], priority: 88 },
  { key: 'low-spread-scalping', slug: 'low-spread-forex-brokers-for-scalping', title: 'Low Spread Forex Brokers for Scalping', shortTitle: 'Low Spread Scalping', requirements: ['low-spread', 'scalping'], dimensions: ['cost', 'strategy'], priority: 88 },
  { key: 'islamic-mt5', slug: 'islamic-mt5-forex-brokers', title: 'Islamic MT5 Forex Brokers', shortTitle: 'Islamic MT5', requirements: ['islamic', 'mt5'], dimensions: ['account', 'platform'], priority: 78 },
  { key: 'beginner-mt5', slug: 'mt5-forex-brokers-for-beginners', title: 'MT5 Forex Brokers for Beginners', shortTitle: 'MT5 for Beginners', requirements: ['beginners', 'mt5'], dimensions: ['trader', 'platform'], priority: 78 },
  { key: 'gold-low-spread', slug: 'low-spread-gold-forex-brokers', title: 'Low Spread Gold Forex Brokers', shortTitle: 'Low Spread Gold', requirements: ['gold', 'low-spread'], dimensions: ['instrument', 'cost'], priority: 82 },
];

export const countrySeoTopics = [...baseTopics, ...comboTopics].map((topic) => ({
  ...topic,
  indexable: true,
  minBrokers: topic.requirements?.length ? 2 : 1,
}));

export function getCountrySeoTopic(slug) {
  return countrySeoTopics.find((topic) => topic.slug === slug) ?? null;
}

export function brokerMatchesTopic(broker, topicOrKey) {
  const topic = typeof topicOrKey === 'string'
    ? countrySeoTopics.find((item) => item.key === topicOrKey)
    : topicOrKey;
  if (!topic || !broker) return false;
  const checks = {
    'eur-usd': () => Number.isFinite(Number(broker.spread_eurusd)) && Number(broker.spread_eurusd) >= 0,
    gold: () => Number(broker.assets?.commodities ?? 0) > 0,
    mt5: () => Array.isArray(broker.platforms) && broker.platforms.some((p) => String(p).toLowerCase() === 'mt5'),
    mt4: () => Array.isArray(broker.platforms) && broker.platforms.some((p) => String(p).toLowerCase() === 'mt4'),
    'low-spread': () => Number.isFinite(Number(broker.spread_eurusd)),
    beginners: () => Boolean(broker.demo_account) || Number(broker.min_deposit ?? 999999) <= 100 || (broker.best_for ?? []).includes('beginners'),
    scalping: () => Boolean(broker.scalping),
    islamic: () => Boolean(broker.islamic_account),
    'low-deposit': () => Number(broker.min_deposit ?? 999999) <= 100,
    'copy-trading': () => Boolean(broker.copy_trading),
    demo: () => Boolean(broker.demo_account),
    hedging: () => Boolean(broker.hedging),
    'raw-spread': () => (broker.account_types ?? []).some((a) => /raw|raw spread/i.test(String(a))),
    ecn: () => (broker.account_types ?? []).some((a) => /ecn/i.test(String(a))),
    standard: () => (broker.account_types ?? []).some((a) => /standard/i.test(String(a))),
    'swing-trading': () => (broker.best_for ?? []).includes('swing-trading'),
    'high-leverage': () => (broker.best_for ?? []).includes('high-leverage'),
  };
  const requirements = topic.requirements ?? [topic.key];
  return requirements.every((requirement) => checks[requirement]?.() === true);
}

export function rankCountryTopicBrokers(brokers, country, topic) {
  const recommendedSlugs = Array.isArray(country?.recommended) ? country.recommended.map((x) => x.slug) : [];
  const countryPool = brokers.filter((broker) => recommendedSlugs.includes(broker.slug));
  const eligible = countryPool.filter((broker) => brokerMatchesTopic(broker, topic));
  return eligible.sort((a, b) => {
    const ai = recommendedSlugs.indexOf(a.slug);
    const bi = recommendedSlugs.indexOf(b.slug);
    if (ai >= 0 && bi >= 0 && ai !== bi) return ai - bi;
    if (topic.key.includes('low-spread') || topic.key === 'eur-usd') {
      return (Number(a.spread_eurusd ?? 999) - Number(b.spread_eurusd ?? 999)) || (Number(b.rating ?? 0) - Number(a.rating ?? 0));
    }
    if (topic.key === 'low-deposit') {
      return (Number(a.min_deposit ?? 999999) - Number(b.min_deposit ?? 999999)) || (Number(b.rating ?? 0) - Number(a.rating ?? 0));
    }
    return Number(b.rating ?? 0) - Number(a.rating ?? 0) || Number(b.trust_score ?? 0) - Number(a.trust_score ?? 0);
  });
}

export function topicMeta(topic, country) {
  const year = new Date().getFullYear();
  return {
    metaTitle: `Best ${topic.title} in ${country} ${year} | PipRank`,
    description: `Compare ${topic.title.toLowerCase()} available to traders in ${country}. See country-specific broker recommendations, costs, platforms and key trading features.`,
  };
}

export function topicIntro(topic, country) {
  const dimensionText = topic.dimensions.join(' and ');
  return [
    `Compare ${topic.title.toLowerCase()} available to traders in ${country}. PipRank starts with brokers specifically recommended for ${country}, then filters them for the ${dimensionText} criteria represented by this page.`,
    `Broker availability, pricing, regulation, platforms, account types and trading conditions can differ by country. Check the exact legal entity and current terms available to residents of ${country} before opening an account.`,
  ];
}

export function topicFaq(topic, country) {
  return [
    { q: `What are the best ${topic.shortTitle} forex brokers in ${country}?`, a: `PipRank starts with the brokers currently recommended for traders in ${country}, then filters them against the ${topic.shortTitle.toLowerCase()} criteria for this page. The best option can still depend on your trading style, costs and platform preference.` },
    { q: `How does PipRank rank ${topic.shortTitle.toLowerCase()} brokers in ${country}?`, a: `PipRank uses the country-specific broker set first, then applies the page criteria and compares relevant broker data such as spreads, platforms, account features, minimum deposits and overall broker quality.` },
    { q: `Can forex broker terms differ by country?`, a: `Yes. The legal entity, regulator, leverage, payment methods, account types and available instruments can differ by country. Always confirm the current terms for residents of ${country}.` },
  ];
}

export function topicNote(topic, broker) {
  if (topic.key.includes('low-spread') || topic.key === 'eur-usd') return `${broker.spread_eurusd ?? '—'}p EUR/USD spread`;
  if (topic.key.includes('low-deposit')) return `Minimum deposit: $${broker.min_deposit ?? '—'}`;
  if (topic.key.includes('mt5')) return 'MT5 available';
  if (topic.key.includes('scalping')) return 'Scalping supported';
  if (topic.key.includes('islamic')) return 'Islamic account available';
  if (topic.key.includes('gold')) return 'Commodity trading available';
  if (topic.key === 'copy-trading') return 'Copy trading available';
  if (topic.key === 'demo') return 'Demo account available';
  return 'Country-specific broker match';
}
