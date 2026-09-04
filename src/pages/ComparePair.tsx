import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { globalIntentPath } from '../lib/topicPaths';
import {
  ArrowRight,
  Check,
  Scale,
} from 'lucide-react';
import type { Broker } from '../lib/types';
import { fetchBroker } from '../lib/api';
import VisitButton from '../components/VisitButton';
import Monogram from '../components/Monogram';
import Reveal from '../components/Reveal';
import { ButtonLink } from '../components/Button';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, comparePairSeo } from '../lib/seo';
import { allInCost } from '../lib/score';
import { fmtMoney } from '../lib/format';
import NotFound from './NotFound';

function parsePair(raw?: string): [string, string] | null {
  if (!raw) return null;
  const m = raw.toLowerCase().match(/^([a-z0-9-]+)-vs-([a-z0-9-]+)$/);
  return m ? [m[1], m[2]] : null;
}

export default function ComparePair() {
  const { pair } = useParams<{ pair: string }>();
  const parsed = useMemo(() => parsePair(pair), [pair]);
  const [a, setA] = useState<Broker | null>(null);
  const [b, setB] = useState<Broker | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!parsed) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMissing(false);
    Promise.all([fetchBroker(parsed[0]), fetchBroker(parsed[1])])
      .then(([left, right]) => {
        setA(left);
        setB(right);
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [parsed?.[0], parsed?.[1]]);

  const winner = useMemo(() => {
    if (!a || !b) return a ?? b;
    return a.rating >= b.rating ? a : b;
  }, [a, b]);

  const seoInput = a && b ? comparePairSeo(a, b) : null;
  const seoJsonLd =
    a && b && seoInput
      ? [
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Compare', path: '/compare' },
            { name: `${a.name} vs ${b.name}`, path: seoInput.path },
          ]),
          buildFAQPageJsonLd([
            {
              question: `Is ${a.name} or ${b.name} better?`,
              answer: `${winner?.name ?? a.name} currently has the higher PipRank rating. The better choice depends on your priorities, so compare costs, regulation, platforms and account features.`,
            },
            {
              question: `Which is cheaper, ${a.name} or ${b.name}?`,
              answer: `${(a.spread_eurusd + a.commission_value / 10) <= (b.spread_eurusd + b.commission_value / 10) ? a.name : b.name} currently has the lower estimated EUR/USD all-in cost in the PipRank dataset. Check current broker pricing before trading.`,
            },
            {
              question: 'Are these brokers available in every country?',
              answer:
                'No. Availability, legal entity, regulation and account terms can vary by country. Check the relevant PipRank country page and confirm directly with the broker.',
            },
          ]),
        ]
      : undefined;
  useSEO(seoInput, seoJsonLd);

  if (!parsed || missing) return <NotFound />;
  if (loading || !a || !b || !winner) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="h-64 animate-pulse rounded-3xl border border-line bg-white" />
      </div>
    );
  }

  const rows: { label: string; a: string; b: string; winner: 0 | 1 | null }[] = [
    {
      label: 'PipRank rating',
      a: `${a.rating.toFixed(1)} / 5`,
      b: `${b.rating.toFixed(1)} / 5`,
      winner: a.rating === b.rating ? null : a.rating > b.rating ? 0 : 1,
    },
    {
      label: 'EUR/USD spread',
      a: `${a.spread_eurusd} pips`,
      b: `${b.spread_eurusd} pips`,
      winner: a.spread_eurusd === b.spread_eurusd ? null : a.spread_eurusd < b.spread_eurusd ? 0 : 1,
    },
    {
      label: 'All-in cost / lot',
      a: `${allInCost(a)} pips`,
      b: `${allInCost(b)} pips`,
      winner: allInCost(a) === allInCost(b) ? null : allInCost(a) < allInCost(b) ? 0 : 1,
    },
    {
      label: 'Commission',
      a: a.commission_value === 0 ? 'Included in spread' : `$${a.commission_value.toFixed(2)}/lot`,
      b: b.commission_value === 0 ? 'Included in spread' : `$${b.commission_value.toFixed(2)}/lot`,
      winner: null,
    },
    {
      label: 'Min deposit',
      a: fmtMoney(a.min_deposit),
      b: fmtMoney(b.min_deposit),
      winner: a.min_deposit === b.min_deposit ? null : a.min_deposit < b.min_deposit ? 0 : 1,
    },
    {
      label: 'Max leverage',
      a: a.max_leverage,
      b: b.max_leverage,
      winner: null,
    },
    {
      label: 'Execution speed',
      a: `${a.execution_ms} ms`,
      b: `${b.execution_ms} ms`,
      winner: a.execution_ms === b.execution_ms ? null : a.execution_ms < b.execution_ms ? 0 : 1,
    },
    {
      label: 'Trust score',
      a: String(a.trust_score),
      b: String(b.trust_score),
      winner: a.trust_score === b.trust_score ? null : a.trust_score > b.trust_score ? 0 : 1,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600">
        <Scale size={14} /> Head-to-head
      </div>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
        {a.name} vs {b.name}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
        Both are lab-tested on live accounts. On our composite (rating, trust, costs, execution, withdrawals),
        <strong className="text-ink-900"> {winner.name}</strong> currently leads. Use the table below for the
        details that matter to your style.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[a, b].map((broker, idx) => (
          <Reveal key={broker.slug} delay={idx * 0.05}>
            <div className={`rounded-2xl border p-5 ${broker.slug === winner.slug ? 'border-emerald-300 bg-emerald-50/40' : 'border-line bg-white'}`}>
              <div className="flex items-center gap-3">
                <Monogram name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={44} className="rounded-xl" />
                <div>
                  <Link to={`/brokers/${broker.slug}`} className="font-display text-lg font-bold text-ink-900 hover:text-emerald-700">
                    {broker.name}
                  </Link>
                  <p className="text-sm text-slate-500">{broker.rating.toFixed(1)} / 5 · Trust {broker.trust_score}</p>
                </div>
              </div>
              {broker.slug === winner.slug && (
                <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <Check size={12} /> Current PipRank leader in this matchup
                </p>
              )}
              <div className="mt-4">
                <VisitButton broker={broker} pair={`${a.slug}-vs-${b.slug}`} />
              </div>
              <Link to={`/brokers/${broker.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                Full review <ArrowRight size={14} />
              </Link>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-xs font-bold uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">{a.name}</th>
              <th className="px-4 py-3">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-slate-600">{row.label}</td>
                <td className={`px-4 py-3 font-semibold ${row.winner === 0 ? 'text-emerald-700' : 'text-ink-900'}`}>
                  {row.winner === 0 && <Check size={14} className="mr-1 inline text-emerald-600" />}
                  {row.a}
                </td>
                <td className={`px-4 py-3 font-semibold ${row.winner === 1 ? 'text-emerald-700' : 'text-ink-900'}`}>
                  {row.winner === 1 && <Check size={14} className="mr-1 inline text-emerald-600" />}
                  {row.b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-white p-6" aria-labelledby="best-for-links">
        <h2 id="best-for-links" className="font-display text-2xl font-bold text-ink-950">
          Find the best broker for your trading style
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          If this matchup does not settle the decision, compare the brokers by the trading priorities that matter most to you.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...(winner.best_for ?? []), ...(a.best_for ?? []), ...(b.best_for ?? [])]
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .slice(0, 8)
            .map((slug) => (
              <Link
                key={slug}
                to={globalIntentPath(slug)}
                className="rounded-full border border-line bg-paper px-3.5 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-ink-900"
              >
                Best for {slug.replace(/-/g, ' ')}
              </Link>
            ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-xl font-bold text-ink-900">FAQ</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <details>
            <summary className="cursor-pointer font-semibold text-ink-900">Is {a.name} or {b.name} better?</summary>
            <p className="mt-2 leading-7">
              {winner.name} currently has the higher PipRank rating. The better choice depends on your priorities, so compare costs, regulation, platforms and account features.
            </p>
          </details>
          <details>
            <summary className="cursor-pointer font-semibold text-ink-900">Which is cheaper, {a.name} or {b.name}?</summary>
            <p className="mt-2 leading-7">
              {(a.spread_eurusd + a.commission_value / 10) <= (b.spread_eurusd + b.commission_value / 10) ? a.name : b.name} currently has the lower estimated EUR/USD all-in cost in the PipRank dataset. Check current broker pricing before trading.
            </p>
          </details>
          <details>
            <summary className="cursor-pointer font-semibold text-ink-900">Are these brokers available in every country?</summary>
            <p className="mt-2 leading-7">
              No. Availability, legal entity, regulation and account terms can vary by country. Check the relevant PipRank country page and confirm directly with the broker.
            </p>
          </details>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink to="/compare" variant="outline" size="md">
          More comparisons
        </ButtonLink>
        <ButtonLink to="/quiz" variant="primary" size="md">
          Get a personal match
        </ButtonLink>
      </div>
    </div>
  );
}
