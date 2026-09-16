import { ArrowRight, Sparkles } from 'lucide-react';
import { MATCH_CTA_COPY } from '../../lib/pageBuilderSchema';

type MatchCTAProps = {
  href?: string;
  compact?: boolean;
  className?: string;
};

/**
 * Reusable conversion component for the broker-matching experience.
 * Keep the product language consistent across country, best-for, guide and
 * broker templates while allowing each template to choose its presentation.
 */
export default function MatchCTA({ href = '/match', compact = false, className = '' }: MatchCTAProps) {
  if (compact) {
    return (
      <a
        href={href}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg ${className}`}
      >
        {MATCH_CTA_COPY.button}
        <ArrowRight size={16} aria-hidden="true" />
      </a>
    );
  }

  return (
    <section className={`overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-8 ${className}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
            <Sparkles size={14} aria-hidden="true" />
            Personalized broker matching
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
            {MATCH_CTA_COPY.primary}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Tell us what matters to you and get broker recommendations matched to your trading needs, preferences and country.
          </p>
        </div>
        <a
          href={href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          {MATCH_CTA_COPY.button}
          <ArrowRight size={17} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
