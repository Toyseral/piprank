import type { ReactNode } from 'react';
import type { Broker, BrokerContent } from '../lib/types';
import { fmtMoney } from '../lib/format';

export type StructuredBrokerSection =
  | 'overview'
  | 'pricing'
  | 'trust'
  | 'platforms'
  | 'accounts'
  | 'funding'
  | 'features'
  | 'editorial';

type Props = {
  broker: Broker;
  content?: BrokerContent | null;
  section: StructuredBrokerSection;
  editorial?: ReactNode;
};

function Shell({ title, children, editorial }: { title: string; children: ReactNode; editorial?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7">
      <div className="border-b border-line pb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Broker data</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink-950">{title}</h2>
      </div>
      <div className="pt-6">{children}</div>
      {editorial ? <div className="mt-6 border-t border-line pt-6">{editorial}</div> : null}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return <div className="overflow-hidden rounded-2xl border border-line"><table className="w-full border-collapse"><tbody>{rows.filter(([, value]) => value !== '').map(([label, value]) => <tr key={label}><th className="w-1/3 border-b border-line bg-paper px-4 py-3 text-left text-xs font-bold text-ink-900 last:border-b-0">{label}</th><td className="border-b border-line px-4 py-3 text-sm font-medium text-slate-700 last:border-b-0">{value}</td></tr>)}</tbody></table></div>;
}

function Bool({ value }: { value: boolean }) { return value ? 'Yes' : 'No'; }

export default function StructuredBrokerDataCard({ broker, content, section, editorial }: Props) {
  if (section === 'overview') return <Shell title={`${broker.name} at a glance`} editorial={editorial}><Rows rows={[
    ['Rating', `${broker.rating.toFixed(1)} / 5`],
    ['Trust score', `${broker.trust_score}/100`],
    ['Minimum deposit', fmtMoney(broker.min_deposit)],
    ['EUR/USD spread', `${broker.spread_eurusd} pips`],
    ['Commission', broker.commission || '—'],
    ['Platforms', broker.platforms.join(' · ') || '—'],
    ['Founded', String(broker.founded)],
    ['Headquarters', broker.headquarters],
  ]} /></Shell>;

  if (section === 'pricing') return <Shell title="Fees & Spreads" editorial={editorial}><Rows rows={[
    ['EUR/USD typical spread', `${broker.spread_eurusd} pips`],
    ['Commission', broker.commission || '—'],
    ['Commission per lot', broker.commission_value === 0 ? 'None' : `$${broker.commission_value}/lot`],
    ['Minimum deposit', fmtMoney(broker.min_deposit)],
    ['Withdrawal fee', broker.withdrawal_fee === 0 ? 'None' : fmtMoney(broker.withdrawal_fee)],
    ['Inactivity fee', broker.inactivity_fee || '—'],
    ['Account types', broker.account_types.join(' · ') || '—'],
  ]} /></Shell>;

  if (section === 'trust') return <Shell title="Regulation & Trust" editorial={editorial}><div className="space-y-4"><Rows rows={[
    ['Regulators', broker.regulations.map(r => r.body).filter(Boolean).join(' · ') || 'Not listed'],
    ['Jurisdictions', broker.regulations.map(r => r.country).filter(Boolean).join(' · ') || 'Not listed'],
    ['Licence tiers', broker.regulations.map(r => `${r.body}: Tier ${r.tier}`).join(' · ') || 'Not listed'],
    ['Negative balance protection', Bool(broker.nbp)],
    ['Segregated funds', Bool(broker.segregated)],
    ['Hedging', Bool(broker.hedging)],
    ['Scalping', Bool(broker.scalping)],
    ['Risk warning', broker.risk_warning || '—'],
  ]} /></div></Shell>;

  if (section === 'platforms') return <Shell title="Trading Platforms" editorial={editorial}><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{(content?.platforms?.length ? content.platforms : broker.platforms.map(name => ({ name, summary: '', features: [] }))).map(platform => <article key={platform.name} className="rounded-2xl border border-line bg-paper p-4"><h3 className="font-display font-bold text-ink-950">{platform.name}</h3>{platform.summary ? <p className="mt-2 text-sm leading-6 text-slate-600">{platform.summary}</p> : null}{platform.features?.length ? <ul className="mt-3 space-y-1 text-xs text-slate-600">{platform.features.map(feature => <li key={feature}>• {feature}</li>)}</ul> : null}</article>)}</div><Rows rows={[
    ['Copy trading', Bool(broker.copy_trading)],
    ['Islamic / swap-free', Bool(broker.islamic_account)],
    ['Median execution', `${broker.execution_ms} ms`],
    ['Uptime', `${broker.uptime}%`],
    ['Tradable symbols', String(Object.values(broker.assets).reduce((a, b) => a + b, 0))],
  ]} /></div></Shell>;

  if (section === 'accounts') return <Shell title="Account Types" editorial={editorial}><div className="grid gap-3 sm:grid-cols-2">{(content?.accounts?.length ? content.accounts : broker.account_types.map(name => ({ name, spread_from: `${broker.spread_eurusd} pips`, commission: broker.commission, min_deposit: fmtMoney(broker.min_deposit), best_for: 'Standard conditions' }))).map(account => <article key={account.name} className="rounded-2xl border border-line bg-paper p-4"><h3 className="font-display font-bold text-ink-950">{account.name}</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-400">Spread from</dt><dd className="mt-1 font-bold text-ink-900">{account.spread_from}</dd></div><div><dt className="text-slate-400">Commission</dt><dd className="mt-1 font-bold text-ink-900">{account.commission}</dd></div><div><dt className="text-slate-400">Min deposit</dt><dd className="mt-1 font-bold text-ink-900">{account.min_deposit}</dd></div><div><dt className="text-slate-400">Best for</dt><dd className="mt-1 font-bold text-ink-900">{account.best_for}</dd></div></dl></article>)}</div></Shell>;

  if (section === 'funding') return <Shell title="Deposit & Withdraw" editorial={editorial}><Rows rows={[
    ['Deposit time', broker.deposit_time || '—'],
    ['Withdrawal time', broker.withdrawal_hours ? `~${broker.withdrawal_hours} hours` : '—'],
    ['Withdrawal fee', broker.withdrawal_fee === 0 ? 'None' : fmtMoney(broker.withdrawal_fee)],
    ['Payment methods', broker.payments.join(' · ') || 'Not listed'],
    ['Bonus', broker.bonus || 'None listed'],
  ]} /><div className="mt-4 overflow-x-auto"><table className="w-full border-collapse rounded-2xl border border-line"><thead><tr className="bg-paper text-left text-xs font-bold"><th className="px-4 py-3">Method</th><th className="px-4 py-3">Deposit</th><th className="px-4 py-3">Withdrawal</th><th className="px-4 py-3">Fee</th></tr></thead><tbody>{(content?.payments ?? []).map(payment => <tr key={payment.method} className="border-t border-line text-sm"><td className="px-4 py-3 font-semibold">{payment.method}</td><td className="px-4 py-3">{payment.deposit}</td><td className="px-4 py-3">{payment.withdrawal}</td><td className="px-4 py-3">{payment.fee}</td></tr>)}</tbody></table></div></Shell>;

  if (section === 'features') return <Shell title="Features & Trading Conditions" editorial={editorial}><Rows rows={[
    ['Demo account', Bool(broker.demo_account)],
    ['Islamic account', Bool(broker.islamic_account)],
    ['Copy trading', Bool(broker.copy_trading)],
    ['Scalping', Bool(broker.scalping)],
    ['Hedging', Bool(broker.hedging)],
    ['Support', broker.support_channels.join(' · ') || 'Not listed'],
  ]} /></Shell>;

  return <Shell title={`What we like about ${broker.name}`} editorial={editorial}><div className="grid gap-5 sm:grid-cols-2"><div><h3 className="font-display font-bold text-ink-950">What we like</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{broker.pros.map(item => <li key={item}>✓ {item}</li>)}</ul></div><div><h3 className="font-display font-bold text-ink-950">Watch out for</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{broker.cons.map(item => <li key={item}>• {item}</li>)}</ul></div></div></Shell>;
}
