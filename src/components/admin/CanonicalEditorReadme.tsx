export const CANONICAL_EDITOR_ARCHITECTURE = {
  globalBestFor: ['/forex-brokers-for-beginners','/mt4-forex-brokers','/mt5-forex-brokers','/gold-forex-brokers','/low-spread-forex-brokers'],
  countryBestFor: '/{country}/{canonical-topic}',
  broker: '/brokers/{broker-slug}',
  guide: '/guides/{guide-slug} and /{country}/guides/{guide-slug}',
  legacyBestFor: '/best/* -> 301 canonical',
} as const;
