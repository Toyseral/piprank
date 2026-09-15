import type { Broker } from '../lib/types';
import type { StructuredBrokerSection } from './PageBuilder';
import { fmtMoney } from '../lib/format';

function DataCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-paper px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-semibold text-ink-900">{value || '—'}</p></div>;
}

function FixedSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"><div className="flex items-center justify-between gap-4 border-b border-line pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Broker data</p><h3 className="mt-1 font-display text-2xl font-bold text-ink-950">{title}</h3></div></div><div className="pt-5">{children}</div></section>;
}

export default function StructuredBrokerDataCard({ broker, section = 'overview' }: { broker: Broker; section?: StructuredBrokerSection }) {
  if (section === 'pricing') return <FixedSection title="Pricing & trading costs"><div className="grid gap-3 sm:grid-cols-2"><DataCard label="Minimum deposit" value={fmtMoney(broker.min_deposit)} /><DataCard label="EUR/USD spread" value={`${broker.spread_eurusd} pips`} /><DataCard label="Commission" value={broker.commission || '—'} /><DataCard label="Maximum leverage" value={broker.max_leverage || '—'} /></div></FixedSection>;

  if (section === 'trust') return <FixedSection title="Trust & regulation"><div className="grid gap-3 sm:grid-cols-2">{broker.regulations.map((regulation) => <div key={`${regulation.body}-${regulation.country}`} className="rounded-2xl bg-paper p-4"><p className="font-bold text-ink-950">{regulation.body}</p><p className="mt-1 text-xs text-slate-500">{regulation.country} · Tier {regulation.tier}</p></div>)}</div></FixedSection>;

  if (section === 'platforms') return <FixedSection title="Trading platforms"><div className="flex flex-wrap gap-2">{broker.platforms.map((platform) => <span key={platform} className="rounded-full border border-line bg-paper px-3 py-2 text-sm font-bold">{platform}</span>)}</div></FixedSection>;

  if (section === 'features') return <FixedSection title="Features & payments"><div className="grid gap-3 sm:grid-cols-2"><DataCard label="Demo account" value={broker.demo_account ? 'Available' : 'Not available'} /><DataCard label="Islamic account" value={broker.islamic_account ? 'Available' : 'Not available'} /><DataCard label="Copy trading" value={broker.copy_trading ? 'Available' : 'Not available'} /><DataCard label="Scalping" value={broker.scalping ? 'Allowed' : 'Not listed'} /><DataCard label="Hedging" value={broker.hedging ? 'Allowed' : 'Not listed'} /><DataCard label="Payment methods" value={(broker.payments || []).join(' · ')} /></div></FixedSection>;

  if (section === 'editorial') return <FixedSection title={`What we like about ${broker.name}`}><div className="grid gap-6 md:grid-cols-2"><div><h4 className="font-display text-lg font-bold text-ink-950">Pros</h4><ul className="mt-3 space-y-2">{broker.pros.length ? broker.pros.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />{item}</li>) : <li className="text-sm text-slate-500">No pros published yet.</li>}</ul></div><div><h4 className="font-display text-lg font-bold text-ink-950">Cons</h4><ul className="mt-3 space-y-2">{broker.cons.length ? broker.cons.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />{item}</li>) : <li className="text-sm text-slate-500">No cons published yet.</li>}</ul></div></div></FixedSection>;

  return <FixedSection title={`${broker.name} at a glance`}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><DataCard label="Rating" value={`${broker.rating.toFixed(1)} / 5`} /><DataCard label="Trust score" value={`${broker.trust_score}/100`} /><DataCard label="Minimum deposit" value={fmtMoney(broker.min_deposit)} /><DataCard label="EUR/USD spread" value={`${broker.spread_eurusd} pips`} /><DataCard label="Maximum leverage" value={broker.max_leverage || '—'} /><DataCard label="Founded" value={String(broker.founded || '—')} /></div></FixedSection>;
}
