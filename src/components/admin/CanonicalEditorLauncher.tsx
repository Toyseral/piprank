import { useEffect, useState } from 'react';
import type { Broker, ContentDocument, CountryPage } from '../../lib/types';
import BestForCanonicalPageEditor from './BestForCanonicalPageEditor';
import { fetchAdminContentDocument } from '../../lib/api';

type Props = { token: string; brokers: Broker[]; countries: CountryPage[]; kind: 'global'|'country'|'localized'; countrySlug?: string; topicSlug: string; locale?: string; onClose:()=>void; onSaved:()=>Promise<void>|void };

export default function CanonicalEditorLauncher({ token, brokers, countries, kind, countrySlug, topicSlug, locale, onClose, onSaved }: Props) {
  const [doc,setDoc]=useState<ContentDocument|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let active=true;
    const key=kind==='global' ? `best-for:${topicSlug}` : kind==='country' ? `country-best-for:${countrySlug}:${topicSlug}` : `localized-best-for:${countrySlug}:${locale}:${topicSlug}`;
    fetchAdminContentDocument(key, token).then((d: ContentDocument | null)=>{if(active)setDoc(d)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[kind,countrySlug,topicSlug,locale,token]);

  if(loading) return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-ink-950/50"><div className="rounded-2xl bg-white px-5 py-4 text-sm font-bold">Loading editor…</div></div>;

  return <BestForCanonicalPageEditor
    kind={kind}
    document={doc}
    brokers={brokers}
    countries={countries}
    token={token}
    countrySlug={countrySlug}
    topicSlug={topicSlug}
    locale={locale}
    onClose={onClose}
    onSave={async(d,isNew)=>{
      const contentKey=kind==='global' ? `best-for:${topicSlug}` : kind==='country' ? `country-best-for:${countrySlug}:${topicSlug}` : `localized-best-for:${countrySlug}:${locale}:${topicSlug}`;
      const contentType=kind==='global'?'global-best-for':kind==='country'?'country-best-for':'localized-best-for';
      const res=await fetch('/api/content-documents',{
        method:isNew?'POST':'PUT',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({...d,id:isNew?undefined:d.id,content_key:contentKey,content_type:contentType,country_slug:countrySlug||null,topic_slug:topicSlug,slug:d.slug||topicSlug,settings:{...(d.settings||{}),...(kind==='localized'?{locale}: {})}}),
      });
      const out=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(out.error||'Could not save canonical Best-For page');
      await onSaved();
    }}
  />;
}
