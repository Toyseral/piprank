import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, Check, Clock, Info } from 'lucide-react';
import type { Broker, Promotion } from '../lib/types';
import { fetchBrokers } from '../lib/api';
import Monogram from '../components/Monogram';
import Stars from '../components/Stars';
import VisitButton from '../components/VisitButton';
import Reveal from '../components/Reveal';
import { btnCls } from '../components/Button';
import { scoreColors } from '../lib/score';

const BADGES = ['All', 'Deposit bonus', 'Welcome offer', 'Rebates', 'Cashback', 'Zero-swap', 'Prop funding'];

function endsChip(ends_on: string | null): { label: string; cls: string } | null {
  if (!ends_on) return null;
  const days = Math.ceil((new Date(ends_on + 'T23:59:59Z').getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Expired', cls: 'bg-slate-100 text-slate-400' };
  if (days <= 7) return { label: `Ends in ${days}d`, cls: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200' };
  if (days <= 30) return { label: `Ends in ${days}d`, cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' };
  return { label: `Ends ${new Date(ends_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, cls: 'bg-slate-100 text-slate-500' };
}

export default function Promotions() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [badge, setBadge] = useState('All');

  useEffect(() => {
    document.title = 'Forex Broker Promotions & Bonuses — Live Offers | PipRank';
    Promise.all([
      fetch('/api/promotions').then((x) => x.json()),
      fetchBrokers(),
    ])
      .then(([p, b]) => {
        setPromos(Array.isArray(p) ? p : []);
        setBrokers(b);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load promotions'))
      .finally(() => setLoading(false));
    return () => {
      document.title = 'PipRank — Best Forex Brokers 2026: Reviews, Comparison & Free Trading Tools';
    };
  }, []);

  const byId = useMemo(() => new Map(brokers.map((b) => [b.id, b])), [brokers]);

  const list = useMemo(() => {
    const base = promos
      .map((p) => ({ p, broker: byId.get(p.broker_id) }))
      .filter((x): x is { p: Promotion; broker: Broker } => !!x.broker)
      .filter((x) => badge === 'All' || x.p.badge === badge);
    // expire-soonest first; open-ended last
    return [...base].sort((a, b) => {
      const da = a.p.ends_on ? new Date(a.p.ends_on).getTime() : Infinity;
      const db = b.p.ends_on ? new Date(b.p.ends_on).getTime() : Infinity;
      return da - db || b.broker.rating - a.broker.rating;
    });
  }, [promos, byId, badge]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* header */}
      <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/15 blur-[110px]" />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-ink-950 shadow-lg shadow-amber-400/30">
            <BadgePercent size={24} />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Live broker promotions &amp; bonuses <span className="text-slate-500">(2026)</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">
            Currently-running offers from regulated brokers — every promotion lists its exact terms before you
            claim it. Bonuses change margin, not skill: read the fine print, then choose on our measured data.
          </p>
        </div>
      </div>

      {/* badge filter */}
      <div className="mt-7 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {BADGES.map((b) => (
          <button
            key={b}
            onClick={() => setBadge(b)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
              badge === b
                ? 'border-amber-400 bg-amber-400 text-ink-950'
                : 'border-line bg-white text-slate-500 hover:border-ink-900 hover:text-ink-900'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      )}
      {loading ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl border border-line bg-white" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-7 rounded-3xl border border-dashed border-line bg-white p-14 text-center">
          <BadgePercent size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 font-display text-lg font-bold text-ink-900">No live promotions right now</p>
          <p className="mt-1 text-sm text-slate-500">Broker offers rotate constantly — check back soon.</p>
        </div>
      ) : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {list.map(({ p, broker }, i) => {
            const tone = scoreColors(broker.trust_score);
            const ends = endsChip(p.ends_on);
            return (
              <Reveal key={p.id} delay={Math.min(i, 3) * 0.06}>
                <div className="flex h-full flex-col rounded-3xl border border-line bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-soft-lg sm:p-6">
                  <div className="flex items-start gap-3">
                    <Monogram name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={44} className="rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-bold text-ink-900">{broker.name}</h2>
                        <span className="inline-flex items-center gap-1">
                          <Stars value={broker.rating} size={11} />
                          <span className="tnum text-xs font-bold text-ink-900">{broker.rating.toFixed(1)}</span>
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.bg} ${tone.border} ${tone.text}`}>
                          Trust {broker.trust_score}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{broker.tagline}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-950">
                      {p.badge}
                    </span>
                    {ends && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${ends.cls}`}>
                        <Clock size={10} /> {ends.label}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 font-display text-lg font-bold leading-snug text-ink-900">{p.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{p.description}</p>

                  {p.terms && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-paper px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500">
                      <Info size={12} className="mt-0.5 shrink-0" />
                      {p.terms}
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-5">
                    <VisitButton broker={broker} compact />
                    <Link to={`/brokers/${broker.slug}`} className={btnCls('outline', 'sm')}>
                      Review
                    </Link>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* honesty note */}
      <div className="mt-8 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
        <Check size={17} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-900">
          We list promotions exactly as brokers advertise them and flag eligibility limits in the fine print.
          Rankings and ratings are never influenced by whether a broker is running a promotion. A bonus is
          margin credit, not free money — never chase one with capital you can't afford to trade.
        </p>
      </div>
    </div>
  );
}
