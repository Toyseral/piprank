import { useState } from 'react';
import type { Broker } from '../../lib/types';
import BrokerDataEditor from './BrokerDataEditor';
import CanonicalBrokerEditor from './CanonicalBrokerEditor';

type Props = {
  brokers: Broker[];
  token: string;
  onSaved: () => Promise<void> | void;
};

type EditorMode = 'data' | 'content';

export default function UnifiedBrokerEditor({ brokers, token, onSaved }: Props) {
  const [broker, setBroker] = useState<Broker | null>(null);
  const [mode, setMode] = useState<EditorMode>('data');

  if (!broker) {
    return <section className="rounded-2xl border border-line bg-white p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Broker Editor</p>
        <h2 className="mt-1 font-display text-xl font-bold text-ink-950">Choose a broker</h2>
        <p className="mt-1 text-sm text-slate-500">Structured broker fields and visual editorial content are managed from the same broker workspace.</p>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {brokers.map((item) => <button key={item.id} onClick={() => { setBroker(item); setMode('data'); }} className="rounded-xl border border-line bg-paper p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50">
          <p className="font-display text-sm font-bold text-ink-950">{item.name}</p>
          <p className="mt-1 text-xs text-slate-400">/brokers/{item.slug}</p>
          <span className="mt-3 inline-flex rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600">Edit broker →</span>
        </button>)}
      </div>
    </section>;
  }

  if (mode === 'data') {
    return <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Broker Editor</p><h2 className="mt-1 font-display text-lg font-bold">Edit Broker: {broker.name}</h2></div>
          <div className="flex gap-2">
            <button onClick={() => setBroker(null)} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">All brokers</button>
            <button onClick={() => setMode('content')} className="rounded-xl bg-ink-950 px-3 py-2 text-xs font-bold text-white">Editorial Content</button>
          </div>
        </div>
      </div>
      <BrokerDataEditor broker={broker} token={token} onClose={() => setBroker(null)} onSaved={async () => { await onSaved(); }} />
    </div>;
  }

  return <CanonicalBrokerEditor broker={broker} brokers={brokers} token={token} onClose={() => setMode('data')} onSaved={async () => { await onSaved(); }} />;
}
