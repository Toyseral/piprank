import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, Check, Crown, Info, Trophy, X, Zap } from 'lucide-react';
import type { Broker } from '../lib/types';
import { fetchBrokers } from '../lib/api';
import { track } from '../lib/track';
import HealthRing from '../components/HealthRing';
import Monogram from '../components/Monogram';
import Stars from '../components/Stars';
import VisitButton from '../components/VisitButton';
import { useSEO } from '../hooks/useSEO';
import { staticPageSeo, buildBreadcrumbJsonLd, buildWebPageJsonLd } from '../lib/seo';
import { fmtHours, fmtMoney } from '../lib/format';
import { allInCost, composite, healthScore, tierBest, totalAssets } from '../lib/score';

interface Metric {
  label: string;
  render: (b: Broker) => string;
  num?: (b: Broker) => number;
  better?: 'high' | 'low';
  bool?: (b: Broker) => boolean;
}

interface MetricGroup {
  title: string;
  rows: Metric[];
}

const GROUPS: MetricGroup[] = [
  {
    title: 'Ratings & trust',
    rows: [
      { label: 'PipRank rating', render: (b) => `${b.rating.toFixed(1)} / 5`, num: (b) => b.rating, better: 'high' },
      { label: 'Trust score', render: (b) => `${b.trust_score} / 100`, num: (b) => b.trust_score, better: 'high' },
      { label: 'Health score', render: (b) => `${healthScore(b)} / 100`, num: (b) => healthScore(b), better: 'high' },
      {
        label: 'Strongest licence',
        render: (b) => (tierBest(b) === 1 ? 'Tier-1' : tierBest(b) === 2 ? 'Tier-2' : 'Tier-3'),
        num: (b) => tierBest(b),
        better: 'low',
      },
      { label: 'Years in business', render: (b) => `${new Date().getFullYear() - b.founded} yrs`, num: (b) => b.founded, better: 'low' },
    ],
  },
  {
    title: 'Trading costs',
    rows: [
      { label: 'EUR/USD spread', render: (b) => `${b.spread_eurusd} pips`, num: (b) => b.spread_eurusd, better: 'low' },
      { label: 'Commission / lot', render: (b) => (b.commission_value === 0 ? 'None' : `$${b.commission_value.toFixed(2)}`), num: (b) => b.commission_value, better: 'low' },
      { label: 'All-in cost / lot', render: (b) => `${allInCost(b)} pips`, num: (b) => allInCost(b), better: 'low' },
      { label: 'Minimum deposit', render: (b) => fmtMoney(b.min_deposit), num: (b) => b.min_deposit, better: 'low' },
      { label: 'Inactivity fee', render: (b) => (b.inactivity_fee.toLowerCase().startsWith('none') ? 'None' : b.inactivity_fee) },
      { label: 'Bonus', render: (b) => b.bonus ?? '—' },
    ],
  },
  {
    title: 'Execution & markets',
    rows: [
      { label: 'Execution speed', render: (b) => `${b.execution_ms} ms`, num: (b) => b.execution_ms, better: 'low' },
      { label: 'Platform uptime (90d)', render: (b) => `${b.uptime}%`, num: (b) => b.uptime, better: 'high' },
      { label: 'Max leverage', render: (b) => b.max_leverage, num: (b) => b.leverage_value, better: 'high' },
      { label: 'Tradable symbols', render: (b) => totalAssets(b).toLocaleString(), num: (b) => totalAssets(b), better: 'high' },
      { label: 'Trading platforms', render: (b) => b.platforms.join(', '), num: (b) => b.platforms.length, better: 'high' },
    ],
  },
  {
    title: 'Account features',
    rows: [
      { label: 'Demo account', render: () => '', bool: (b) => b.demo_account },
      { label: 'Islamic / swap-free', render: () => '', bool: (b) => b.islamic_account },
      { label: 'Copy trading', render: () => '', bool: (b) => b.copy_trading },
      { label: 'Scalping allowed', render: () => '', bool: (b) => b.scalping },
      { label: 'Hedging allowed', render: () => '', bool: (b) => b.hedging },
      { label: 'Negative balance protection', render: () => '', bool: (b) => b.nbp },
      { label: 'Segregated client funds', render: () => '', bool: (b) => b.segregated },
    ],
  },
  {
    title: 'Funding & support',
    rows: [
      { label: 'Avg withdrawal time', render: (b) => `~${fmtHours(b.withdrawal_hours)}`, num: (b) => b.withdrawal_hours, better: 'low' },
      { label: 'Deposit speed', render: (b) => b.deposit_time },
      { label: 'Payment methods', render: (b) => `${b.payments.length} options`, num: (b) => b.payments.length, better: 'high' },
      { label: 'Support quality', render: (b) => `${b.support_score} / 100`, num: (b) => b.support_score, better: 'high' },
      { label: 'Support channels', render: (b) => b.support_channels.join(', ') },
    ],
  },
];

