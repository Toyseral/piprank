import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Building2, CircleDollarSign, Globe2, Monitor, ShieldCheck } from 'lucide-react';
import type { Broker, BrokerContent, ContentDocument, Review } from '../lib/types';
import type { PageBlock } from '../components/PageBuilder';
import { fetchBroker, fetchBrokerContent, fetchContentDocument, fetchReviews } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { pipRankScore } from '../lib/score';
import BrokerCard from '../components/BrokerCard';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import PipRankVerdictCard from '../components/PipRankVerdictCard';
import VisitButton from '../components/VisitButton';
import MatchCTA from '../components/piprank/MatchCTA';
import { useSEO } from '../hooks/useSEO';

function FixedDataCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-6"><div className="flex items-center gap-3 border-b border-line pb-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</span><h2 className="font-display text-xl font-bold text-ink-950">{title}</h2></div><div className="pt-5">{children}</div></section>;
}

function TextList({ items }: { items?: string[] }) {
  const values = (items ?? []).filter(Boolean);
  if (!values.length) return <p className="text-sm text-slate-500">No editorial information has been published for this section yet.</p>;
  return <div className="space-y-3">{values.map((text, i) => <p key={`${i}-${text.slice(0, 20)}`} className="text-[15px] leading-7 text-slate-700">{text}</p>)}</div>;
}

function SystemFacts({ broker }: { broker: Broker }) {
  const facts = [['Rating', `${broker.rating.toFixed(1)} / 5`], ['Trust score', `${broker.trust_score}/100`], ['Minimum deposit', fmtMoney(broker.min_deposit)], ['EUR/USD spread', `${broker.spread_eurusd} pips`], ['Maximum leverage', broker.max_leverage], ['Founded', String(broker.founded)]];
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{facts.map(([label, value]) => <div key={label} className="rounded-2xl bg-paper px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-semibold text-ink-900">{value}</p></div>)}</div>;
}

