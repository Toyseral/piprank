import { useState } from 'react';
import type { Broker, ContentDocument, CountryPage, Intent } from '../../lib/types';
import CanonicalEditorHub from './CanonicalEditorHub';

export default function CanonicalEditorIndex({ mode, intents, docs, brokers, countries, token, onSaved }: { mode:'global'|'country'; intents:Intent[]; docs:ContentDocument[]; brokers:Broker[]; countries:CountryPage[]; token:string; onSaved:()=>Promise<void>|void }) {
 const [country,setCountry]=useState('');
 if(mode==='global') return <CanonicalEditorHub mode="global" intents={intents} docs={docs} brokers={brokers} countries={countries} token={token} onSaved={onSaved}/>;
 return <div className="space-y-4"><div className="rounded-2xl border border-line bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Canonical country Best-For</p><h2 className="mt-1 font-display text-xl font-bold text-ink-950">Country-specific editors</h2><select value={country} onChange={e=>setCountry(e.target.value)} className="mt-4 h-11 w-full max-w-sm rounded-xl border border-line bg-paper px-3 text-sm"><option value="">Select country</option>{countries.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>{country&&<CanonicalEditorHub mode="country" countrySlug={country} intents={intents} docs={docs} brokers={brokers} countries={countries} token={token} onSaved={onSaved}/>}</div>;
}
