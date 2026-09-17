import type { Broker } from '../lib/types';
import { pipRankScore } from '../lib/score';
import VisitButton from './VisitButton';

type Props = {
  broker: Broker;
  headline?: string;
  text?: string;
  showCta?: boolean;
};

/** Canonical PipRank Verdict presentation, matching the original broker-page treatment. */
export default function PipRankVerdictCard({ broker, headline, text, showCta = true }: Props) {
  const score = pipRankScore(broker);

  return (
    <section className="-mx-5 w-[calc(100%+2.5rem)] rounded-none border-y border-emerald-200 bg-emerald-50/50 p-5 sm:mx-0 sm:w-full sm:rounded-3xl sm:border sm:p-8" aria-label={`PipRank verdict for ${broker.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">PipRank verdict</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">{headline || `Is ${broker.name} right for you?`}</h2>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-emerald-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PipRank score</p>
          <p className="tnum mt-0.5 font-display text-2xl font-bold text-ink-900">{score}<span className="text-xs font-semibold text-slate-400">/100</span></p>
        </div>
      </div>

      <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-700">
        {text || `${broker.tagline}. ${broker.best_for?.length ? `PipRank considers ${broker.name} relevant for ${broker.best_for.slice(0, 3).join(', ')}.` : 'Review the costs, regulation, platforms and account features before deciding.'}`}
      </p>

      {broker.best_for.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {broker.best_for.slice(0, 6).map((item) => (
            <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-emerald-100">Best for {item}</span>
          ))}
        </div>
      )}

      {showCta && (
        <div className="mt-6 flex flex-col gap-3 border-t border-emerald-200/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-ink-900">Ready to check {broker.name}?</p>
            <p className="mt-1 text-xs text-slate-500">Open an account directly through PipRank.</p>
          </div>
          <VisitButton broker={broker} className="w-full sm:w-auto" />
        </div>
      )}
    </section>
  );
}