export default function BrokerDetailRedesign() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [broker, setBroker] = useState<Broker | null>(null);
  const [content, setContent] = useState<BrokerContent | null>(null);
  const [document, setDocument] = useState<ContentDocument | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBroker(slug).then(async (b) => {
      if (!active) return;
      setBroker(b);
      const [bc, doc, reviewRows] = await Promise.all([
        fetchBrokerContent(b.id).catch(() => null),
        fetchContentDocument(`broker:${b.slug}:main`).catch(() => null),
        fetchReviews(b.id).catch(() => []),
      ]);
      if (!active) return;
      setContent(bc); setDocument(doc); setReviews(reviewRows);
    }).catch(() => { if (active) setBroker(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const blocks = useMemo(() => Array.isArray(document?.blocks) ? document!.blocks as PageBlock[] : [], [document]);
  useSEO(broker ? { title: `${broker.name} Review | PipRank`, description: broker.tagline || `Read the PipRank review of ${broker.name}.`, path: `/brokers/${broker.slug}`, type: 'article' } : null);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><div className="h-72 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  if (!broker) return <div className="mx-auto max-w-5xl px-4 py-16 text-center"><h1 className="font-display text-3xl font-bold">Broker not found</h1><Link className="mt-4 inline-flex font-bold text-emerald-700" to="/brokers">Back to brokers</Link></div>;

  const faqs = content?.faqs?.length ? content.faqs : broker.faqs;
  const editorial = blocks.filter((b: any) => !b.zone || b.zone === 'editorial');
  const score = pipRankScore(broker);

  return <main className="bg-paper">
    <section className="border-b border-line bg-ink-950 text-white"><div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><Link to="/brokers" className="hover:text-white">Broker Reviews</Link><span>/</span><span>{broker.name}</span></div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div>
        <div className="flex flex-wrap items-center gap-3"><div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-2">{broker.logo_url ? <img src={broker.logo_url} alt={`${broker.name} logo`} className="h-full w-full object-contain" /> : <span className="font-display text-xl font-bold text-ink-950">{broker.name.slice(0, 2).toUpperCase()}</span>}</div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Broker review</p><h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">{broker.name}</h1></div></div>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{broker.tagline}</p>
        <div className="mt-5 flex flex-wrap gap-2">{broker.regulations.slice(0, 4).map((r) => <span key={`${r.body}-${r.country}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200"><BadgeCheck size={13} className="text-emerald-300" />{r.body}</span>)}</div>
      </div><div className="rounded-3xl border border-white/10 bg-white/5 p-5 lg:min-w-[260px]"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">PipRank score</p><p className="mt-1 font-display text-4xl font-bold text-emerald-300">{score}<span className="text-sm text-slate-400">/100</span></p><div className="mt-4"><VisitButton broker={broker} className="w-full justify-center" /></div></div></div>
    </div></section>

    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12"><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="min-w-0 space-y-8">
      <section id="overview" className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Overview</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">{broker.name} at a glance</h2></div><Globe2 className="text-slate-300" /></div><div className="mt-6"><SystemFacts broker={broker} /></div><div className="mt-6"><TextList items={content?.overview ?? broker.review} /></div></section>

      <PipRankVerdictCard broker={broker} text={content?.verdict?.join(' ')} />
      {editorial.length > 0 && <PageBlocksRenderer blocks={editorial} brokers={[broker]} className="space-y-6" />}

      <section id="pricing"><FixedDataCard title="Pricing & trading costs" icon={<CircleDollarSign size={19} />}><div className="grid gap-3 sm:grid-cols-2"><div><span className="text-xs text-slate-500">Minimum deposit</span><strong className="mt-1 block text-lg">{fmtMoney(broker.min_deposit)}</strong></div><div><span className="text-xs text-slate-500">EUR/USD spread</span><strong className="mt-1 block text-lg">{broker.spread_eurusd} pips</strong></div><div><span className="text-xs text-slate-500">Commission</span><strong className="mt-1 block text-lg">{broker.commission || '—'}</strong></div><div><span className="text-xs text-slate-500">Inactivity fee</span><strong className="mt-1 block text-lg">{broker.inactivity_fee || '—'}</strong></div></div><div className="mt-5"><TextList items={content?.fees_detail} /></div><PageBlocksRenderer blocks={blocks.filter((b: any) => b.zone === 'pricing-content')} brokers={[broker]} className="mt-5 space-y-5" /></FixedDataCard></section>

      <section id="platforms"><FixedDataCard title="Trading platforms" icon={<Monitor size={19} />}><div className="flex flex-wrap gap-2">{broker.platforms.map((platform) => <span key={platform} className="rounded-full border border-line bg-paper px-3 py-2 text-sm font-bold">{platform}</span>)}</div><div className="mt-5"><TextList items={content?.platform_intro} /></div><PageBlocksRenderer blocks={blocks.filter((b: any) => b.zone === 'platform-content')} brokers={[broker]} className="mt-5 space-y-5" /></FixedDataCard></section>

      <section id="trust"><FixedDataCard title="Trust & regulation" icon={<ShieldCheck size={19} />}><div className="grid gap-3 sm:grid-cols-2">{broker.regulations.map((r) => <div key={`${r.body}-${r.country}`} className="rounded-2xl bg-paper p-4"><p className="font-bold text-ink-950">{r.body}</p><p className="mt-1 text-xs text-slate-500">{r.country} · Tier {r.tier}</p></div>)}</div><div className="mt-5"><TextList items={content?.regulation_detail} /></div><PageBlocksRenderer blocks={blocks.filter((b: any) => b.zone === 'trust-content')} brokers={[broker]} className="mt-5 space-y-5" /></FixedDataCard></section>

      <FixedDataCard title="Account types & funding" icon={<Building2 size={19} />}><div className="grid gap-3 sm:grid-cols-2">{broker.account_types.map((account) => <div key={account} className="rounded-2xl border border-line p-4 text-sm font-semibold">{account}</div>)}</div><div className="mt-5"><TextList items={content?.accounts_intro} /></div><TextList items={content?.funding_intro} /></FixedDataCard>

      <PipRankVerdictCard broker={broker} headline={`Why consider ${broker.name}?`} text={content?.why_recommend?.join(' ')} showCta={false} />

      {reviews.length > 0 && <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Trader reviews</p><h2 className="mt-1 font-display text-2xl font-bold">What traders say about {broker.name}</h2><div className="mt-6 space-y-4">{reviews.slice(0, 6).map((review) => <article key={review.id} className="rounded-2xl bg-paper p-4"><div className="flex items-center justify-between gap-3"><strong>{review.title || `${review.rating}/5 review`}</strong><span className="text-sm font-bold">{review.rating}/5</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{review.body}</p><p className="mt-3 text-xs font-semibold text-slate-400">{review.author} · {review.country}</p></article>)}</div></section>}

      {faqs.length > 0 && <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">FAQ</p><h2 className="mt-1 font-display text-2xl font-bold">{broker.name} frequently asked questions</h2><div className="mt-6 space-y-3">{faqs.map((faq, i) => <details key={`${i}-${faq.q}`} className="rounded-2xl border border-line bg-paper p-4"><summary className="cursor-pointer font-bold text-ink-950">{faq.q}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{faq.a}</p></details>)}</div></section>}
      <MatchCTA />
    </div>

    <aside className="hidden lg:block"><div className="sticky top-24 space-y-4"><div className="rounded-3xl border border-line bg-white p-5 shadow-soft"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">On this page</p><nav className="mt-4 space-y-2 text-sm font-semibold text-slate-600"><a href="#overview" className="block hover:text-emerald-700">Overview</a><a href="#pricing" className="block hover:text-emerald-700">Pricing</a><a href="#platforms" className="block hover:text-emerald-700">Platforms</a><a href="#trust" className="block hover:text-emerald-700">Trust & regulation</a></nav></div><BrokerCard broker={broker} /></div></aside>
    </div></div>
  </main>;
}
