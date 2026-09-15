import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Building2, CircleDollarSign, Download, Globe2, Monitor, ShieldCheck } from 'lucide-react';
import type { Broker, BrokerContent, ContentDocument, Review } from '../lib/types';
import type { PageBlock } from '../components/PageBuilder';
import { fetchBroker, fetchBrokerContent, fetchContentDocument, fetchReviews } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { pipRankScore } from '../lib/score';
import BrokerCard from '../components/BrokerCard';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import PipRankVerdictCard from '../components/PipRankVerdictCard';
import StructuredBrokerDataCard from '../components/StructuredBrokerDataCard';
import VisitButton from '../components/VisitButton';
import MatchCTA from '../components/piprank/MatchCTA';
import { useSEO } from '../hooks/useSEO';

function TextList({ items }: { items?: string[] }) {
  const values = (items ?? []).filter(Boolean);
  if (!values.length) return null;
  return <div className="space-y-3">{values.map((text, i) => <p key={`${i}-${text.slice(0, 20)}`} className="text-[15px] leading-7 text-slate-700">{text}</p>)}</div>;
}

function HeroFacts({ broker }: { broker: Broker }) {
  const facts = [
    ['Platform', broker.platforms.slice(0, 2).join(' · ') || '—'],
    ['Min deposit', fmtMoney(broker.min_deposit)],
    ['Trust score', `${broker.trust_score}/100`],
    ['EUR/USD spread', `${broker.spread_eurusd} pips`],
  ];
  return (
    <div className="mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
      {facts.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 backdrop-blur-sm">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-1 text-sm font-bold text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

function EditorialZone({ blocks, zone, broker }: { blocks: PageBlock[]; zone: string; broker: Broker }) {
  const zoneBlocks = blocks.filter((b: any) => b.zone === zone);
  if (!zoneBlocks.length) return null;
  return <PageBlocksRenderer blocks={zoneBlocks} brokers={[broker]} className="mt-6 space-y-5" />;
}

function SectionShell({ id, eyebrow, title, icon, children }: { id: string; eyebrow: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7">
      <div className="flex items-start gap-4 border-b border-line pb-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</span>
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">{title}</h2></div>
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}

function AnchorNav() {
  const links = [
    ['overview', 'Overview'],
    ['what-we-like', 'What we like'],
    ['fees', 'Fees & spreads'],
    ['trust', 'Regulation & trust'],
    ['accounts', 'Account types'],
    ['platforms', 'Trading platforms'],
    ['funding', 'Deposit & withdraw'],
    ['reviews', 'Reviews'],
    ['faq', 'FAQ'],
  ];
  return (
    <nav aria-label="On this page" className="rounded-3xl border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-center justify-between gap-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">On this page</p><span className="text-xs text-slate-400">Jump to section</span></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-1 lg:overflow-visible">
        {links.map(([id, label]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-xl bg-paper px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700">{label}</a>)}
      </div>
    </nav>
  );
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
    <section className="border-b border-line bg-ink-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><Link to="/brokers" className="hover:text-white">Broker Reviews</Link><span>/</span><span>{broker.name}</span></div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3"><div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-2">{broker.logo_url ? <img src={broker.logo_url} alt={`${broker.name} logo`} className="h-full w-full object-contain" /> : <span className="font-display text-xl font-bold text-ink-950">{broker.name.slice(0, 2).toUpperCase()}</span>}</div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Broker review</p><h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">{broker.name}</h1></div></div>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{broker.tagline}</p>
            <div className="mt-4 flex flex-wrap gap-2">{broker.regulations.slice(0, 4).map((r) => <span key={`${r.body}-${r.country}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200"><BadgeCheck size={13} className="text-emerald-300" />{r.body}</span>)}</div>
            <HeroFacts broker={broker} />
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">PipRank score</p><p className="mt-1 font-display text-4xl font-bold text-emerald-300">{score}<span className="text-sm text-slate-400">/100</span></p>
            <p className="mt-2 text-xs leading-5 text-slate-400">A summary of trust, cost, accessibility, broker health and overall rating.</p>
            <div className="mt-4"><VisitButton broker={broker} className="w-full justify-center" /></div>
          </div>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-12">
      <div className="mb-8 lg:hidden"><AnchorNav /></div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          <SectionShell id="overview" eyebrow="Overview" title={`${broker.name} at a glance`} icon={<Globe2 size={19} />}>
            <TextList items={content?.overview ?? broker.review} />
            {!content?.overview?.length && !broker.review && <StructuredBrokerDataCard broker={broker} section="overview" />}
            <div className="mt-6"><PipRankVerdictCard broker={broker} text={content?.verdict?.join(' ')} /></div>
          </SectionShell>

          <section id="what-we-like" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="editorial" /></section>

          <SectionShell id="fees" eyebrow="Fees & spreads" title="What it costs to trade" icon={<CircleDollarSign size={19} />}>
            <StructuredBrokerDataCard broker={broker} section="pricing" />
            <TextList items={content?.fees_detail} />
            <EditorialZone blocks={blocks} zone="pricing-content" broker={broker} />
          </SectionShell>

          <SectionShell id="trust" eyebrow="Regulation & trust" title="How the broker is regulated" icon={<ShieldCheck size={19} />}>
            <StructuredBrokerDataCard broker={broker} section="trust" />
            <TextList items={content?.regulation_detail} />
            <EditorialZone blocks={blocks} zone="trust-content" broker={broker} />
          </SectionShell>

          <SectionShell id="accounts" eyebrow="Account types" title="Choose the account that fits" icon={<Building2 size={19} />}>
            <div className="grid gap-3 sm:grid-cols-2">{broker.account_types.map((account) => <div key={account} className="rounded-2xl border border-line bg-paper p-4 text-sm font-bold text-ink-950">{account}</div>)}</div>
            <div className="mt-5"><TextList items={content?.accounts_intro} /></div>
            <EditorialZone blocks={blocks} zone="account-content" broker={broker} />
          </SectionShell>

          <SectionShell id="platforms" eyebrow="Trading platforms" title="Where you can trade" icon={<Monitor size={19} />}>
            <StructuredBrokerDataCard broker={broker} section="platforms" />
            <TextList items={content?.platform_intro} />
            <EditorialZone blocks={blocks} zone="platform-content" broker={broker} />
          </SectionShell>

          <SectionShell id="funding" eyebrow="Deposit & withdraw" title="Funding your account" icon={<Download size={19} />}>
            <StructuredBrokerDataCard broker={broker} section="features" />
            <div className="mt-5"><TextList items={content?.funding_intro} /></div>
            <EditorialZone blocks={blocks} zone="funding-content" broker={broker} />
          </SectionShell>

          {editorial.length > 0 && <section className="scroll-mt-28"><p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">More from PipRank</p><PageBlocksRenderer blocks={editorial} brokers={[broker]} className="space-y-6" /></section>}

          <PipRankVerdictCard broker={broker} headline={`Why consider ${broker.name}?`} text={content?.why_recommend?.join(' ')} showCta={false} />

          {reviews.length > 0 && <section id="reviews" className="scroll-mt-28 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Trader reviews</p><h2 className="mt-1 font-display text-2xl font-bold">What traders say about {broker.name}</h2><div className="mt-6 space-y-4">{reviews.slice(0, 6).map((review) => <article key={review.id} className="rounded-2xl bg-paper p-4"><div className="flex items-center justify-between gap-3"><strong>{review.title || `${review.rating}/5 review`}</strong><span className="text-sm font-bold">{review.rating}/5</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{review.body}</p><p className="mt-3 text-xs font-semibold text-slate-400">{review.author} · {review.country}</p></article>)}</div></section>}

          {faqs.length > 0 && <section id="faq" className="scroll-mt-28 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">FAQ</p><h2 className="mt-1 font-display text-2xl font-bold">{broker.name} frequently asked questions</h2><div className="mt-6 space-y-3">{faqs.map((faq, i) => <details key={`${i}-${faq.q}`} className="rounded-2xl border border-line bg-paper p-4"><summary className="cursor-pointer font-bold text-ink-950">{faq.q}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{faq.a}</p></details>)}</div></section>}

          <section className="rounded-3xl bg-ink-950 p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Ready to trade?</p><h2 className="mt-2 font-display text-2xl font-bold">Open a {broker.name} account</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Review the broker details above, then continue through PipRank's tracked account link.</p><div className="mt-5"><VisitButton broker={broker} /></div></section>
          <MatchCTA />
        </div>

        <aside className="hidden lg:block"><div className="sticky top-24 space-y-4"><AnchorNav /><BrokerCard broker={broker} /></div></aside>
      </div>
    </div>
  </main>;
}
