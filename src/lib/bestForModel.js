import { getCountrySeoTopic, rankCountryTopicBrokers } from '../data/countrySeoMatrix.js';

/** @typedef {import('./types').Broker} Broker */
/** @typedef {import('./types').CountryPage} CountryPage */
/** @typedef {import('./types').CountryIntentBrokerRanking} CountryIntentBrokerRanking */

export function healthScore(broker) {
  const h = broker?.health || {};
  return Math.round(
    Number(h.regulation || 0) * 0.3 + Number(h.withdrawals || 0) * 0.2 +
    Number(h.execution || 0) * 0.15 + Number(h.longevity || 0) * 0.15 +
    Number(h.support || 0) * 0.1 + Number(h.sentiment || 0) * 0.1
  );
}
export function allInCost(broker) {
  return Math.round((Number(broker?.spread_eurusd || 0) + Number(broker?.commission_value || 0) / 10) * 100) / 100;
}
export function pipRankScore(broker) {
  const cost = Math.max(0, 100 - allInCost(broker) * 12);
  const deposit = Math.max(0, 100 - Math.min(Number(broker?.min_deposit || 0), 500) / 5);
  const trust = Number(broker?.trust_score || 0);
  const health = healthScore(broker);
  const rating = Math.min(100, Number(broker?.rating || 0) * 20);
  return Math.max(1, Math.min(99, Math.round(trust * 0.28 + health * 0.28 + cost * 0.18 + deposit * 0.08 + rating * 0.18)));
}
export function rankingIntentSlug(pageSlug, doc) {
  const settings = doc?.settings && typeof doc.settings === 'object' ? doc.settings : {};
  const explicit = settings.ranking_intent_slug;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().toLowerCase();
  return String(pageSlug || '').replace(/^forex-brokers-for-/, '').replace(/-forex-brokers$/, '').replace(/-brokers$/, '').replace(/-forex$/, '');
}
function settingsOf(doc) { return doc?.settings && typeof doc.settings === 'object' ? doc.settings : {}; }
function excludedSet(settings) { return new Set(Array.isArray(settings.excludedBrokerSlugs) ? settings.excludedBrokerSlugs.map(String) : []); }

export function rankGlobalBestFor(brokers, doc, intentSlug) {
  const settings = settingsOf(doc); const excluded = excludedSet(settings);
  const eligible = (brokers || []).filter((broker) => broker?.slug && Array.isArray(broker.best_for) && broker.best_for.includes(intentSlug) && !excluded.has(broker.slug));
  if (settings.rankingMode === 'manual' && Array.isArray(settings.pinnedBrokerSlugs)) {
    const order = new Map(settings.pinnedBrokerSlugs.map((slug, index) => [String(slug), index]));
    return eligible.filter((broker) => order.has(broker.slug)).sort((a, b) => Number(order.get(a.slug)) - Number(order.get(b.slug)));
  }
  return [...eligible].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || Number(b.trust_score || 0) - Number(a.trust_score || 0));
}

/**
 * Country + intent manual rankings are authoritative. Automatic rankings continue
 * to use the topic eligibility matrix plus the ranking engine's final ranks.
 */
export function rankCountryBestFor(brokers, country, doc, intentSlug, rankingRows = []) {
  if (!country) return [];
  const brokerById = new Map((brokers || []).map((broker) => [Number(broker.id), broker]));
  const normalizedRows = (rankingRows || []).filter((row) => row && Number.isInteger(Number(row.broker_id)));
  const manualRows = normalizedRows
    .filter((row) => Number.isInteger(Number(row.manual_rank)) && Number(row.manual_rank) >= 1 && Number(row.manual_rank) <= 9)
    .sort((a, b) => Number(a.manual_rank) - Number(b.manual_rank));
  const settings = settingsOf(doc);
  const excluded = excludedSet(settings);

  if (manualRows.length > 0) {
    return manualRows.map((row) => brokerById.get(Number(row.broker_id)))
      .filter((broker) => Boolean(broker) && !excluded.has(broker.slug));
  }

  // The public ranking API has already applied country availability, force exclusions,
  // and automatic top-9 eligibility. When rows are present, treat them as the
  // authoritative public ranking instead of recomputing from legacy country data.
  if (normalizedRows.length > 0) {
    const rankById = new Map(normalizedRows.map((row, index) => [
      Number(row.broker_id),
      Number.isFinite(Number(row.final_rank)) ? Number(row.final_rank) : index + 1
    ]));
    return normalizedRows
      .map((row) => brokerById.get(Number(row.broker_id)))
      .filter((broker) => Boolean(broker) && !excluded.has(broker.slug))
      .sort((a, b) => (rankById.get(Number(a.id)) ?? 9999) - (rankById.get(Number(b.id)) ?? 9999));
  }

  const topic = getCountrySeoTopic(intentSlug);
  if (!topic) return [];
  const base = rankCountryTopicBrokers(brokers || [], country, topic);
  const eligiblePool = base.filter((broker) => !excluded.has(broker.slug));
  const rankById = new Map();
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
    ranked, top: ranked[0] || null, top9: ranked.slice(0, 9),
    criteria: Array.isArray(settings.criteria) ? settings.criteria.map(String).filter(Boolean) : [],
    faqs: Array.isArray(settings.faqs) ? settings.faqs.filter((faq) => faq?.q && faq?.a) : [],
    comparisonFields: Array.isArray(settings.comparisonFields) ? settings.comparisonFields : undefined,
  };
}
