import { useEffect, useMemo, useState } from 'react';
import type { Broker, ContentDocument, Intent } from '../lib/types';
import type { CanonicalRoute } from '../lib/canonicalHub/types';
import { fetchBrokers, fetchIntents } from '../lib/api';
import { fetchPublishedContentDocument } from '../lib/canonicalContent';
import BestForTemplate from './BestForTemplate';
import NotFound from '../pages/NotFound';
import { useSEO } from '../hooks/useSEO';
import { bestForPath, buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, buildWebPageJsonLd, type SeoInput } from '../lib/seo';
import { useGeo } from '../lib/GeoContext';
import { allInCost } from '../lib/score';
import { fmtMoney } from '../lib/format';
import { track } from '../lib/track';

type Props = { route: CanonicalRoute };

function settingsOf(doc: ContentDocument | null) { return (doc?.settings ?? {}) as Record<string, any>; }
function faqsOf(doc: ContentDocument | null) { const value = settingsOf(doc).faqs; return Array.isArray(value) ? value.filter((x: any) => x?.q && x?.a) : []; }
function criteriaOf(doc: ContentDocument | null): string[] { const value = settingsOf(doc).criteria; return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function rankingIntentSlug(pageSlug: string, doc: ContentDocument | null): string {
  const explicit = settingsOf(doc).ranking_intent_slug;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().toLowerCase();
  return pageSlug.replace(/^forex-brokers-for-/, '').replace(/-forex-brokers$/, '').replace(/-brokers$/, '').replace(/-forex$/, '');
}
function intentNote(intent: string, broker: Broker) {
  switch (intent) {
    case 'low-spread': return `${broker.spread_eurusd}p EUR/USD · ${allInCost(broker)} pips all-in per lot`;
    case 'scalping': return `Scalping allowed · ${broker.execution_ms}ms execution · ${broker.spread_eurusd}p spread`;
    case 'copy-trading': return broker.copy_trading ? 'Native copy-trading platform' : 'Copy via third-party signal marketplaces';
    case 'mt4': return `MT4 platform · ${broker.assets.forex} forex pairs · ${broker.uptime}% uptime`;
    case 'mt5': return `Full MT5 suite · ${broker.assets.forex} forex pairs · ${broker.uptime}% uptime`;
    case 'ecn': return broker.commission_value === 0 ? 'ECN-style pricing folded into the spread' : `Raw ECN pricing · $${broker.commission_value.toFixed(2)}/lot commission`;
    case 'beginners': return `${fmtMoney(broker.min_deposit)} minimum · free demo · ${broker.support_channels.length} support channels`;
    case 'swing-trading': return `Built for multi-day holds · ${broker.max_leverage} leverage`;
    case 'high-leverage': return `Up to ${broker.max_leverage} leverage · ${fmtMoney(broker.min_deposit)} minimum deposit`;
    case 'gold': return `${broker.assets.commodities} commodities · gold trading availability`;
    case 'islamic': return broker.islamic_account ? 'Islamic account available' : 'Islamic account not available';
    default: return broker.tagline;
  }
}

export default function CanonicalGlobalBestFor({ route }: Props) {
  const slug = route.slug ?? '';
  const { country: geoCountry } = useGeo();
  const [doc, setDoc] = useState<ContentDocument | null>(route.document ?? null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      route.document ? Promise.resolve(route.document) : fetchPublishedContentDocument(`best-for:${slug}`),
      fetchIntents().catch(() => [] as Intent[]),
      fetchBrokers(),
    ]).then(([d, allIntents, b]) => {
      const resolvedDoc = d as ContentDocument | null;
      const rankingSlug = rankingIntentSlug(slug, resolvedDoc);
      const resolvedIntent = (allIntents as Intent[]).find((candidate) => candidate.slug === rankingSlug) ?? null;
      setDoc(resolvedDoc); setIntent(resolvedIntent); setBrokers(b);
      if (resolvedIntent) track('intent_view', { intent: resolvedIntent.slug, country: geoCountry?.slug ?? 'global' });
    }).finally(() => setLoading(false));
  }, [route.document, slug, geoCountry?.slug]);

  const rankingSlug = rankingIntentSlug(slug, doc);
  const ranked = useMemo(() => intent ? brokers.filter((broker) => broker.best_for.includes(intent.slug)).sort((a, b) => b.rating - a.rating || b.trust_score - a.trust_score) : [], [brokers, intent]);
  const faqs = faqsOf(doc);
  const criteria = criteriaOf(doc);
  const seo: SeoInput | null = doc ? {
    title: doc.seo_title || `${doc.title} | PipRank`,
    description: doc.seo_description || doc.excerpt || `Compare forex brokers for ${doc.title.toLowerCase()}.`,
    path: bestForPath(slug),
    type: 'website',
    noindex: doc.indexable === false,
  } : null;

  useSEO(seo, seo && doc ? [
    buildWebPageJsonLd(seo),
    buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: doc.title, path: seo.path }]),
    buildItemListJsonLd(doc.title, ranked.slice(0, 10).map((broker) => ({ name: broker.name, path: `/brokers/${broker.slug}` }))),
    ...(faqs.length ? [buildFAQPageJsonLd(faqs.map((faq: any) => ({ question: faq.q, answer: faq.a })))] : []),
  ] : undefined);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-64 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  if (!doc || !doc.published) return <NotFound />;

  return <BestForTemplate document={doc} brokers={ranked.map((broker) => ({ ...broker, tagline: intentNote(rankingSlug, broker) }))} ranked={ranked} intentSlug={rankingSlug} criteria={criteria} faqs={faqs} />;
}
