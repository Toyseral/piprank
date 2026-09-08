import { useEffect, useState } from 'react';
import type { Broker, CountryPage, ContentDocument } from '../../lib/types';
import CanonicalPageEditor from './CanonicalPageEditor';

const GLOBAL = new Set(['beginners','mt4','mt5','gold','low-spread','forex-brokers-for-beginners','mt4-forex-brokers','mt5-forex-brokers','gold-forex-brokers','low-spread-forex-brokers','forex-brokers-for-scalping','islamic-forex-brokers','ecn-forex-brokers','copy-trading-forex-brokers','forex-brokers-for-swing-trading','high-leverage-forex-brokers']);
const CANONICAL:Record<string,string>={beginners:'forex-brokers-for-beginners','low-spread':'low-spread-forex-brokers',mt4:'mt4-forex-brokers',mt5:'mt5-forex-brokers',gold:'gold-forex-brokers',scalping:'forex-brokers-for-scalping',islamic:'islamic-forex-brokers',ecn:'ecn-forex-brokers','copy-trading':'copy-trading-forex-brokers','swing-trading':'forex-brokers-for-swing-trading','high-leverage':'high-leverage-forex-brokers'};
export default function CanonicalEditorLauncher({ token, brokers, countries, kind, countrySlug, topicSlug, onClose, onSaved }: { token:string; brokers:Broker[]; countries:CountryPage[]; kind:'global'|'country'; countrySlug?:string; topicSlug:string; onClose:()=>void; onSaved:()=>Promise<void>|void }) {
 const [doc,setDoc]=useState<ContentDocument|null>(null);const [loading,setLoading]=useState(true);
 const canonicalTopic=CANONICAL[topicSlug]||topicSlug;
 useEffect(()=>{let active=true;const key=kind==='global'?`best-for:${CANONICAL[topicSlug]?topicSlug:topicSlug}`:`country-topic:${countrySlug}:${canonicalTopic}`;fetch(`/api/content-documents?key=${encodeURIComponent(key)}`).then(r=>r.ok?r.json():null).then(d=>{if(active)setDoc(d)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[kind,countrySlug,topicSlug,canonicalTopic]);
 if(!GLOBAL.has(topicSlug))return null;
 if(loading)return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-ink-950/50"><div className="rounded-2xl bg-white px-5 py-4 text-sm font-bold">Loading editor…</div></div>;
 const key=kind==='global'?`best-for:${topicSlug}`:`country-topic:${countrySlug}:${canonicalTopic}`;
 return <CanonicalPageEditor kind="best-for" document={doc} brokers={brokers} token={token} onClose={onClose} onSave={async(d,isNew)=>{const res=await fetch('/api/content-documents',{method:isNew?'POST':'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...d,id:isNew?undefined:d.id,content_key:key,content_type:'best-for',country_slug:kind==='country'?countrySlug:null,topic_slug:canonicalTopic,slug:d.slug||canonicalTopic})});const out=await res.json().catch(()=>({}));if(!res.ok)throw new Error(out.error||'Could not save canonical page');await onSaved();}}/>;
}