export default function Compare() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    fetchBrokers()
      .then(setBrokers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load brokers'))
      .finally(() => setLoading(false));
  }, []);

  useSEO(staticPageSeo.compare, [
    buildWebPageJsonLd(staticPageSeo.compare),
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Compare', path: '/compare' },
    ]),
  ]);

  const slugs = useMemo(
    () => [params.get('a'), params.get('b'), params.get('c')].filter((s): s is string => !!s),
    [params]
  );

  // Preselect the two highest-rated brokers when nothing is chosen.
  useEffect(() => {
    if (!loading && brokers.length >= 2 && slugs.length === 0) {
      setParams({ a: brokers[0].slug, b: brokers[1].slug }, { replace: true });
    }
  }, [loading, brokers, slugs.length, setParams]);

  const selected = useMemo(
    () => slugs.map((s) => brokers.find((b) => b.slug === s)).filter((b): b is Broker => !!b),
    [slugs, brokers]
  );

  // comparison tracking — one event per unique matchup per session
  const trackedRef = useRef('');
  useEffect(() => {
    if (selected.length < 2) return;
    const key = selected.map((b) => b.slug).sort().join('|');
    if (trackedRef.current === key) return;
    trackedRef.current = key;
    track('comparison_run', { brokers: selected.map((b) => b.slug), count: selected.length });
  }, [selected]);

  const setSlot = (idx: number, slug: string) => {
    const keys = ['a', 'b', 'c'];
    const next: Record<string, string> = {};
    const current = [params.get('a'), params.get('b'), params.get('c')];
    keys.forEach((k, i) => {
      const v = i === idx ? slug : current[i];
      if (v) next[k] = v;
    });
    setParams(next);
  };

  const addSlot = () => {
    const remaining = brokers.find((b) => !slugs.includes(b.slug));
    if (remaining) setSlot(2, remaining.slug);
  };

  const removeSlot = (idx: number) => {
    const keys = ['a', 'b', 'c'];
    const current = [params.get('a'), params.get('b'), params.get('c')];
    const next: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (i !== idx && current[i]) next[k] = current[i]!;
    });
    setParams(next);
  };

  const badges = useMemo(() => {
    const map = new Map<string, { label: string; icon: 'overall' | 'value' | 'fast' | 'beginner' }[]>();
    if (selected.length < 2) return map;
    const push = (slug: string, label: string, icon: 'overall' | 'value' | 'fast' | 'beginner') => {
      map.set(slug, [...(map.get(slug) ?? []), { label, icon }]);
    };
    push([...selected].sort((a, b) => composite(b) - composite(a))[0].slug, 'Best overall', 'overall');
    push([...selected].sort((a, b) => allInCost(a) - allInCost(b))[0].slug, 'Lowest cost', 'value');
    push([...selected].sort((a, b) => a.execution_ms - b.execution_ms)[0].slug, 'Fastest', 'fast');
    const beginners = selected.filter((b) => b.best_for.includes('beginners'));
    if (beginners.length > 0)
      push([...beginners].sort((a, b) => b.rating - a.rating)[0].slug, 'Beginner pick', 'beginner');
    return map;
  }, [selected]);

  const winnerIdx = (rows: Metric): number[] => {
    if (!rows.num || !rows.better || selected.length < 2) return [];
    const nums = selected.map(rows.num);
    const best = rows.better === 'high' ? Math.max(...nums) : Math.min(...nums);
    return nums.map((n, i) => (n === best ? i : -1)).filter((i) => i >= 0);
  };

  if (loading)
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="h-40 animate-pulse rounded-3xl border border-line bg-white" />
        <div className="mt-6 h-[480px] animate-pulse rounded-3xl border border-line bg-white" />
      </div>
    );

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Comparison engine</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900">
          Compare <em className="serif-accent text-emerald-700">forex brokers</em> side by side
        </h1>
        <p className="mt-3 text-slate-500">
          Pick up to three brokers. Every row calls a winner from the data — no opinions required.
        </p>
      </div>

      {/* selector row */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((slot) => {
          const b = selected[slot];
          return (
            <div key={slot} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Broker {String.fromCharCode(65 + slot)}
                </span>
                {slot > 1 && b && (
                  <button
                    onClick={() => removeSlot(slot)}
                    className="text-xs font-semibold text-rose-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              {b ? (
                <div className="mt-2.5">
                  <div className="flex items-center gap-3">
                    <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={40} />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/brokers/${b.slug}`}
                        className="block truncate font-display text-base font-bold text-ink-900 hover:text-emerald-700"
                      >
                        {b.name}
                      </Link>
                      <Stars value={b.rating} size={12} />
                    </div>
                    <HealthRing score={healthScore(b)} size={52} stroke={5} />
                  </div>
                  {(badges.get(b.slug) ?? []).map((badge) => (
                    <span
                      key={badge.label}
                      className="mr-1.5 mt-2.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200"
                    >
                      {badge.icon === 'overall' && <Crown size={10} />}
                      {badge.icon === 'value' && <Award size={10} />}
                      {badge.icon === 'fast' && <Zap size={10} />}
                      {badge.icon === 'beginner' && <Trophy size={10} />}
                      {badge.label}
                    </span>
                  ))}
                  <select
                    value={b.slug}
                    onChange={(e) => setSlot(slot, e.target.value)}
                    className="mt-3 h-9 w-full rounded-lg border border-line bg-paper px-2.5 text-xs font-medium outline-none"
                  >
                    {brokers
                      .filter((o) => o.slug === b.slug || !slugs.includes(o.slug))
                      .map((o) => (
                        <option key={o.slug} value={o.slug}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                </div>
              ) : slot === 2 ? (
                <button
                  onClick={addSlot}
                  className="mt-3 w-full rounded-xl border-2 border-dashed border-line py-5 text-sm font-semibold text-slate-400 transition hover:border-emerald-400 hover:text-emerald-600"
                >
                  + Add a third broker
                </button>
              ) : (
                <p className="mt-3 rounded-xl bg-paper py-5 text-center text-sm text-slate-400">
                  Choose a broker
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* table */}
      {selected.length >= 2 && (
        <div className="mt-8 overflow-x-auto rounded-3xl border border-line bg-white shadow-soft">
          <table className="w-full min-w-[640px] border-collapse">
            <tbody>
              {GROUPS.map((group) => (
                <MetricSection key={group.title} group={group} selected={selected} winnerIdx={winnerIdx} />
              ))}
            </tbody>
          </table>
          <div className="grid border-t border-line" style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}>
            <div className="hidden border-r border-line bg-paper/70 p-4 sm:block" />
            {selected.map((b) => (
              <div key={b.slug} className="flex justify-center p-4">
                <VisitButton broker={b} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        Winner cells are highlighted purely from the underlying metric — highest or lowest value depending on
        what benefits the trader. Leverage highlights the highest offer; always check your local caps.
      </p>
    </div>
  );
}

function MetricSection({
  group,
  selected,
  winnerIdx,
}: {
  group: MetricGroup;
  selected: Broker[];
  winnerIdx: (m: Metric) => number[];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={selected.length + 1}
          className="border-b border-line bg-ink-950 px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-400"
        >
          {group.title}
        </td>
      </tr>
      {group.rows.map((row) => {
        const winners = winnerIdx(row);
        return (
          <tr key={row.label} className="border-b border-line last:border-0">
            <td className="sticky left-0 z-10 w-44 border-r border-line bg-paper px-5 py-3.5 text-xs font-bold text-slate-500 shadow-[6px_0_12px_-8px_rgba(13,18,12,0.15)] sm:w-48">
              {row.label}
            </td>
            {selected.map((b, i) => {
              const win = winners.includes(i);
              if (row.bool) {
                const ok = row.bool(b);
                return (
                  <td key={b.slug} className={`px-5 py-3.5 text-center ${win ? 'bg-emerald-50/60' : ''}`}>
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                        ok ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                    </span>
                  </td>
                );
              }
              return (
                <td
                  key={b.slug}
                  className={`tnum px-5 py-3.5 text-center text-sm font-semibold ${
                    win ? 'bg-emerald-50/60 text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {row.render(b)}
                  {win && (
                    <span className="ml-1.5 inline-block rounded-full bg-emerald-500 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wide text-white">
                      Best
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
