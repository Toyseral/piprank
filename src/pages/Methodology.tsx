import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, ArrowRight, BadgeCheck, FlaskConical, Headphones, HeartPulse, Landmark, RefreshCw, Timer } from 'lucide-react';
import Reveal from '../components/Reveal';
import type { Broker } from '../lib/types';

const FACTORS = [
  {
    icon: Landmark,
    label: 'Regulation quality',
    weight: 30,
    color: '#1f8a5c',
    what: 'Tier-1 licences (FCA, ASIC, SEC/FINRA, MAS, FINMA) and the entity your account is contracted to.',
    how: 'Licences verified against regulator registers twice a year; entity-level scoring not brand marketing.',
  },
  {
    icon: Timer,
    label: 'Withdrawal reliability',
    weight: 20,
    color: '#38bdf8',
    what: 'Do payouts arrive, on time, at scale. The single best predictor of broker stress.',
    how: 'Timed real-money withdrawals in our lab, plus complaint scans and funding-rail uptime.',
  },
  {
    icon: Activity,
    label: 'Execution quality',
    weight: 15,
    color: '#a78bfa',
    what: 'Median fill speed, requote frequency and slippage during liquid and news windows.',
    how: '400+ market orders per broker per test cycle, measured from both our desktop and VPS accounts.',
  },
  {
    icon: FlaskConical,
    label: 'Years in business',
    weight: 15,
    color: '#f5b53f',
    what: 'Survival through cycles — franc shocks, crypto winters, rate regimes — compounds trust.',
    how: 'Founded date plus operational continuity record: no forced-client-fund interventions ever.',
  },
  {
    icon: Headphones,
    label: 'Customer support',
    weight: 10,
    color: '#f97316',
    what: 'Resolution quality, not just answer speed — can humans actually fix your problem?',
    how: 'First-response time across 3 attempts plus a seeded tricky-question test per broker.',
  },
  {
    icon: HeartPulse,
    label: 'User sentiment',
    weight: 10,
    color: '#fb7185',
    what: 'Where verified community reviews and complaint trends meet.',
    how: 'Weighted average of verified reviews on PipRank and signal-scored public complaints.',
  },
];

export default function Methodology() {
  const [params] = useSearchParams();
  const fromSlug = params.get('from') ?? '';
  const [fromBroker, setFromBroker] = useState<Broker | null>(null);

  // Restore the review the visitor was reading so the CTA continues their flow.
  useEffect(() => {
    if (!fromSlug) return;
    fetch(`/api/brokers?slug=${encodeURIComponent(fromSlug)}`)
      .then((x) => (x.ok ? x.json() : null))
      .then((b) => b && !b.error && setFromBroker(b))
      .catch(() => {});
  }, [fromSlug]);

  useEffect(() => {
    document.title = 'Broker Health Score Methodology — How PipRank Scores Brokers | PipRank';
    return () => {
      document.title = 'PipRank — Best Forex Brokers 2026: Reviews, Comparison & Free Trading Tools';
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Methodology
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
        How the Broker <em className="serif-accent text-emerald-700">Health Score</em> is computed
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
        Every number we publish can be traced back to a measurement we made with real money, or a register we
        checked. This is the formula, the sources, and the refresh cadence — in the open, on purpose.
      </p>

      {/* formula */}
      <Reveal>
        <div className="relative mt-10 overflow-hidden rounded-3xl bg-ink-950 p-6 sm:p-8">
          <div className="absolute inset-0 bg-grid-dark" />
          <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">The formula</p>
          <p className="tnum mt-3 font-mono text-sm leading-loose text-emerald-300 sm:text-base">
            Health = 30%·Regulation + 20%·Withdrawals + 15%·Execution
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 15%·Longevity + 10%·Support + 10%·Sentiment
          </p>
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate-400">
            Each factor is scored 0–100, weighted, summed, then rounded to the ring you see on review pages.
            Range 0–100. Recomputed monthly and on any licence change event.
          </p>
          </div>
        </div>
      </Reveal>

      {/* factor cards */}
      <div className="mt-10 space-y-4">
        {FACTORS.map((f, i) => (
          <Reveal key={f.label} delay={i * 0.05}>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: f.color }}>
                  <f.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold text-ink-900">{f.label}</p>
                  <p className="text-xs text-slate-500">{f.what}</p>
                </div>
                <div className="text-right">
                  <p className="tnum font-display text-2xl font-bold" style={{ color: f.color }}>
                    {f.weight}%
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">of the score</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
                <Reveal delay={0.1}>
                  <div className="h-full rounded-full" style={{ width: `${f.weight * 2.4}%`, background: f.color }} />
                </Reveal>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                <span className="font-bold text-ink-900">Measured by:</span> {f.how}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* honesty / refresh */}
      <Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="flex items-center gap-2 font-display font-bold text-ink-900">
              <RefreshCw size={16} className="text-emerald-600" /> Refresh cadence
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li>• Monthly full re-compute</li>
              <li>• Quarterly real-money withdrawal re-tests</li>
              <li>• Licence registers scanned twice a year</li>
              <li>• Complaint signals weighted weekly</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="flex items-center gap-2 font-display font-bold text-ink-900">
              <BadgeCheck size={16} className="text-emerald-600" /> What we don't do
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li>• No pay-to-rank, ever</li>
              <li>• No demo-only claims</li>
              <li>• No affiliate-rate weighting in any score</li>
              <li>• No deleting verified negative reviews</li>
            </ul>
          </div>
        </div>
      </Reveal>

      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-ink-900">
          {fromBroker
            ? `You were reading the ${fromBroker.name} review — pick up where you left off:`
            : 'See the ring in action on a live review:'}
        </p>
        <Link
          to={`/brokers/${fromBroker ? fromBroker.slug : 'interactive-brokers'}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-ink-800"
        >
          {fromBroker ? `Back to ${fromBroker.name} review` : 'Interactive Brokers review'}{' '}
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
