import type { Broker } from '../lib/types';
import { pipRankScore } from '../lib/score';
import VisitButton from './VisitButton';

type Props = {
  broker: Broker;
  headline?: string;
  text?: string;
  showCta?: boolean;
};

/** Canonical PipRank Verdict presentation derived from the fc3fff3 broker review. */
export default function PipRankVerdictCard({ broker, headline, text, showCta = true }: Props) {
  const score = pipRankScore(broker);
  return (
    <section className="scroll-mt-28 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 sm:p-8" aria-label={`PipRank verdict for ${broker.name}`}>
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
      <div className="mt-4 max-w-3xl space-y-3 text-[15px] leading-relaxed text-slate-700">
        <p>{text || `${broker.tagline}. ${broker.best_for?.length ? `PipRank lists ${broker.name} for ${broker.best_for.slice(0, 3).join(', ')}.` : 'Review the costs, regulation, platforms and account features below before deciding.'}`}</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {broker.best_for.slice(0, 6).map((item) => <div key={item} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-emerald-100">Best for {item}</div>)}
      </div>
      {showCta && <div className="mt-5"><VisitButton broker={broker} className="w-full" /></div>}
    </section>
  );
}
