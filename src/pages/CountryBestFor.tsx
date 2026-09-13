import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, GraduationCap, MonitorSmartphone, Percent, Timer, Waves, Zap, Gauge, type LucideIcon } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage, Intent } from '../lib/types';
import { fetchBrokers, fetchContentDocument, fetchCountry, fetchIntent } from '../lib/api';
import { allInCost } from '../lib/score';
import { fmtMoney } from '../lib/format';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, intentSeo, type SeoInput, BEST_FOR_CANONICAL } from '../lib/seo';
import { useSEO } from '../hooks/useSEO';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import BrokerCard from '../components/BrokerCard';
import Reveal from '../components/Reveal';
import NotFound from './NotFound';
import type { PageBlock } from '../components/PageBuilder';

const ICONS: Record<string, LucideIcon> = {
  beginners: GraduationCap,
  'low-spread': Percent,
  mt4: MonitorSmartphone,
  mt5: MonitorSmartphone,
  ecn: Zap,
  'copy-trading': Zap,
  scalping: Timer,
  'swing-trading': Waves,
  'high-leverage': Gauge,
  islamic: GraduationCap,
  gold: Percent,
};

function reasonFor(slug: string, b: Broker): string {
  switch (slug) {
    case 'low-spread': return `${b.spread_eurusd}p EUR/USD · ${allInCost(b)} pips all-in per lot`;
    case 'scalping': return `Scalping allowed · ${b.execution_ms}ms execution · ${b.spread_eurusd}p spread`;
    case 'mt5': return `MT5 available · ${b.assets.forex} forex pairs · ${b.uptime}% uptime`;
    case 'mt4': return `MT4 available · ${b.assets.forex} forex pairs · ${b.uptime}% uptime`;
    case 'beginners': return `${fmtMoney(b.min_deposit)} minimum · free demo · ${b.support_channels.length} support channels`;
    case 'swing-trading': return `${b.max_leverage} leverage · ${b.uptime}% uptime`;
    case 'high-leverage': return `Up to ${b.max_leverage} leverage · ${fmtMoney(b.min_deposit)} minimum deposit`;
    default: return b.tagline;
  }
}

export default function CountryBestFor() {
  const { countrySlug, slug } = useParams<{ countrySlug: string; slug: string }>();
  const [document, setDocument] = useState<ContentDocument | null>(null);
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentCountrySlug: string | undefined = countrySlug;
    const canonicalSlug: string | undefined = slug;
    if (!currentCountrySlug || !canonicalSlug) { setLoading(false); return; }
    let active = true;
    setLoading(true);

    async function load() {
      try {
        const [doc, countryRow] = await Promise.all([
          fetchContentDocument(`country-best-for:${currentCountrySlug}:${canonicalSlug}`),
          fetchCountry(currentCountrySlug),
        ]);
        if (!active || !doc || doc.content_type !== 'country-best-for' || doc.published === false || !countryRow) {
          if (active) { setDocument(null); setCountry(null); setIntent(null); }
          return;
        }

        // Always derive the intent from the canonical URL slug first. Existing
        // migrated documents may still carry retired topic_slug values.
        const resolvedIntentSlug: string | null = BEST_FOR_CANONICAL[canonicalSlug] || doc.topic_slug || null;
        if (!resolvedIntentSlug) {
          if (active) { setDocument(null); setCountry(null); setIntent(null); }
          return;
        }

        const [intentRow, brokerRows] = await Promise.all([
          fetchIntent(resolvedIntentSlug),
          fetchBrokers(),
        ]);
        if (!active) return;
        setDocument(doc);
        setCountry(countryRow as CountryPage);
        setIntent(intentRow as Intent);
        setBrokers(brokerRows ?? []);
        if (typeof window !== 'undefined') window.document.title = `${doc.title || intentRow.title} | PipRank`;
      } catch {
        if (active) { setDocument(null); setCountry(null); setIntent(null); }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [countrySlug, slug]);

  const ranked = useMemo(() => {
    if (!intent || !country) return [];
    const available = new Set((country.recommended ?? []).map(String));
    const unavailable = new Set((country.unavailable ?? []).map(String));
    return brokers
      .filter((broker) => broker.best_for.includes(intent.slug))
      .filter((broker) => available.size === 0 || available.has(String(broker.id)) || available.has(broker.slug) || !unavailable.has(String(broker.id)))
      .sort((a, b) => b.rating - a.rating || b.trust_score - a.trust_score);
  }, [brokers, country, intent]);

  const seoInput: SeoInput | null = document && intent && countrySlug ? {
    ...intentSeo(intent),
    title: document.seo_title || document.title || `${intent.title} in ${country?.name ?? countrySlug}`,
    description: document.seo_description || document.excerpt || intentSeo(intent).description,
    path: `/${countrySlug}/${slug}`,
  } : null;

  const seoJsonLd = document && intent && countrySlug && seoInput ? [
    buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: country?.name || countrySlug, path: `/${countrySlug}` }, { name: document.title || intent.title, path: seoInput.path }]),
    buildItemListJsonLd(document.title || intent.title, ranked.slice(0, 10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
    ...(Array.isArray(intent.faqs) && intent.faqs.length ? [buildFAQPageJsonLd(intent.faqs.map((faq) => ({ question: faq.q, answer: faq.a })))] : []),
  ] : undefined;

  useSEO(seoInput, seoJsonLd);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-48 animate-pulse rounded-3xl border border-line bg-white"/><div className="mt-8 h-64 animate-pulse rounded-3xl border border-line bg-white"/></div>;
  if (!document || !country || !intent) return <NotFound />;

  const Icon = ICONS[intent.slug] ?? GraduationCap;
  const blocks: PageBlock[] = Array.isArray(document.blocks) ? (document.blocks as PageBlock[]) : [];

  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10"><div className="absolute inset-0 bg-grid-dark"/><div className="relative"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-ink-950 shadow-lg shadow-emerald-500/30"><Icon size={24}/></div><p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-300">{country.flag} {country.name}</p><h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{document.title}</h1>{document.excerpt&&<p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">{document.excerpt}</p>}</div></div>
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{country.name} broker shortlist</p><h2 className="mt-1 font-display text-lg font-bold text-ink-900">Choose a broker that fits you best</h2></div>{ranked[0]&&<Link to={`/brokers/${ranked[0].slug}`} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-ink-800">Read the top pick <ArrowRight size={15}/></Link>}</div></section>
    <div className="mt-6">
      <PageBlocksRenderer blocks={blocks} brokers={ranked} countrySlug={countrySlug} intent={intent.slug} />
    </div>
    {ranked.length > 0 && <section className="mt-8"><h2 className="font-display text-2xl font-bold text-ink-950">Top {country.name} forex brokers</h2><div className="mt-4 grid gap-4">{ranked.slice(0, 5).map((broker) => <Reveal key={broker.id}><BrokerCard broker={broker} note={reasonFor(intent.slug, broker)} intent={intent.slug} countrySlug={countrySlug} /></Reveal>)}</div></section>}
  </div>;
}
