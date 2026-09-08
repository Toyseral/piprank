import { useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import type { Broker } from '../../lib/types';

const TEXT_FIELDS = [
  ['name', 'Name'], ['slug', 'Slug'], ['tagline', 'Tagline'], ['website', 'Website'],
  ['headquarters', 'Headquarters'], ['brand_color', 'Brand colour'], ['commission', 'Commission'],
  ['max_leverage', 'Max leverage'], ['deposit_time', 'Deposit time'], ['inactivity_fee', 'Inactivity fee'],
  ['bonus', 'Bonus'],
] as const;
const NUMBER_FIELDS = [
  ['rating', 'Rating'], ['trust_score', 'Trust score'], ['founded', 'Founded'], ['min_deposit', 'Minimum deposit'],
  ['spread_eurusd', 'EUR/USD spread'], ['commission_value', 'Commission value'], ['leverage_value', 'Leverage value'],
  ['execution_ms', 'Execution ms'], ['withdrawal_hours', 'Withdrawal hours'], ['uptime', 'Uptime'],
  ['withdrawal_fee', 'Withdrawal fee'], ['support_score', 'Support score'],
] as const;
const JSON_FIELDS = ['regulations', 'platforms', 'payments', 'account_types', 'best_for', 'pros', 'cons', 'review', 'testing', 'faqs', 'support_channels', 'assets', 'health'] as const;

function stringify(value: unknown) { return JSON.stringify(value ?? [], null, 2); }
function parse(value: string) { return JSON.parse(value); }

export default function BrokerDataEditor({ broker, token, onClose, onSaved }: {
  broker: Broker;
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const initial = useMemo(() => ({ ...broker } as Record<string, any>), [broker]);
  const [form, setForm] = useState<Record<string, any>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true); setError('');
    try {
      const payload: Record<string, any> = {};
      for (const [key] of TEXT_FIELDS) payload[key] = form[key] === '' ? null : form[key];
      for (const [key] of NUMBER_FIELDS) payload[key] = form[key] === '' || form[key] == null ? null : Number(form[key]);
      for (const key of JSON_FIELDS) payload[key] = form[key];
      payload.demo_account = Boolean(form.demo_account);
      payload.islamic_account = Boolean(form.islamic_account);
      payload.copy_trading = Boolean(form.copy_trading);
      payload.scalping = Boolean(form.scalping);
      payload.hedging = Boolean(form.hedging);
      payload.nbp = Boolean(form.nbp);
      payload.segregated = Boolean(form.segregated);
      payload.featured = Boolean(form.featured);
      const res = await fetch('/api/brokers', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: broker.id, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save broker');
      await onSaved();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save broker'); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[130] overflow-y-auto bg-ink-950/60 p-3 sm:p-6">
    <div className="mx-auto max-w-5xl rounded-3xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-7">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Broker data</p><h2 className="font-display text-xl font-bold text-ink-950">{broker.name}</h2></div>
        <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-paper"><X size={18}/></button>
      </div>
      <div className="space-y-7 p-5 sm:p-7">
        <section><h3 className="font-display text-sm font-bold text-ink-950">Identity & commercial data</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{TEXT_FIELDS.map(([key,label])=><label key={key} className="text-xs font-semibold text-slate-600">{label}<input value={form[key] ?? ''} onChange={e=>set(key,e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink-950 outline-none focus:border-emerald-400"/></label>)}</div></section>
        <section><h3 className="font-display text-sm font-bold text-ink-950">Metrics</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{NUMBER_FIELDS.map(([key,label])=><label key={key} className="text-xs font-semibold text-slate-600">{label}<input type="number" step="any" value={form[key] ?? ''} onChange={e=>set(key,e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink-950 outline-none focus:border-emerald-400"/></label>)}</div></section>
        <section><h3 className="font-display text-sm font-bold text-ink-950">Capabilities</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{['demo_account','islamic_account','copy_trading','scalping','hedging','nbp','segregated','featured'].map(key=><label key={key} className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(form[key])} onChange={e=>set(key,e.target.checked)}/>{key.replaceAll('_',' ')}</label>)}</div></section>
        <section><h3 className="font-display text-sm font-bold text-ink-950">Structured data</h3><div className="mt-3 grid gap-4 lg:grid-cols-2">{JSON_FIELDS.map(key=><label key={key} className="text-xs font-semibold capitalize text-slate-600">{key.replaceAll('_',' ')}<textarea defaultValue={stringify(form[key])} onChange={e=>{try{set(key,parse(e.target.value));}catch{/* keep invalid JSON local until corrected */}}} className="mt-1.5 min-h-28 w-full rounded-xl border border-line bg-paper p-3 font-mono text-xs text-ink-950 outline-none focus:border-emerald-400"/></label>)}</div></section>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-white px-5 py-4 sm:px-7"><button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold">Cancel</button><button disabled={saving} onClick={save} className="flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={15}/>{saving?'Saving…':'Save broker'}</button></div>
    </div>
  </div>;
}
