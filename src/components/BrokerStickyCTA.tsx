import type { Broker } from '../lib/types';
import VisitButton from './VisitButton';
import Monogram from './Monogram';

interface Props {
  broker: Broker;
}

export default function BrokerStickyCTA({ broker }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-3 py-2.5 shadow-[0_-8px_30px_rgba(15,23,42,0.10)] backdrop-blur-md sm:px-6 sm:py-3">
      <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-4">
        <Monogram
          name={broker.name}
          logoUrl={broker.logo_url}
          color={broker.brand_color}
          size={40}
          className="hidden shrink-0 rounded-xl ring-1 ring-line sm:flex"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink-950 sm:text-base">Open {broker.name} Account</p>
          <p className="hidden text-xs text-slate-500 sm:block">Review the broker details above before opening an account.</p>
        </div>
        <VisitButton broker={broker} compact className="shrink-0" />
      </div>
    </div>
  );
}
