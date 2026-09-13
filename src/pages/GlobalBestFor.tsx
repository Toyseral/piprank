import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, Check, Copy, Gauge, GraduationCap, MonitorSmartphone, Percent, Timer, Waves, Zap, type LucideIcon } from 'lucide-react';
import type { Broker, ContentDocument, Intent } from '../lib/types';
import { fetchBrokers, fetchContentDocument, fetchIntent } from '../lib/api';
import { allInCost } from '../lib/score';
import { fmtMoney } from '../lib/format';
import { BEST_FOR_CANONICAL, bestForPath, intentSeo, buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, type SeoInput } from '../lib/seo';
import { useSEO } from '../hooks/useSEO';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import BrokerCard from '../components/BrokerCard';
import Reveal from '../components/Reveal';
import NotFound from './NotFound';

const ICONS: Record<string, LucideIcon> = {
  beginners: GraduationCap,
  'low-spread': Percent,
  mt5: MonitorSmartphone,
  ecn: Zap,
  'copy-trading': Copy,
  scalping: Timer,
  'swing-trading': Waves,
  'high-leverage': Gauge,
};

function reasonFor(slug: string, b: Broker): string {
  switch (slug) {
    case 'low-spread': return `${b.spread_eurusd}p EUR/USD · ${allInCost(b)} pips all-in per lot`;
    case 'scalping': return `Scalping allowed · ${b.execution_ms}ms execution · ${b.spread_eurusd}p spread`;
    case 'copy-trading': return b.copy_trading ? 'Native copy-trading platform with verified strategy stats' : 'Copy via third-party signal marketplaces';
    case 'mt5': return `Full MT5 suite · ${b.assets.forex} forex pairs · ${b.uptime}% uptime`;
    case 'ecn': return b.commission_value === 0 ? 'ECN-style pricing folded into the spread' : `Raw ECN pricing · $${b.commission_value.toFixed(2)}/lot commission`;
    case 'beginners': return `${fmtMoney(b.min_deposit)} minimum · free demo · ${b.support_channels.length} support channels`;
    case 'swing-trading': return `Built for multi-day holds · ${b.max_leverage} leverage · ${b.uptime}% uptime`;
    case 'high-leverage': return `Up to ${b.max_leverage} leverage · ${fmtMoney(b.min_deposit)} minimum deposit`;
    default: return b.tagline;
  }
}

export default function GlobalBestFor() {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const { pathname } = useLocation();
  const slug = paramSlug ?? Object.entries(BEST_FOR_CANONICAL).find(([, canonical]) => canonical === pathname.slice(1))?.[0];
  const [document, setDocument] = useState<ContentDocument | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) { setMissing(true); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setMissing(false);
    Promise.all([fetchContentDocument(`best-for:${slug}`), fetchIntent(slug), fetchBrokers()])
      .then(([doc, intentRow, brokerRows]) => {
        if (!active) return;
        if (!doc || !doc.published || doc.content_type !== 'global-best-for') {
          setMissing(true);
          return;
        }
        setDocument(doc);
        setIntent(intentRow as Intent);
        setBrokers(brokerRows ?? []);
        documentTitle(doc.title || intentRow.title);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Unable to load this page');
        setMissing(true);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const ranked = useMemo(() => {
    if (!intent) return [];
    return brokers.filter((broker) => broker.best_for.includes(intent.slug)).sort((a, b) => b.rating - a.rating || b.trust_score - a.trust_score);
  }, [brokers, intent]);

  const seoInput: SeoInput | null = document && intent ? {
    ...intentSeo(intent),
    title: document.seo_title || document.title || intentSeo(intent).title,
    description: document.seo_description || document.excerpt || intentSeo(intent).description,
    path: bestForPath(intent.slug),
  } : null;

  const seoJsonLd = document && intent && seoInput ? [
    buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: document.title || intent.title, path: seoInput.path }]),
    buildItemListJsonLd(document.title || intent.title, ranked.slice(0, 10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
    ...(Array.isArray(intent.faqs) && intent.faqs.length ? [buildFAQPageJsonLd(intent.faqs.map((faq) => ({ question: faq.q, answer: faq.a })))] : []),
  ] : undefined;

  useSEO(seoInput, seoJsonLd);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-48 animate-pulse rounded-3xl border border-line bg-white"/><div className="mt-8 h-64 animate-pulse rounded-3xl border border-line bg-white"/></div>;
  if (missing || !document || !intent) return <NotFound />;

  const Icon = ICONS[intent.slug] ?? GraduationCap;
  const blocks = Array.isArray(document.blocks) ? document.blocks : [];

  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10"><div className="absolute inset-0 bg-grid-dark"/><div className="relative"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-ink-950 shadow-lg shadow-emerald-500/30"><Icon size={24}/></div><p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-300">PipRank</p><h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{document.title}</h1>{document.excerpt&&<p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">{document.excerpt}</p>}</div></div>
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your next step</p><h2 className="mt-1 font-display text-lg font-bold text-ink-900">Choose the broker that fits you best</h2></div>{ranked[0]&&<Link to={`/brokers/${ranked[0].slug}`} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-ink-800">Read the top pick <ArrowRight size={15}/></Link>}</div></section>
    <div className="mt-6 rounded-2xl border border-line bg-white p-6"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">How we ranked this list</p><ul className="mt-3 grid gap-2.5 sm:grid-cols-2">{intent.criteria.map((criterion)=><li key={criterion} className="flex gap-2.5 text-sm text-slate-600"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3}/>{criterion}</li>)}</ul></div>
    <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">{ranked.map((broker,index)=><Reveal key={broker.slug} delay={Math.min(index,5)*0.05}><BrokerCard broker={broker} rank={index+1} note={reasonFor(intent.slug,broker)} intent={intent.slug}/></Reveal>)}</div>
    {blocks.length>0&&<section className="mt-10" aria-label="Editorial content"><PageBlocksRenderer blocks={blocks as any} brokers={brokers} intent={intent.slug} className="piprank-rich-content space-y-8"/></section>}
    {Array.isArray(intent.faqs)&&intent.faqs.length>0&&<section className="mt-10 rounded-2xl border border-line bg-white p-6"><h2 className="font-display text-xl font-bold text-ink-900">Frequently Asked Questions</h2><div className="mt-4 divide-y divide-line">{intent.faqs.map((faq,index)=><details key={`${faq.q}-${index}`} className="py-4"><summary className="cursor-pointer text-sm font-bold text-ink-900">{faq.q}</summary><p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p></details>)}</div></section>}
    {error&&<p className="mt-4 text-sm text-rose-600">{error}</p>}
  </div>;
}

function documentTitle(title: string) { if (typeof document !== 'undefined') document.title = `${title} | PipRank`; }
