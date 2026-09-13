export const CANONICAL_BEST_FOR = Object.freeze({
  'forex-brokers-for-beginners': 'beginners',
  'low-spread-forex-brokers': 'low-spread',
  'mt4-forex-brokers': 'mt4',
  'mt5-forex-brokers': 'mt5',
  'gold-forex-brokers': 'gold',
  'forex-brokers-for-scalping': 'scalping',
  'islamic-forex-brokers': 'islamic',
  'ecn-forex-brokers': 'ecn',
  'copy-trading-forex-brokers': 'copy-trading',
  'forex-brokers-for-swing-trading': 'swing-trading',
  'high-leverage-forex-brokers': 'high-leverage',
});

export const CANONICAL_BEST_FOR_BY_SLUG = Object.freeze(
  Object.fromEntries(Object.entries(CANONICAL_BEST_FOR).map(([path, slug]) => [slug, path])),
);

export const CANONICAL_TYPES = Object.freeze({
  GLOBAL_BEST_FOR: 'global-best-for',
  COUNTRY_BEST_FOR: 'country-best-for',
  COUNTRY_TOPIC: 'country-topic',
  GUIDE: 'guide',
  COUNTRY_GUIDE: 'country-guide',
  BROKER: 'broker',
  COUNTRY: 'country',
  COMPARE: 'compare',
  LOCALIZED_SEO: 'localized-seo',
});
