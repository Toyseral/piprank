import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, GraduationCap, MonitorSmartphone, Percent, Timer, Waves, Zap, Gauge, type LucideIcon } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage } from '../lib/types';
import { fetchBrokers, fetchCountry } from '../lib/api';
import { allInCost } from '../lib/score';
import { fmtMoney } from '../lib/format';
import { buildBreadcrumbJsonLd, buildItemListJsonLd, type SeoInput, BEST_FOR_CANONICAL } from '../lib/seo';
import { useSEO } from '../hooks/useSEO';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import BrokerCard from '../components/BrokerCard';
import Reveal from '../components/Reveal';
import NotFound from './NotFound';
import type { PageBlock } from '../components/PageBuilder';

const ICONS: Record<string, LucideIcon> = {
  beginners: GraduationCap, 'low-spread': Percent, mt4: MonitorSmartphone, mt5: MonitorSmartphone,
  ecn: Zap, 'copy-trading': Zap, scalping: Timer, 'swing-trading': Waves,
  'high-leverage': Gauge, islamic: GraduationCap, gold: Percent,
};

function reasonFor(slug: string, broker: Broker): string {
  switch (slug) {
    case 'low-spread': return `${broker.spread_eurusd}p EUR/USD · ${allInCost(broker)} pips all-in per lot`;
    case 'scalping': return `Scalping allowed · ${broker.execution_ms}ms execution · ${broker.spread_eurusd}p spread`;
    case 'mt5': return `MT5 available · ${broker.assets.forex} forex pairs · ${broker.uptime}% uptime`;
    case 'mt4': return `MT4 available · ${broker.assets.forex} forex pairs · ${broker.uptime}% uptime`;
    case 'beginners': return `${fmtMoney(broker.min_deposit)} minimum · free demo · ${broker.support_channels.length} support channels`;
    case 'swing-trading': return `${broker.max_leverage} leverage · ${broker.uptime}% uptime`;
    case 'high-leverage': return `Up to ${broker.max_leverage} leverage · ${fmtMoney(broker.min_deposit)} minimum deposit`;
    default: return broker.tagline;
  }
}

async function fetchCanonicalDocument(countrySlug: string, slug: string): Promise<ContentDocument | null> {
  const response = await fetch(`/api/content-documents?type=country-best-for&country=${encodeURIComponent(countrySlug)}&slug=${encodeURIComponent(slug)}`);
  if (!response.ok) return null;
  const data = await response.json().catch(() => []);
  if (!Array.isArray(data)) return null;
  return data.find((doc: ContentDocument) => doc.content_type === 'country-best-for' && doc.published !== false) ?? null;
}

export default function CountryBestFor() {
  const { countrySlug, slug } = useParams<{ countrySlug: string; slug: string }>();
  const [document, setDocument] = useState<ContentDocument | null>(null);
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!countrySlug || !slug) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all([fetchCanonicalDocument(countrySlug, slug), fetchCountry(countrySlug), fetchBrokers()])
      .then(([doc, countryRow, brokerRows]) => {
        if (!active) return;
        setDocument(doc);
        setCountry(countryRow ?? null);
        setBrokers(brokerRows ?? []);
      })
      .catch(() => { if (active) { setDocument(null); setCountry(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [countrySlug, slug]);

  const intentSlug = slug ? BEST_FOR_CANONICAL[slug as keyof typeof BEST_FOR_CANONICAL] ?? slug : '';
  const ranked = useMemo(() => brokers
    .filter((broker) => !intentSlug || broker.best_for.includes(intentSlug))
    .sort((a, b) => b.rating - a.rating || b.trust_score - a.trust_score), [brokers, intentSlug]);

  const seoInput: SeoInput | null = document && countrySlug && slug ? {
    title: document.seo_title || document.title,
    description: document.seo_description || document.excerpt || '',
    path: `/${countrySlug}/${slug}`,
    type: 'website',
    noindex: document.indexable === false,
  } : null;

  useSEO(seoInput, document && seoInput ? [
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: country?.name || countrySlug || '', path: `/${countrySlug}` },
      { name: document.title, path: seoInput.path },
    ]),
    buildItemListJsonLd(document.title, ranked.slice(0, 10).map((broker) => ({ name: broker.name, path: `/brokers/${broker.slug}` }))),
  ] : undefined);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-48 animate-pulse rounded-3xl border border-line bg-white"/><div className="mt-8 h-64 animate-pulse rounded-3xl border border-line bg-white"/></div>;
  if (!document || !country || !countrySlug || !slug) return <NotFound />;

  const Icon = ICONS[intentSlug] ?? GraduationCap;
  const blocks: PageBlock[] = Array.isArray(document.blocks) ? document.blocks as PageBlock[] : [];

  return <article className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <nav aria-label="Breadcrumb" className="text-xs font-medium text-slate-400"><Link to="/" className="hover:text-ink-900">Home</Link><span className="mx-1.5">/</span><Link to={`/${country.slug}`} className="hover:text-ink-900">{country.name}</Link><span className="mx-1.5">/</span><span className="text-ink-900">{document.title}</span></nav>
    <header className="mt-6 border-b border-line pb-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-ink-950"><Icon size={24}/></div>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-700">{country.flag} {country.name} · Best For</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-5xl">{document.title}</h1>
      {document.excerpt && <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-500">{document.excerpt}</p>}
    </header>
    <div className="mt-8">
      {blocks.length ? <PageBlocksRenderer blocks={blocks} brokers={ranked} intent={intentSlug} countrySlug={countrySlug} className="piprank-rich-content space-y-8"/> : <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-500">This page has no published content blocks yet.</p>}
    </div>
    {ranked.length > 0 && <section className="mt-10 border-t border-line pt-8"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Broker options</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">Top {country.name} forex brokers</h2></div>{ranked[0] && <Link to={`/brokers/${ranked[0].slug}`} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white">Read top pick <ArrowRight size={15}/></Link>}</div><div className="mt-4 grid gap-4">{ranked.slice(0, 5).map((broker) => <Reveal key={broker.id}><BrokerCard broker={broker} note={reasonFor(intentSlug, broker)} intent={intentSlug} countrySlug={countrySlug}/></Reveal>)}</div></section>}
  </article>;
}
