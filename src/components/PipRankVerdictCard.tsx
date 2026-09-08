import type { Broker } from '../lib/types';
import { pipRankBreakdown, pipRankScore } from '../lib/score';
import VisitButton from './VisitButton';

type Props = {
  broker: Broker;
  headline?: string;
  text?: string;
  showCta?: boolean;
};

/** Reusable production verdict card for broker templates and PageBuilder content. */
export default function PipRankVerdictCard({ broker, headline, text, showCta = true }: Props) {
  const score = pipRankScore(broker);
  const breakdown = pipRankBreakdown(broker);

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 sm:p-8" aria-label={`PipRank verdict for ${broker.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">PipRank verdict</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">{headline || `Is ${broker.name} right for you?`}</h2>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-emerald-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PipRank score</p>
          <p className="tnum mt-0.5 font-display text-2xl font-bold text-emerald-700">{score}<span className="text-xs font-semibold text-slate-400">/100</span></p>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-slate-700">
        {text || `${broker.tagline}. PipRank combines trust, broker health, trading costs, accessibility and overall rating to summarize decision fit.`}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(breakdown).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white px-4 py-3 ring-1 ring-emerald-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="tnum mt-0.5 font-display text-lg font-bold text-ink-900">{value}</p>
          </div>
        ))}
      </div>
      {showCta && <div className="mt-5"><VisitButton broker={broker} className="w-full" /></div>}
    </section>
  );
}
