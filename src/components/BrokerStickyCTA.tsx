import { useState } from 'react';
import { X } from 'lucide-react';
import type { Broker } from '../lib/types';
import { pipRankScore, scoreColors } from '../lib/score';
import VisitButton from './VisitButton';
import Monogram from './Monogram';

interface Props {
  broker: Broker;
  onClose?: () => void;
}

export default function BrokerStickyCTA({ broker, onClose }: Props) {
  const [visible, setVisible] = useState(true);
  const score = pipRankScore(broker);
  const tone = scoreColors(score);

  if (!visible) return null;

  const close = () => {
    setVisible(false);
    onClose?.();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-700/80 bg-ink-950/98 text-white shadow-[0_-14px_40px_rgba(2,6,23,0.22)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
        <Monogram
          name={broker.name}
          logoUrl={broker.logo_url}
          color={broker.brand_color}
          size={40}
          className="hidden shrink-0 rounded-xl ring-1 ring-white/15 sm:flex"
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <p className="min-w-0 truncate font-display text-sm font-bold text-white sm:text-base">
              {broker.name} Review
            </p>
            <span className="hidden h-4 w-px bg-white/15 sm:block" aria-hidden="true" />
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-tight sm:text-xs ${tone.bg} ${tone.border} ${tone.text}`}
            >
              PipRank Score {score}/100
            </span>
          </div>
        </div>

        <VisitButton
          broker={broker}
          compact
          compactLabel={false}
          className="shrink-0 whitespace-nowrap"
        />

        <button
          type="button"
          onClick={close}
          aria-label="Close sticky broker CTA"
          title="Close"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
