import { useEffect, useState } from 'react';
import type { Broker, ContentDocument, CountryPage } from '../../lib/types';
import CanonicalPageEditor from './CanonicalPageEditor';
import { fetchAdminContentDocument } from '../../lib/api';

const GLOBAL = new Set(['forex-brokers-for-beginners','mt5-forex-brokers','gold-forex-brokers','mt4-forex-brokers','low-spread-forex-brokers','forex-brokers-for-scalping','islamic-forex-brokers','ecn-forex-brokers','copy-trading-forex-brokers','forex-brokers-for-swing-trading','high-leverage-forex-brokers']);

type Props = { token: string; brokers: Broker[]; countries: CountryPage[]; kind: 'global'|'country'; countrySlug?: string; topicSlug: string; onClose:()=>void; onSaved:()=>Promise<void>|void };

export default function CanonicalEditorLauncher({ token, brokers, countries: _countries, kind, countrySlug, topicSlug, onClose, onSaved }: Props) {
  const [doc,setDoc]=useState<ContentDocument|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let active=true;
    const key=kind==='global' ? `best-for:${topicSlug}` : `country-best-for:${countrySlug}:${topicSlug}`;
    fetchAdminContentDocument(key, token).then((d: ContentDocument | null)=>{if(active)setDoc(d)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[kind,countrySlug,topicSlug,token]);

  if(!GLOBAL.has(topicSlug) && kind==='global') return null;
  if(loading) return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-ink-950/50"><div className="rounded-2xl bg-white px-5 py-4 text-sm font-bold">Loading editor…</div></div>;

  return <CanonicalPageEditor
    kind="best-for"
    document={doc}
    brokers={brokers}
    token={token}
    onClose={onClose}
    onSave={async(d,isNew)=>{
      const contentKey=kind==='global' ? `best-for:${topicSlug}` : `country-best-for:${countrySlug}:${topicSlug}`;
      const res=await fetch('/api/content-documents',{
        method:isNew?'POST':'PUT',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          ...d,
          id:isNew?undefined:d.id,
          content_key:contentKey,
          content_type:kind==='global'?'global-best-for':'country-best-for',
          country_slug:kind==='country'?countrySlug:null,
          topic_slug:topicSlug,
          slug:d.slug||topicSlug,
        }),
      });
      const out=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(out.error||'Could not save canonical page');
      await onSaved();
    }}
  />;
}
