import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { globalIntentPath } from '../lib/topicPaths';
import { ArrowRight, Check, Minus } from 'lucide-react';
import type { Broker } from '../lib/types';
import { fetchBroker, fetchBrokers } from '../lib/api';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, comparePairSeo } from '../lib/seo';
import { allInCost } from '../lib/score';
import { fmtMoney } from '../lib/format';
import Monogram from '../components/Monogram';
import Stars from '../components/Stars';
import VisitButton from '../components/VisitButton';
import NotFound from './NotFound';

function parsePair(pair: string | undefined): [string, string] | null {
  if (!pair) return null;
  const m = pair.match(/^([a-z0-9-]+)-vs-([a-z0-9-]+)$/i);
  if (!m) return null;
  return [m[1].toLowerCase(), m[2].toLowerCase()];
}

export default function ComparePair() {
  const { pair } = useParams<{ pair: string }>();
  const parsed = parsePair(pair);
  const [a, setA] = useState<Broker | null>(null);
  const [b, setB] = useState<Broker | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!parsed) { setMissing(true); setLoading(false); return; }
    setLoading(true);
    Promise.all([fetchBroker(parsed[0]), fetchBroker(parsed[1])])
      .then(([ba, bb]) => { setA(ba); setB(bb); })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [pair]);

  const winner = useMemo(() => {
    if (!a || !b) return null;
    return a.rating >= b.rating ? a : b;
  }, [a, b]);

  const seo = a && b ? comparePairSeo(a, b) : null;
  const jsonLd = a && b && seo ? [
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Compare', path: '/compare' },
      { name: `${a.name} vs ${b.name}`, path: seo.path },
    ]),
    buildFAQPageJsonLd([
      { question: `Is ${a.name} or ${b.name} better?`, answer: `${winner?.name} currently has the higher PipRank rating. The better choice depends on your priorities.` },
      { question: `Which is cheaper, ${a.name} or ${b.name}?`, answer: `${((a.spread_eurusd + a.commission_value / 10) <= (b.spread_eurusd + b.commission_value / 10) ? a.name : b.name)} currently has the lower estimated EUR/USD all-in cost in the PipRank dataset.` },
    ]),
  ] : undefined;
  useSEO(seo, jsonLd);

  if (missing) return <NotFound />;
  if (loading || !a || !b || !winner) {
    return <div className="mx-auto max-w-5xl px-4 py-12"><div className="h-48 animate-pulse rounded-3xl border border-line bg-white" /></div>;
  }

  const rows: { label: string; av: string; bv: string; better?: 'a' | 'b' | null }[] = [
    { label: 'Rating', av: a.rating.toFixed(1), bv: b.rating.toFixed(1), better: a.rating === b.rating ? null : a.rating > b.rating ? 'a' : 'b' },
    { label: 'EUR/USD spread', av: `${a.spread_eurusd}p`, bv: `${b.spread_eurusd}p`, better: a.spread_eurusd === b.spread_eurusd ? null : a.spread_eurusd < b.spread_eurusd ? 'a' : 'b' },
    { label: 'All-in cost / lot', av: `${allInCost(a)} pips`, bv: `${allInCost(b)} pips`, better: allInCost(a) === allInCost(b) ? null : allInCost(a) < allInCost(b) ? 'a' : 'b' },
    { label: 'Min deposit', av: fmtMoney(a.min_deposit), bv: fmtMoney(b.min_deposit), better: a.min_deposit === b.min_deposit ? null : a.min_deposit < b.min_deposit ? 'a' : 'b' },
    { label: 'Max leverage', av: a.max_leverage, bv: b.max_leverage },
    { label: 'Execution', av: `${a.execution_ms}ms`, bv: `${b.execution_ms}ms`, better: a.execution_ms === b.execution_ms ? null : a.execution_ms < b.execution_ms ? 'a' : 'b' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Head-to-head</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
        {a.name} vs {b.name}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
        Side-by-side comparison of spreads, costs, leverage and execution. {winner.name} currently leads on overall PipRank rating.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[a, b].map((broker) => (
          <div key={broker.slug} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center gap-3">
              <Monogram name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={40} className="rounded-xl" />
              <div>
                <Link to={`/brokers/${broker.slug}`} className="font-display text-lg font-bold text-ink-900 hover:text-emerald-700">{broker.name}</Link>
                <div className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
                  <Stars rating={broker.rating} /> {broker.rating.toFixed(1)}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <VisitButton broker={broker} pair={`${a.slug}-vs-${b.slug}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs font-bold uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">{a.name}</th>
              <th className="px-4 py-3">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-slate-600">{r.label}</td>
                <td className={`px-4 py-3 font-semibold ${r.better === 'a' ? 'text-emerald-700' : 'text-ink-900'}`}>
                  {r.better === 'a' && <Check size={14} className="mr-1 inline text-emerald-600" />}
                  {r.av}
                </td>
                <td className={`px-4 py-3 font-semibold ${r.better === 'b' ? 'text-emerald-700' : 'text-ink-900'}`}>
                  {r.better === 'b' && <Check size={14} className="mr-1 inline text-emerald-600" />}
                  {r.bv}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-white p-6">
        <h2 id="best-for-links" className="font-display text-2xl font-bold text-ink-950">Find the best broker for your trading style</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">If this matchup does not settle the decision, compare the brokers by the trading priorities that matter most to you.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...(winner.best_for ?? []), ...(a.best_for ?? []), ...(b.best_for ?? [])].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 8).map((slug) => (
            <Link key={slug} to={globalIntentPath(slug)} className="rounded-full border border-line bg-paper px-3.5 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-ink-900">
              Best for {slug.replace(/-/g, ' ')}
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-8 text-sm">
        <Link to="/compare" className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800">
          More comparisons <ArrowRight size={14} />
        </Link>
      </p>
    </div>
  );
}
