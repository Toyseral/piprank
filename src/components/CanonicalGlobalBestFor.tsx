import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Gauge, GraduationCap, MonitorSmartphone, Percent, Sparkles, Timer, Waves, Zap, type LucideIcon } from 'lucide-react';
import type { Broker, ContentDocument, FAQ, Intent } from '../lib/types';
import type { CanonicalRoute } from '../lib/canonicalHub/types';
import { fetchBrokers, fetchIntents } from '../lib/api';
import { fetchPublishedContentDocument } from '../lib/canonicalContent';
import PageBlocksRenderer from './PageBlocksRenderer';
import BrokerCard from './BrokerCard';
import Reveal from './Reveal';
import NewsletterForm from './NewsletterForm';
import { useSEO } from '../hooks/useSEO';
import { bestForPath, buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, buildWebPageJsonLd, type SeoInput } from '../lib/seo';
import { allInCost } from '../lib/score';
import { fmtMoney } from '../lib/format';
import { isBlockShape } from '../lib/contentBlocks';
import NotFound from '../pages/NotFound';
import { track } from '../lib/track';
import { useGeo } from '../lib/GeoContext';

const ICONS: Record<string, LucideIcon> = { beginners: GraduationCap, 'low-spread': Percent, mt4: MonitorSmartphone, mt5: MonitorSmartphone, ecn: Zap, 'copy-trading': Copy, scalping: Timer, 'swing-trading': Waves, 'high-leverage': Gauge, gold: Sparkles, islamic: Sparkles };

type Props = { route: CanonicalRoute };

function settingsOf(doc: ContentDocument | null) { return (doc?.settings ?? {}) as Record<string, any>; }
function faqsOf(doc: ContentDocument | null): FAQ[] { const value = settingsOf(doc).faqs; return Array.isArray(value) ? value.filter((x: any) => x?.q && x?.a) : []; }
function criteriaOf(doc: ContentDocument | null): string[] { const value = settingsOf(doc).criteria; return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function rankingIntentSlug(pageSlug: string, doc: ContentDocument | null): string {
  const explicit = settingsOf(doc).ranking_intent_slug;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().toLowerCase();
  return pageSlug
    .replace(/^forex-brokers-for-/, '')
    .replace(/-forex-brokers$/, '')
    .replace(/-brokers$/, '')
    .replace(/-forex$/, '');
}
function intentForRanking(intent: string, b: Broker) { switch (intent) { case 'low-spread': return `${b.spread_eurusd}p EUR/USD · ${allInCost(b)} pips all-in per lot`; case 'scalping': return `Scalping allowed · ${b.execution_ms}ms execution · ${b.spread_eurusd}p spread`; case 'copy-trading': return b.copy_trading ? 'Native copy-trading platform' : 'Copy via third-party signal marketplaces'; case 'mt4': return `MT4 platform · ${b.assets.forex} forex pairs · ${b.uptime}% uptime`; case 'mt5': return `Full MT5 suite · ${b.assets.forex} forex pairs · ${b.uptime}% uptime`; case 'ecn': return b.commission_value === 0 ? 'ECN-style pricing folded into the spread' : `Raw ECN pricing · $${b.commission_value.toFixed(2)}/lot commission`; case 'beginners': return `${fmtMoney(b.min_deposit)} minimum · free demo · ${b.support_channels.length} support channels`; case 'swing-trading': return `Built for multi-day holds · ${b.max_leverage} leverage`; case 'high-leverage': return `Up to ${b.max_leverage} leverage · ${fmtMoney(b.min_deposit)} minimum deposit`; case 'gold': return `${b.assets.commodities} commodities · gold trading availability`; case 'islamic': return b.islamic_account ? 'Islamic account available' : 'Islamic account not available'; default: return b.tagline; } }

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
  const ranked = useMemo(() => intent ? brokers.filter((b) => b.best_for.includes(intent.slug)).sort((a, b) => b.rating - a.rating || b.trust_score - a.trust_score) : [], [brokers, intent]);
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
    buildItemListJsonLd(doc.title, ranked.slice(0, 10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
    ...(faqs.length ? [buildFAQPageJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a })))] : []),
  ] : undefined);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-64 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  if (!doc || !doc.published) return <NotFound />;
  const settings = settingsOf(doc);
  const Icon = ICONS[String(settings.icon ?? rankingSlug)] ?? Sparkles;

  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <header className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-white sm:p-10">
      <div className="absolute inset-0 bg-grid-dark" />
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-ink-950"><Icon size={24} /></div>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-300">PipRank</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{doc.title}</h1>
        {doc.excerpt && <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{doc.excerpt}</p>}
      </div>
    </header>

    {criteria.length > 0 && <section className="mt-6 rounded-2xl border border-line bg-white p-6"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">How we ranked this list</p><ul className="mt-3 grid gap-2.5 sm:grid-cols-2">{criteria.map((c) => <li key={c} className="flex gap-2 text-sm text-slate-600"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />{c}</li>)}</ul></section>}

    {intent && ranked.length > 0 && <div className="mt-8 grid gap-5 lg:grid-cols-2">{ranked.map((b, i) => <Reveal key={b.slug}><BrokerCard broker={b} rank={i + 1} note={intentForRanking(intent.slug, b)} intent={intent.slug} /></Reveal>)}</div>}

    {(isBlockShape(doc.blocks) || doc.html) && <article className="mt-10 rounded-3xl border border-line bg-white p-6 sm:p-9">{isBlockShape(doc.blocks) ? <PageBlocksRenderer blocks={doc.blocks as any} brokers={brokers} intent={rankingSlug} className="piprank-rich-content space-y-8" /> : <div className="piprank-rich-content" dangerouslySetInnerHTML={{ __html: doc.html }} />}</article>}

    {faqs.length > 0 && <section className="mt-10 space-y-3"><h2 className="font-display text-xl font-bold">Frequently asked questions</h2>{faqs.map((f) => <details key={f.q} className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold">{f.q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{f.a}</p></details>)}</section>}

    <div className="mt-10"><NewsletterForm /></div>
  </div>;
}
