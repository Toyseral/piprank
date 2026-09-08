import { useState } from 'react';
import type { Broker } from '../../lib/types';
import CanonicalBrokerEditor from './CanonicalBrokerEditor';

export default function CanonicalBrokerWorkspace({ brokers, token, onSaved }: { brokers:Broker[]; token:string; onSaved:()=>Promise<void>|void }) {
 const [broker,setBroker]=useState<Broker|null>(null);
 if(broker)return <CanonicalBrokerEditor broker={broker} brokers={brokers} token={token} onClose={()=>setBroker(null)} onSaved={async()=>{await onSaved();setBroker(null)}}/>;
 return <div className="rounded-2xl border border-line bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Canonical broker content</p><h2 className="mt-1 font-display text-xl font-bold text-ink-950">Broker editorial workspace</h2><p className="mt-1 text-sm text-slate-500">One visual PageBuilder workspace for the broker profile. Fixed broker data remains in the broker editor; editorial blocks live here.</p></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{brokers.map(b=><button key={b.id} onClick={()=>setBroker(b)} className="rounded-xl border border-line bg-paper p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"><p className="font-display text-sm font-bold text-ink-950">{b.name}</p><p className="mt-1 text-xs text-slate-400">/brokers/{b.slug}</p></button>)}</div></div>;
}
