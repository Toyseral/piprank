import { useMemo } from 'react';
import type { Broker, ContentDocument, CountryPage, Guide } from '../../lib/types';
import CanonicalGuideList from './CanonicalGuideList';

export default function CanonicalGuideWorkspace({ guides, brokers, countries, docs, token, countrySlug, onSaved }: { guides:Guide[]; brokers:Broker[]; countries:CountryPage[]; docs:ContentDocument[]; token:string; countrySlug?:string; onSaved:()=>Promise<void>|void }) {
 const filtered=useMemo(()=>countrySlug?guides:guides,[guides,countrySlug]);
 return <div className="space-y-4"><div className="rounded-2xl border border-line bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Canonical guides</p><h2 className="mt-1 font-display text-xl font-bold text-ink-950">{countrySlug?`${countrySlug} guides`:'Global guides'}</h2><p className="mt-1 text-sm text-slate-500">Guide body content is edited in PageBuilder and stored in content_documents. The legacy guide row remains the guide metadata source.</p></div><CanonicalGuideList guides={filtered} brokers={brokers} countries={countries} token={token} countrySlug={countrySlug} onSaved={onSaved}/></div>;
}
