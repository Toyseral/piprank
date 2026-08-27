import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Award, CircleCheck, Scale, X } from 'lucide-react';
import type { Broker } from '../lib/types';
import { ButtonLink } from '../components/Button';
import Monogram from '../components/Monogram';
import NotFound from './NotFound';
import { fetchBrokers } from '../lib/api';
import { composite } from '../lib/score';
import { fmtMoney } from '../lib/format';
import { useSEO } from '../hooks/useSEO';
import { comparePairSeo, buildBreadcrumbJsonLd, buildWebPageJsonLd } from '../lib/seo';

interface Row {
  label: string;
  a: string;
  b: string;
  winner?: 0 | 1 | null;
}

export default function ComparePair() {
  const { pair } = useParams<{ pair: string }>();
  const [all, setAll] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);

  const { aSlug, bSlug } = useMemo(() => {
    const parts = (pair ?? '').split('-vs-');
    return { aSlug: parts[0] ?? '', bSlug: parts[1] ?? '' };
  }, [pair]);

  useEffect(() => {
    fetchBrokers()
      .then(setAll)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const a = useMemo(() => all.find((b) => b.slug === aSlug), [all, aSlug]);
  const b = useMemo(() => all.find((x) => x.slug === bSlug), [all, bSlug]);

  const seoInput = a && b ? comparePairSeo(a, b) : null;
  useSEO(
    seoInput,
    a && b
      ? [
          buildWebPageJsonLd(seoInput!),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Compare', path: '/compare' },
            { name: `${a.name} vs ${b.name}`, path: `/compare/${a.slug}-vs-${b.slug}` },
          ]),
        ]
      : undefined,
  );

  if (loading)
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="h-64 animate-pulse rounded-3xl border border-line bg-white" />
      </div>
    );

  if (!a || !b) return <NotFound />;

  // Server-level canonicalization is handled by /api/compare-pair via vercel.json
  // before React executes. Keep this client-side Navigate as a fallback for
  // client-only/static-host scenarios. The server returns HTTP 301 for reversed pairs.
  if (a.slug.localeCompare(b.slug) > 0) {
    return <Navigate to={`/compare/${b.slug}-vs-${a.slug}`} replace />;
  }

  const aWins = composite(a) > composite(b);
  const winner = aWins ? a : b;

  const rows: Row[] = [
    {
      label: 'PipRank rating',
      a: `${a.rating.toFixed(1)} / 5`,
      b: `${b.rating.toFixed(1)} / 5`,
      winner: a.rating === b.rating ? null : a.rating > b.rating ? 0 : 1,
    },
    {
      label: 'Trust score',
      a: `${a.trust_score}/100`,
      b: `${b.trust_score}/100`,
      winner: a.trust_score === b.trust_score ? null : a.trust_score > b.trust_score ? 0 : 1,
    },
    {
      label: 'EUR/USD all-in cost',
      a: `${(a.spread_eurusd + a.commission_value / 10).toFixed(2)}p`,
      b: `${(b.spread_eurusd + b.commission_value / 10).toFixed(2)}p`,
      winner: (a.spread_eurusd + a.commission_value / 10) === (b.spread_eurusd + b.commission_value / 10)
        ? null
        : (a.spread_eurusd + a.commission_value / 10) < (b.spread_eurusd + b.commission_value / 10)
          ? 0
          : 1,
    },
    {
      label: 'Minimum deposit',
      a: fmtMoney(a.min_deposit),
      b: fmtMoney(b.min_deposit),
      winner: a.min_deposit === b.min_deposit ? null : a.min_deposit < b.min_deposit ? 0 : 1,
    },
    {
      label: 'Execution speed',
      a: `${a.execution_ms} ms`,
      b: `${b.execution_ms} ms`,
      winner: a.execution_ms === b.execution_ms ? null : a.execution_ms < b.execution_ms ? 0 : 1,
    },
    {
      label: 'Withdrawal (lab avg)',
      a: `~${a.withdrawal_hours}h`,
      b: `~${b.withdrawal_hours}h`,
      winner: a.withdrawal_hours === b.withdrawal_hours ? null : a.withdrawal_hours < b.withdrawal_hours ? 0 : 1,
    },
    {
      label: 'Max leverage',
      a: a.max_leverage,
      b: b.max_leverage,
      winner: null,
    },
    {
      label: 'Platforms',
      a: a.platforms.join(', '),
      b: b.platforms.join(', '),
      winner: null,
    },
  ];

  const othersA = all.filter((x) => x.slug !== a.slug && x.slug !== b.slug).slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <nav className="mb-5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Link to="/" className="transition hover:text-ink-900">Home</Link>
        <span>/</span>
        <Link to="/compare" className="transition hover:text-ink-900">Compare</Link>
        <span>/</span>
        <span className="text-ink-900">{a.name} vs {b.name}</span>
      </nav>

      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-[110px]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <div className="flex flex-col items-center gap-2.5">
              <Monogram name={a.name} color={a.brand_color} size={72} className="rounded-2xl" logoUrl={a.logo_url} />
              <p className="font-display text-base font-bold text-white">{a.name}</p>
            </div>
            <span className="tnum rounded-full bg-emerald-500/15 px-4 py-1.5 font-display text-sm font-bold uppercase tracking-widest text-emerald-300 ring-1 ring-emerald-500/40">
              VS
            </span>
            <div className="flex flex-col items-center gap-2.5">
              <Monogram name={b.name} color={b.brand_color} size={72} className="rounded-2xl" logoUrl={b.logo_url} />
              <p className="font-display text-base font-bold text-white">{b.name}</p>
            </div>
          </div>
          <h1 className="mt-7 text-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {a.name} vs {b.name}: which is better in 2026?
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-400 sm:text-[15px]">
            Both are lab-tested on live accounts. On our composite (rating, trust, costs, execution, withdrawals),
            <strong className="text-white"> {winner.name} </strong>
            edges this matchup overall — the line-by-line winner on each metric is marked below.
          </p>
        </div>
      </div>

      {/* verdict chips */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Best overall', v: winner.name, icon: Award },
          {
            label: 'Cheapest per lot',
            v: (a.spread_eurusd + a.commission_value / 10) <= (b.spread_eurusd + b.commission_value / 10) ? a.name : b.name,
            icon: Scale,
          },
          {
            label: 'Faster payouts',
            v: a.withdrawal_hours <= b.withdrawal_hours ? a.name : b.name,
            icon: CircleCheck,
          },
          {
            label: 'Lowest entry',
            v: a.min_deposit <= b.min_deposit ? a.name : b.name,
            icon: CircleCheck,
          },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
            <c.icon size={16} className="text-emerald-600" />
            <p className="mt-2 font-display text-sm font-bold text-ink-900">{c.v}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* quick table */}
      <div className="mt-7 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="grid grid-cols-3 border-b border-line bg-ink-950 px-4 py-3 text-[10px] font-bold uppercase tracking-widest">
          <span className="text-slate-400">Metric</span>
          <span className="text-center text-emerald-300">{a.name}</span>
          <span className="text-center text-emerald-300">{b.name}</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.label} className={`grid grid-cols-3 items-center gap-2 px-4 py-3.5 ${i % 2 === 0 ? 'bg-paper/60' : 'bg-white'}`}>
            <span className="text-xs font-bold text-slate-500">{r.label}</span>
            <span className={`tnum flex items-center justify-center gap-1.5 text-center text-sm font-semibold ${r.winner === 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
              {r.a}
              {r.winner === 0 && <CircleCheck size={13} className="text-emerald-600" />}
              {r.winner === 1 && <X size={13} className="text-slate-300" />}
            </span>
            <span className={`tnum flex items-center justify-center gap-1.5 text-center text-sm font-semibold ${r.winner === 1 ? 'text-emerald-700' : 'text-slate-600'}`}>
              {r.winner === 1 && <CircleCheck size={13} className="text-emerald-600" />}
              {r.b}
              {r.winner === 0 && <X size={13} className="text-slate-300" />}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-5 shadow-soft">
        <ButtonLink
          variant="primary"
          size="md"
          icon={Scale}
          to={`/compare?a=${a.slug}&b=${b.slug}`}
        >
          Full comparison — every metric
        </ButtonLink>
        <Link to={`/brokers/${a.slug}`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-900 transition hover:border-ink-900">
          {a.name} review
        </Link>
        <Link to={`/brokers/${b.slug}`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-900 transition hover:border-ink-900">
          {b.name} review
        </Link>
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="font-display text-2xl font-bold text-ink-950">Who should choose {a.name}?</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">{a.tagline || `Review ${a.name}'s costs, regulation, platforms and account features before deciding.`} {a.best_for?.length ? `PipRank identifies ${a.name} for ${a.best_for.slice(0, 5).join(', ')}.` : ''}</p>
        <Link to={`/brokers/${a.slug}`} className="mt-3 inline-block text-sm font-bold text-emerald-700 underline underline-offset-4">Read the full {a.name} review</Link>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="font-display text-2xl font-bold text-ink-950">Who should choose {b.name}?</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">{b.tagline || `Review ${b.name}'s costs, regulation, platforms and account features before deciding.`} {b.best_for?.length ? `PipRank identifies ${b.name} for ${b.best_for.slice(0, 5).join(', ')}.` : ''}</p>
        <Link to={`/brokers/${b.slug}`} className="mt-3 inline-block text-sm font-bold text-emerald-700 underline underline-offset-4">Read the full {b.name} review</Link>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="font-display text-2xl font-bold text-ink-950">Regulation and country availability</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">The broker brand alone does not determine the legal entity you will contract with. Regulation, leverage, protections, products and onboarding can vary by country. Confirm the exact entity and current terms before opening an account.</p>
        <Link to="/countries" className="mt-3 inline-block text-sm font-bold text-emerald-700 underline underline-offset-4">See broker availability by country</Link>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="font-display text-2xl font-bold text-ink-950">How PipRank compares brokers</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">PipRank considers rating, trust, trading costs, execution, withdrawal performance and account features. The comparison is decision-support and does not guarantee future trading results.</p>
        <Link to="/methodology" className="mt-3 inline-block text-sm font-bold text-emerald-700 underline underline-offset-4">Read the full methodology</Link>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-white p-6 shadow-soft" aria-labelledby="best-for-links">
        <h2 id="best-for-links" className="font-display text-2xl font-bold text-ink-950">Find the best broker for your trading style</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">If this matchup does not settle the decision, compare the brokers by the trading priorities that matter most to you.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...(winner.best_for ?? []), ...(a.best_for ?? []), ...(b.best_for ?? [])].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 8).map((slug) => <Link key={slug} to={`/best/${slug}`} className="rounded-full border border-line bg-paper px-3.5 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-ink-900">Best for {slug.replace(/-/g, ' ')}</Link>)}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="font-display text-2xl font-bold text-ink-950">Frequently asked questions</h2>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          <details><summary className="cursor-pointer font-semibold text-ink-900">Is {a.name} or {b.name} better?</summary><p className="mt-2 leading-7">{winner.name} currently has the higher PipRank rating. The better choice depends on your priorities, so compare costs, regulation, platforms and account features.</p></details>
          <details><summary className="cursor-pointer font-semibold text-ink-900">Which is cheaper, {a.name} or {b.name}?</summary><p className="mt-2 leading-7">{((a.spread_eurusd + a.commission_value / 10) <= (b.spread_eurusd + b.commission_value / 10) ? a.name : b.name)} currently has the lower estimated EUR/USD all-in cost in the PipRank dataset. Check current broker pricing before trading.</p></details>
          <details><summary className="cursor-pointer font-semibold text-ink-900">Are these brokers available in every country?</summary><p className="mt-2 leading-7">No. Availability, legal entity, regulation and account terms can vary by country. Check the relevant PipRank country page and confirm directly with the broker.</p></details>
        </div>
      </section>

      {/* internal link mesh */}
      <div className="mt-8 rounded-2xl border border-dashed border-line p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">More {a.name} matchups</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {othersA.map((o) => {
            const [x, y] = [a.slug, o.slug].sort((s1, s2) => s1.localeCompare(s2));
            return (
              <Link
                key={o.slug}
                to={`/compare/${x}-vs-${y}`}
                className="rounded-full border border-line bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-ink-900 hover:text-ink-900"
              >
                {a.name} vs {o.name}
              </Link>
            );
          })}
          {all
            .filter((x) => x.slug !== a.slug)
            .slice(0, 4)
            .map((o) => {
              const [x, y] = [b.slug, o.slug].sort((s1, s2) => s1.localeCompare(s2));
              return (
                <Link
                  key={o.slug}
                  to={`/compare/${x}-vs-${y}`}
                  className="rounded-full border border-line bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-ink-900 hover:text-ink-900"
                >
                  {b.name} vs {o.name}
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
