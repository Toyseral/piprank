import { BadgeCheck, ShieldCheck } from 'lucide-react';
import type { Broker } from '../../lib/types';
import { fmtMoney } from '../../lib/format';
import { pipRankScore } from '../../lib/score';
import Monogram from '../Monogram';
import VisitButton from '../VisitButton';

interface Props {
  broker: Broker;
  availabilityLabel?: string;
}

export default function BrokerHeroRedesign({ broker, availabilityLabel }: Props) {
  const facts = [
    { label: 'Platform', value: broker.platforms.slice(0, 2).join(' · ') || '—' },
    { label: 'Min deposit', value: fmtMoney(broker.min_deposit) },
    { label: 'PipRank Score', value: `${pipRankScore(broker)}/100` },
    { label: 'EUR/USD spread', value: `${broker.spread_eurusd} pips` },
  ];

  return (
    <section className="relative overflow-hidden bg-ink-950 px-6 py-8 sm:px-8" aria-labelledby="broker-hero-title">
      <div className="absolute inset-0 bg-grid-dark" aria-hidden="true" />
      <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-500/20 blur-[110px]" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
        <Monogram name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={80} className="shrink-0 rounded-2xl ring-2 ring-white/20 shadow-lg shadow-black/30" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 id="broker-hero-title" className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {broker.name} <span className="font-medium text-slate-400">Review</span>
            </h1>
            {availabilityLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-200">
                <BadgeCheck size={13} />
                {availabilityLabel}
              </span>
            )}
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{broker.tagline}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
            <ShieldCheck size={14} className="text-emerald-300" />
            <span>Regulation</span>
            <span className="text-slate-500">·</span>
            <span>
              {broker.regulations.length
                ? broker.regulations.map((regulation) => regulation.body).slice(0, 2).join(' · ')
                : 'Regulatory information available in this review'}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{fact.label}</p>
                <p className="tnum mt-1 font-display text-base font-bold text-white sm:text-lg">{fact.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 sm:max-w-sm">
            <VisitButton broker={broker} className="w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
