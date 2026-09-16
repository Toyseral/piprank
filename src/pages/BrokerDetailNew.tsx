import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import type { Broker, BrokerContent, ContentDocument, Review } from '../lib/types';
import type { PageBlock } from '../components/PageBuilder';
import { fetchBroker, fetchBrokerContent, fetchContentDocument, fetchReviews } from '../lib/api';
import { fmtHours, fmtMoney } from '../lib/format';
import { pipRankScore } from '../lib/score';
import PageBlocksRenderer from '../components/PageBlocksRenderer';
import PipRankVerdictCard from '../components/PipRankVerdictCard';
import StructuredBrokerDataCard from '../components/StructuredBrokerDataCard';
import VisitButton from '../components/VisitButton';
import BrokerCard from '../components/BrokerCard';
import { reviewerFor } from '../lib/team';
import { useSEO } from '../hooks/useSEO';

const anchors = [
  ['overview', 'Overview'],
  ['fees', 'Fees'],
  ['platforms', 'Platforms'],
  ['trust', 'Trust & regulation'],
  ['accounts', 'Accounts'],
  ['funding', 'Deposits & withdrawals'],
  ['faq', 'FAQ'],
];

function Copy({ items }: { items?: string[] }) {
  const values = (items ?? []).filter(Boolean);
  return values.length ? <div className="space-y-3 text-[15px] leading-7 text-slate-700">{values.map((x, i) => <p key={`${i}-${x.slice(0, 20)}`}>{x}</p>)}</div> : null;
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
  const [doc, setDoc] = useState<ContentDocument | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchBroker(slug).then(async (b) => {
      if (!live) return;
      setBroker(b);
      const [c, d, r] = await Promise.all([
        fetchBrokerContent(b.id).catch(() => null),
        fetchContentDocument(`broker:${b.slug}:main`).catch(() => null),
        fetchReviews(b.id).catch(() => []),
      ]);
      if (!live) return;
      setContent(c); setDoc(d); setReviews(r);
    }).catch(() => live && setBroker(null)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [slug]);

  const blocks = useMemo(() => (Array.isArray(doc?.blocks) ? (doc.blocks as PageBlock[]) : []), [doc]);
  const score = broker ? pipRankScore(broker) : 0;
  const faqs = content?.faqs?.length ? content.faqs : broker?.faqs ?? [];
  const reviewer = useMemo(() => reviewerFor(broker?.slug ?? slug), [broker?.slug, slug]);

  useSEO(broker ? {
    title: `${broker.name} Review | PipRank`,
    description: broker.tagline || `Read the PipRank review of ${broker.name}.`,
    path: `/brokers/${broker.slug}`,
    type: 'article',
  } : null);

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="h-80 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  if (!broker) return <div className="mx-auto max-w-5xl px-4 py-16 text-center"><h1 className="font-display text-3xl font-bold">Broker not found</h1><Link className="mt-4 inline-flex font-bold text-emerald-700" to="/brokers">Back to brokers</Link></div>;

  return (
    <main className="bg-paper">
      <section className="border-b border-line bg-ink-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400"><Link to="/brokers" className="hover:text-white">Broker Reviews</Link><span>/</span><span>{broker.name}</span></div>

          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-lg shadow-black/30 ring-2 ring-white/20">{broker.logo_url ? <img src={broker.logo_url} alt={`${broker.name} logo`} className="h-full w-full object-contain" /> : <span className="font-display text-xl font-bold text-ink-950">{broker.name.slice(0, 2).toUpperCase()}</span>}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Broker review</p><h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">{broker.name}</h1></div>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{broker.tagline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300"><BadgeCheck size={14} className="text-emerald-300" /><span>Regulation</span><span className="text-slate-500">·</span><span>{broker.regulations.length ? broker.regulations.slice(0, 2).map((r) => r.body).join(' · ') : 'Regulatory information available in this review'}</span></div>

              <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  ['Platform', broker.platforms.slice(0, 2).join(' · ') || '—'],
                  ['Min deposit', fmtMoney(broker.min_deposit)],
                  ['PipRank Score', `${score}/100`],
                  ['EUR/USD spread', `${broker.spread_eurusd} pips`],
                ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-3.5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="tnum mt-1 font-display text-base font-bold text-white sm:text-lg">{value}</p></div>)}
              </div>

              <div className="mt-5 sm:max-w-sm"><VisitButton broker={broker} className="w-full justify-center" /></div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="lg:hidden"><Anchors mobile /></div>
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-8">
            <Shell id="overview" eyebrow="Overview" title={`Our ${broker.name} review`}>
              <StructuredBrokerDataCard broker={broker} section="overview" editorial={<Copy items={content?.overview ?? broker.review} />} />
              <div className="mt-6"><StructuredBrokerDataCard broker={broker} section="editorial" /></div>
            </Shell>

            <section id="verdict" className="scroll-mt-28"><PipRankVerdictCard broker={broker} text={content?.verdict?.join(' ')} /></section>

            {blocks.length > 0 && <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="border-b border-line pb-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Editorial</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">In-depth {broker.name} analysis</h2></div><div className="pt-6"><PageBlocksRenderer blocks={blocks} brokers={[broker]} /></div></section>}

            <section id="fees" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="pricing" editorial={<Copy items={content?.fees_detail} />} /></section>
            <section id="platforms" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="platforms" content={content} editorial={<Copy items={content?.platform_intro} />} /></section>
            <section id="trust" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="trust" editorial={<Copy items={content?.regulation_detail} />} /></section>
            <section id="accounts" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="accounts" content={content} editorial={<Copy items={content?.accounts_intro} />} /></section>
            <section id="funding" className="scroll-mt-28"><StructuredBrokerDataCard broker={broker} section="funding" content={content} editorial={<Copy items={content?.funding_intro} />} /></section>

            {(content?.why_recommend?.length || content?.avoid_if?.length) ? <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="border-b border-line pb-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Additional editorial</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">More from the PipRank review</h2></div><div className="grid gap-5 pt-6 md:grid-cols-2">{content?.why_recommend?.length ? <div><h3 className="font-display text-lg font-bold text-ink-950">Why PipRank recommends {broker.name}</h3><Copy items={content.why_recommend} /></div> : null}{content?.avoid_if?.length ? <div><h3 className="font-display text-lg font-bold text-ink-950">Consider alternatives if…</h3><Copy items={content.avoid_if} /></div> : null}</div></section> : null}

            {reviews.length > 0 && <section id="reviews" className="scroll-mt-28 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Trader reviews</p><h2 className="mt-1 font-display text-2xl font-bold">What traders say about {broker.name}</h2><div className="mt-6 space-y-4">{reviews.slice(0, 6).map((review) => <article key={review.id} className="rounded-2xl bg-paper p-4"><div className="flex justify-between gap-3"><strong>{review.title || `${review.rating}/5 review`}</strong><span className="font-bold">{review.rating}/5</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{review.body}</p><p className="mt-3 text-xs font-semibold text-slate-400">{review.author} · {review.country}</p></article>)}</div></section>}

            {faqs.length > 0 && <section id="faq" className="scroll-mt-28 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">FAQ</p><h2 className="mt-1 font-display text-2xl font-bold">{broker.name} frequently asked questions</h2><div className="mt-6 space-y-3">{faqs.map((faq, i) => <details key={`${i}-${faq.q}`} className="rounded-2xl border border-line bg-paper p-4"><summary className="cursor-pointer font-bold">{faq.q}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{faq.a}</p></details>)}</div></section>}

            <section className="rounded-3xl bg-ink-950 p-6 text-white sm:p-8" aria-label={`Open ${broker.name} account`}><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Ready to trade?</p><h2 className="mt-2 font-display text-2xl font-bold">Open a {broker.name} account</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Review the broker details above and open an account directly with {broker.name} if it fits your trading needs.</p><div className="mt-5"><VisitButton broker={broker} /></div></section>

            <section className="rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-8" aria-labelledby="broker-author-bio"><div className="flex flex-col gap-5 sm:flex-row sm:items-start"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-paper font-display text-xl font-bold text-ink-950 ring-1 ring-line">{reviewer.penName.slice(0, 1)}</div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Reviewed by</p><h2 id="broker-author-bio" className="mt-1 font-display text-xl font-bold text-ink-950">{reviewer.penName}</h2><p className="mt-0.5 text-sm font-semibold text-emerald-700">{reviewer.role}</p><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{reviewer.bio}</p><Link to={`/authors#${reviewer.slug}`} className="mt-3 inline-flex text-xs font-bold text-emerald-700 hover:text-emerald-800">View editorial profile →</Link></div></div></section>
          </div>

          <aside className="hidden lg:block"><div className="sticky top-24 space-y-4"><Anchors /><BrokerCard broker={broker} /></div></aside>
        </div>
      </div>
    </main>
  );
}
