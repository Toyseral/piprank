import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Broker, BrokerContent } from '../lib/types';
import { fmtMoney } from '../lib/format';

type Props = { broker: Broker; content?: BrokerContent | null };

export default function OriginalTradingPlatformsCard({ broker, content }: Props) {
  const [platformTab, setPlatformTab] = useState(0);
  const platformContent = broker.platforms.map((name) => content?.platforms?.find((p) => p.name === name) ?? {
    name,
    summary: `${name} is available at ${broker.name} with the broker's standard pricing and conditions.`,
    features: [],
  });
  const activePlatform = platformContent[Math.min(platformTab, platformContent.length - 1)] ?? platformContent[0];
  const assetBars = [
    { label: 'Forex pairs', value: broker.assets.forex },
    { label: 'Stock CFDs', value: broker.assets.stocks },
    { label: 'Crypto', value: broker.assets.crypto },
    { label: 'Commodities', value: broker.assets.commodities },
    { label: 'Indices', value: broker.assets.indices },
  ];
  const maxAsset = Math.max(...assetBars.map((a) => a.value), 1);

  return (
    <section className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold text-ink-900">Trading platforms at {broker.name}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {broker.copy_trading && <span className="rounded-xl bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-700">Copy trading built in</span>}
        {broker.islamic_account && <span className="rounded-xl bg-violet-100 px-3.5 py-2 text-xs font-bold text-violet-700">Islamic / swap-free accounts</span>}
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-line scrollbar-none">
        {platformContent.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setPlatformTab(i)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold transition ${i === platformTab ? 'border-emerald-600 text-ink-900' : 'border-transparent text-slate-400 hover:text-ink-900'}`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {activePlatform && (
        <div className="mt-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
          <h3 className="font-display text-lg font-bold text-ink-900">{broker.name} on {activePlatform.name}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{activePlatform.summary}</p>
          {activePlatform.features.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-3">
              {activePlatform.features.map((f) => (
                <li key={f} className="flex items-start gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-semibold leading-snug text-slate-700 ring-1 ring-line">
                  <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { l: 'Median execution', v: `${broker.execution_ms} ms` },
          { l: 'Platform uptime (90d)', v: `${broker.uptime}%` },
          { l: 'Tradable symbols', v: Object.values(broker.assets).reduce((a, b) => a + b, 0).toLocaleString() },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl bg-paper p-4 text-center">
            <p className="tnum font-display text-xl font-bold text-ink-900 sm:text-2xl">{s.v}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {assetBars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-semibold text-slate-500">{bar.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.max(4, (bar.value / maxAsset) * 100)}%` }} />
            </div>
            <span className="tnum w-12 text-right text-xs font-bold text-ink-900">{bar.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}