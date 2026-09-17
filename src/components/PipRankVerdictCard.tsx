import type { Broker } from '../lib/types';
import { pipRankScore } from '../lib/score';
import VisitButton from './VisitButton';

type Props = {
  broker: Broker;
  headline?: string;
  text?: string;
  showCta?: boolean;
};

/** Canonical PipRank Verdict presentation used across broker and Best-For pages. */
export default function PipRankVerdictCard({ broker, headline, text, showCta = true }: Props) {
  const score = pipRankScore(broker);

  return (
    <section
      className="overflow-hidden rounded-[26px] border border-emerald-200 bg-white shadow-soft"
      aria-label={`PipRank verdict for ${broker.name}`}
    >
      <div className="border-b border-emerald-100 bg-emerald-50/70 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">PipRank verdict</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              {headline || `Is ${broker.name} right for you?`}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-ink-950 px-4 py-3 text-white shadow-sm">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">PipRank</span>
            <span className="tnum font-display text-2xl font-bold">{score}<span className="text-xs font-semibold text-slate-400">/100</span></span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <p className="max-w-4xl text-[15px] leading-7 text-slate-700">
          {text || `${broker.tagline}. ${broker.best_for?.length ? `PipRank lists ${broker.name} for ${broker.best_for.slice(0, 3).join(', ')}.` : 'Review the costs, regulation, platforms and account features before deciding.'}`}
        </p>

        {broker.best_for.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {broker.best_for.slice(0, 6).map((item) => (
              <span key={item} className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-slate-600">
                Best for {item}
              </span>
            ))}
          </div>
        )}

        {showCta && (
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-ink-950">Ready to check {broker.name}?</p>
              <p className="mt-1 text-xs text-slate-500">Open an account directly through PipRank.</p>
            </div>
            <VisitButton broker={broker} className="w-full sm:w-auto" />
          </div>
        )}
      </div>
    </section>
  );
}
