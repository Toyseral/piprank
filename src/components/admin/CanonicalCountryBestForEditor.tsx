import { useEffect, useState } from 'react';
import type { Broker, ContentDocument, CountryPage } from '../../lib/types';
import CanonicalPageEditor from './CanonicalPageEditor';
import { fetchContentDocument } from '../../lib/api';

const TOPICS=['forex-brokers-for-beginners','low-spread-forex-brokers','mt4-forex-brokers','mt5-forex-brokers','gold-forex-brokers','forex-brokers-for-scalping','islamic-forex-brokers','ecn-forex-brokers','copy-trading-forex-brokers','forex-brokers-for-swing-trading','high-leverage-forex-brokers'];
export default function CanonicalCountryBestForEditor({ country, topicSlug, token, brokers, countries, onClose, onSaved }: { country:CountryPage; topicSlug:string; token:string; brokers:Broker[]; countries:CountryPage[]; onClose:()=>void; onSaved:()=>Promise<void>|void }) {
 const [doc,setDoc]=useState<ContentDocument|null>(null); const [loading,setLoading]=useState(true);
 useEffect(()=>{fetchContentDocument(`country-topic:${country.slug}:${topicSlug}`).then(setDoc).finally(()=>setLoading(false))},[country.slug,topicSlug]);
 if(!TOPICS.includes(topicSlug))return null;
 if(loading)return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-ink-950/50"><div className="rounded-2xl bg-white px-5 py-4 text-sm font-bold">Loading country editor…</div></div>;
 return <CanonicalPageEditor kind="best-for" document={doc} brokers={brokers} token={token} onClose={onClose} onSave={async(d,isNew)=>{const r=await fetch('/api/content-documents',{method:isNew?'POST':'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...d,id:isNew?undefined:d.id,content_key:`country-topic:${country.slug}:${topicSlug}`,content_type:'country-topic',country_slug:country.slug,topic_slug:topicSlug,slug:topicSlug,title:d.title||`${topicSlug} in ${country.name}`})});const out=await r.json().catch(()=>({}));if(!r.ok)throw new Error(out.error||'Could not save country Best-For page');await onSaved();}}/>;
}
