import { getCountrySeoTopic, rankCountryTopicBrokers } from '../data/countrySeoMatrix.js';

export function rankingIntentSlug(pageSlug, doc) {
  const settings = doc?.settings && typeof doc.settings === 'object' ? doc.settings : {};
  const explicit = settings.ranking_intent_slug;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().toLowerCase();
  return String(pageSlug || '').replace(/^forex-brokers-for-/, '').replace(/-forex-brokers$/, '').replace(/-brokers$/, '').replace(/-forex$/, '');
}

function settingsOf(doc) {
  return doc?.settings && typeof doc.settings === 'object' ? doc.settings : {};
}
function excludedSet(settings) {
  return new Set(Array.isArray(settings.excludedBrokerSlugs) ? settings.excludedBrokerSlugs.map(String) : []);
}

export function rankGlobalBestFor(brokers, doc, intentSlug) {
  const settings = settingsOf(doc);
  const excluded = excludedSet(settings);
  const eligible = (brokers || []).filter((broker) =>
    broker?.slug && Array.isArray(broker.best_for) && broker.best_for.includes(intentSlug) && !excluded.has(broker.slug)
  );
  if (settings.rankingMode === 'manual' && Array.isArray(settings.pinnedBrokerSlugs)) {
    const order = new Map(settings.pinnedBrokerSlugs.map((slug, index) => [String(slug), index]));
    return eligible.filter((broker) => order.has(broker.slug))
      .sort((a, b) => Number(order.get(a.slug)) - Number(order.get(b.slug)));
  }
  return [...eligible].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || Number(b.trust_score || 0) - Number(a.trust_score || 0));
}

export function rankCountryBestFor(brokers, country, doc, intentSlug, rankingRows = []) {
  const topic = getCountrySeoTopic(intentSlug);
  if (!topic || !country) return [];
  const base = rankCountryTopicBrokers(brokers || [], country, topic);
  const settings = settingsOf(doc);
  const excluded = excludedSet(settings);
  const eligiblePool = base.filter((broker) => !excluded.has(broker.slug));
  if (settings.rankingMode === 'manual' && Array.isArray(settings.pinnedBrokerSlugs)) {
    const order = new Map(settings.pinnedBrokerSlugs.map((slug, index) => [String(slug), index]));
    return eligiblePool.filter((broker) => order.has(broker.slug))
      .sort((a, b) => Number(order.get(a.slug)) - Number(order.get(b.slug)));
  }
  const rankById = new Map((rankingRows || []).map((row, index) => [
    Number(row.broker_id),
    Number.isFinite(Number(row.final_rank)) ? Number(row.final_rank) : index + 1
  ]));
  return [...eligiblePool].sort((a, b) => {
    const ar = rankById.get(Number(a.id)); const br = rankById.get(Number(b.id));
    if (ar !== undefined && br !== undefined) return ar - br;
    if (ar !== undefined) return -1;
    if (br !== undefined) return 1;
    return Number(b.rating || 0) - Number(a.rating || 0) || Number(b.trust_score || 0) - Number(a.trust_score || 0);
  });
}

export function buildBestForPageModel({ document, brokers, country, intentSlug, rankingRows = [] }) {
  const ranked = country ? rankCountryBestFor(brokers, country, document, intentSlug, rankingRows) : rankGlobalBestFor(brokers, document, intentSlug);
  const settings = settingsOf(document);
  return {
    ranked,
    top: ranked[0] || null,
    top9: ranked.slice(0, 9),
    criteria: Array.isArray(settings.criteria) ? settings.criteria.map(String).filter(Boolean) : [],
    faqs: Array.isArray(settings.faqs) ? settings.faqs.filter((faq) => faq?.q && faq?.a) : [],
    comparisonFields: Array.isArray(settings.comparisonFields) ? settings.comparisonFields : undefined,
  };
}
