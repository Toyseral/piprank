export const BROKER_INTENT_STORAGE_SLUGS = {
  'forex-brokers-for-beginners': 'beginners',
  'low-spread-forex-brokers': 'low-spread',
  'mt4-forex-brokers': 'mt4',
  'mt5-forex-brokers': 'mt5',
  'gold-forex-brokers': 'gold',
  'ecn-forex-brokers': 'ecn',
  'copy-trading-forex-brokers': 'copy-trading',
  'forex-brokers-for-scalping': 'scalping',
  'forex-brokers-for-swing-trading': 'swing-trading',
  'high-leverage-forex-brokers': 'high-leverage',
  'islamic-forex-brokers': 'islamic',
  'crypto-brokers': 'crypto-brokers',
  'eur-usd-forex-brokers': 'eur-usd-forex-brokers',
};

export const BROKER_INTENT_CANONICAL_BY_STORAGE = Object.fromEntries(
  Object.entries(BROKER_INTENT_STORAGE_SLUGS).map(([canonical, storage]) => [storage, canonical]),
);

export function exposeCanonicalBrokerIntents(bestFor) {
  const values = Array.isArray(bestFor) ? bestFor.map(String) : [];
  return [...new Set([
    ...values,
    ...values.map((value) => BROKER_INTENT_CANONICAL_BY_STORAGE[value]).filter(Boolean),
  ])];
}

export function normalizeBrokerIntentStorage(bestFor) {
  const values = Array.isArray(bestFor) ? bestFor.map(String) : [];
  return [...new Set(values.map((value) => BROKER_INTENT_STORAGE_SLUGS[value] ?? value))];
}
