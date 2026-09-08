import { useEffect, useState } from 'react';
import type { Broker, ContentDocument } from '../../lib/types';
import CanonicalPageEditor from './CanonicalPageEditor';
import { fetchContentDocument } from '../../lib/api';

export default function CanonicalBrokerEditor({ broker, token, brokers, onClose, onSaved }: { broker:Broker; token:string; brokers:Broker[]; onClose:()=>void; onSaved:()=>Promise<void>|void }) {
 const [doc,setDoc]=useState<ContentDocument|null>(null); const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;fetchContentDocument(`broker:${broker.slug}:main`).then(d=>{if(active)setDoc(d)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[broker.slug]);
 if(loading)return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-ink-950/50"><div className="rounded-2xl bg-white px-5 py-4 text-sm font-bold">Loading broker editor…</div></div>;
 return <CanonicalPageEditor kind="broker" document={doc} brokers={brokers} token={token} onClose={onClose} onSave={async(d,isNew)=>{const r=await fetch('/api/content-documents',{method:isNew?'POST':'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...d,id:isNew?undefined:d.id,content_key:`broker:${broker.slug}:main`,content_type:'broker',slug:'main',title:d.title||`${broker.name} Review`})});const out=await r.json().catch(()=>({}));if(!r.ok)throw new Error(out.error||'Could not save broker content');await onSaved();}}/>;
}
