import { BadgeCheck, Gauge, Layers3, ShieldCheck, WalletCards } from 'lucide-react';
import type { Broker } from '../lib/types';
import { fmtMoney } from '../lib/format';

export default function BestForQuickFacts({ broker }: { broker: Broker }) {
  const facts = [
    { label: 'Minimum spread', value: `${broker.spread_eurusd} pips`, icon: Gauge },
    { label: 'Regulation', value: broker.regulations?.map((r) => r.body).filter(Boolean).join(' · ') || 'Not listed', icon: ShieldCheck },
    { label: 'Minimum deposit', value: fmtMoney(broker.min_deposit), icon: WalletCards },
    { label: 'Platforms', value: broker.platforms?.join(' · ') || 'Not listed', icon: Layers3 },
    { label: 'Maximum leverage', value: broker.max_leverage || 'Not listed', icon: BadgeCheck },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-ink-950 text-white shadow-soft" aria-label={`${broker.name} quick facts`}>
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Quick facts</p>
        <p className="mt-1 text-sm font-semibold text-slate-300">Key trading conditions at a glance</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-white/10 sm:grid-cols-5 sm:divide-y-0">
        {facts.map(({ label, value, icon: Icon }, index) => (
          <div key={label} className={`min-w-0 px-4 py-4 sm:px-5 sm:py-5 ${index === facts.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <Icon size={17} className="text-emerald-300" aria-hidden="true" />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-white">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
