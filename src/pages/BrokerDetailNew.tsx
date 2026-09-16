import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import type { Broker, BrokerContent } from '../lib/types';
import { fetchBroker, fetchBrokerContent } from '../lib/api';
import { fmtMoney } from '../lib/format';
import PipRankVerdictCard from '../components/PipRankVerdictCard';
import StructuredBrokerDataCard from '../components/StructuredBrokerDataCard';
import OriginalTradingPlatformsCard from '../components/OriginalTradingPlatformsCard';
import BrokerStickyCTA from '../components/BrokerStickyCTA';
import VisitButton from '../components/VisitButton';
import BrokerCard from '../components/BrokerCard';
import Monogram from '../components/Monogram';
import { reviewerFor } from '../lib/team';
import { brokerSeo, buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildWebPageJsonLd } from '../lib/seo';
import { useSEO } from '../hooks/useSEO';

const anchors = [
  ['overview', 'Overview'], ['fees', 'Fees'], ['platforms', 'Platforms'], ['trust', 'Trust & regulation'],
  ['accounts', 'Accounts'], ['funding', 'Deposits & withdrawals'], ['faq', 'FAQ'],
];
const HERO_REGULATORS = new Set(['FCA', 'CySEC', 'FSCA', 'FSA']);

function Copy({ items }: { items?: string[] }) {
  const values = (items ?? []).filter(Boolean);
  return values.length ? <div className="space-y-6 text-[15px] leading-7 text-slate-700">{values.map((x, i) => <p key={`${i}-${x.slice(0, 20)}`}>{x}</p>)}</div> : null;
}
function Anchors({ mobile = false }: { mobile?: boolean }) {
  return <nav aria-label="On this page" className={mobile ? 'overflow-x-auto border-y border-line bg-paper py-3' : 'rounded-3xl border border-line bg-white p-5 shadow-soft'}><div className={mobile ? 'flex min-w-max gap-2' : 'space-y-1'}>{anchors.map(([id, label]) => <a key={id} href={`#${id}`} className={mobile ? 'rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-slate-600' : 'block rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-paper hover:text-emerald-700'}>{label}</a>)}</div></nav>;
}
function Shell({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-28 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="border-b border-line pb-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">{title}</h2></div><div className="pt-6">{children}</div></section>;
}

export default function BrokerDetailNew() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [broker, setBroker] = useState<Broker | null>(null);
  const [content, setContent] = useState<BrokerContent | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true; setLoading(true);
    fetchBroker(slug).then(async (b) => {
      if (!live) return; setBroker(b);
      const c = await fetchBrokerContent(b.id).catch(() => null);
      if (!live) return; setContent(c);
    }).catch(() => live && setBroker(null)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [slug]);
  const faqs = content?.faqs?.length ? content.faqs : broker?.faqs ?? [];
  const reviewer = reviewerFor(broker?.slug ?? slug);
  const seo = broker ? brokerSeo(broker) : null;
  const jsonLd = seo && broker
    ? [
        buildWebPageJsonLd(seo),
        buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Forex Brokers', path: '/brokers' },
          { name: broker.name, path: `/brokers/${broker.slug}` },
        ]),
        ...(faqs.length
          ? [buildFAQPageJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))]
          : []),
      ]
    : undefined;
  useSEO(seo, jsonLd);
  if (loading) return <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="h-80 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  if (!broker) return <div className="mx-auto max-w-5xl px-4 py-16 text-center"><h1 className="font-display text-3xl font-bold">Broker not found</h1><Link className="mt-4 inline-flex font-bold text-emerald-700" to="/brokers">Back to brokers</Link></div>;
  const heroRegulators = broker.regulations.filter((r) => HERO_REGULATORS.has(r.body)).map((r) => r.body).filter((name, i, all) => all.indexOf(name) === i);
  return (
    <main className="bg-paper pb-24">
      <section className="border-b border-line bg-ink-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5"><Monogram name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={76} className="shrink-0 rounded-2xl ring-2 ring-white/15" /><div className="min-w-0"><h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">{broker.name} Forex Broker Review: Spreads, Fees & Regulation</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{broker.tagline}</p><div className="mt-4 flex flex-wrap items-center gap-2"><ShieldCheck size={15} className="shrink-0 text-emerald-300" /><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Regulated by</span>{heroRegulators.length ? <div className="flex flex-wrap items-center gap-2">{heroRegulators.map((name) => <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-100 shadow-sm shadow-emerald-950/20"><BadgeCheck size={13} className="text-emerald-300" />{name}</span>)}</div> : <span className="text-xs text-slate-400">Regulatory information available in this review</span>}</div></div></div>
            <div className="w-full lg:w-[520px]"><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{[['Platform', broker.platforms.slice(0, 2).join(' · ') || '—'], ['Min deposit', fmtMoney(broker.min_deposit)], ['Founded', String(broker.founded || '—')], ['EUR/USD spread', `${broker.spread_eurusd} pips`]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-3.5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="tnum mt-1 font-display text-base font-bold text-white sm:text-lg">{value}</p></div>)}</div><div className="mt-4"><VisitButton broker={broker} className="w-full justify-center" /></div></div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="lg:hidden"><Anchors mobile /></div>
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-8">
            <Shell id="overview" eyebrow="Overview" title={`${broker.name} at a glance`}>
              <Copy items={content?.overview ?? broker.review} />
              <div className="mt-8 overflow-hidden rounded-2xl border border-line">{[['Minimum deposit', fmtMoney(broker.min_deposit)], ['EUR/USD spread', `${broker.spread_eurusd} pips`], ['Commission', broker.commission || '—'], ['Platforms', broker.platforms.join(' · ') || '—'], ['Founded', String(broker.founded || '—')], ['Headquarters', broker.headquarters || '—']].map(([label, value], i) => <div key={label} className={`flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between ${i % 2 === 0 ? 'bg-paper/70' : 'bg-white'}`}><span className="text-sm font-medium text-slate-500">{label}</span><span className="text-sm font-bold text-ink-900">{value}</span></div>)}</div>
            </Shell>
            <section id="assessment" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="editorial" /></section>
            <section id="verdict" className="scroll-mt-28"><PipRankVerdictCard broker={broker} text={content?.verdict?.join(' ')} /></section>
            <section id="editorial" className="scroll-mt-28 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="border-b border-line pb-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Editorial</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">In-depth {broker.name} analysis</h2></div><div className="pt-6"><Copy items={broker.review} /></div></section>
            <section id="fees" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="pricing" editorial={<Copy items={content?.fees_detail} />} /></section>
            <section id="platforms" className="scroll-mt-28"><OriginalTradingPlatformsCard broker={broker} content={content} />{content?.platform_intro?.length ? <div className="mt-5 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><Copy items={content.platform_intro} /></div> : null}</section>
            <section id="trust" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="trust" editorial={<Copy items={content?.regulation_detail} />} /></section>
            <section id="accounts" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="accounts" content={content} editorial={<Copy items={content?.accounts_intro} />} /></section>
            <section id="funding" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="funding" content={content} editorial={<Copy items={content?.funding_intro} />} /></section>
            {(content?.why_recommend?.length || content?.avoid_if?.length) ? <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="border-b border-line pb-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Additional editorial</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">More from the PipRank review</h2></div><div className="grid gap-5 pt-6 md:grid-cols-2">{content?.why_recommend?.length ? <div><h3 className="font-display text-lg font-bold text-ink-950">Why PipRank recommends {broker.name}</h3><Copy items={content.why_recommend} /></div> : null}{content?.avoid_if?.length ? <div><h3 className="font-display text-lg font-bold text-ink-950">Consider alternatives if…</h3><Copy items={content.avoid_if} /></div> : null}</div></section> : null}
            {faqs.length > 0 && <section id="faq" className="scroll-mt-28 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><p className="text-xs font-bold tracking-wider text-emerald-700">FAQ</p><h2 className="mt-1 font-display text-2xl font-bold">{broker.name} frequently asked questions</h2><div className="mt-6 space-y-3">{faqs.map((faq, i) => <details key={`${i}-${faq.q}`} className="rounded-2xl border border-line bg-paper p-4"><summary className="cursor-pointer font-bold">{faq.q}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{faq.a}</p></details>)}</div></section>}
            <section className="rounded-3xl bg-ink-950 p-6 text-white sm:p-8" aria-label={`Open ${broker.name} account`}><h2 className="font-display text-2xl font-bold">Open {broker.name} Account</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Review the broker details above and open an account directly with {broker.name} if it fits your trading needs.</p><div className="mt-5"><VisitButton broker={broker} /></div></section>
            <section className="rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-8" aria-labelledby="broker-author-bio"><div className="flex flex-col gap-5 sm:flex-row sm:items-start"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-paper font-display text-xl font-bold text-ink-950 ring-1 ring-line">{reviewer.penName.slice(0, 1)}</div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Reviewed by</p><h2 id="broker-author-bio" className="mt-1 font-display text-xl font-bold text-ink-950">{reviewer.penName}</h2><p className="mt-0.5 text-sm font-semibold text-emerald-700">{reviewer.role}</p><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{reviewer.bio}</p><Link to={`/authors#${reviewer.slug}`} className="mt-3 inline-flex text-xs font-bold text-emerald-700 hover:text-emerald-800">View editorial profile →</Link></div></div></section>
          </div>
          <aside className="hidden lg:block"><div className="sticky top-24 space-y-4"><Anchors /><BrokerCard broker={broker} /></div></aside>
        </div>
      </div>
      <BrokerStickyCTA broker={broker} />
    </main>
  );
}
