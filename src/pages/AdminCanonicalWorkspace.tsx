import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, Globe2, Landmark, Loader2, LogOut, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import type { Broker, ContentDocument, CountryPage, Guide, Intent } from '../lib/types';
import supabase from '../lib/supabase';
import { legacySectionsToBlocks, isBlockShape } from '../lib/contentBlocks';
import PageBuilder, { blocksToHtml, type PageBlock } from '../components/PageBuilder';
import CanonicalEditorIndex from '../components/admin/CanonicalEditorIndex';
import CanonicalBrokerWorkspace from '../components/admin/CanonicalBrokerWorkspace';

function AuthLoading() {
  return <div className="flex min-h-screen items-center justify-center bg-paper"><Loader2 className="animate-spin text-emerald-600" size={30} /></div>;
}

function GuideBuilderEditor({ guide, brokers, token, onClose, onSaved }: { guide: Guide; brokers: Broker[]; token: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const initial = useMemo<PageBlock[]>(() => {
    if (isBlockShape(guide.sections)) return guide.sections as PageBlock[];
    return legacySectionsToBlocks(guide.sections as any) as PageBlock[];
  }, [guide]);
  const [blocks, setBlocks] = useState<PageBlock[]>(initial);
  const [title, setTitle] = useState(guide.title);
  const [slug, setSlug] = useState(guide.slug);
  const [excerpt, setExcerpt] = useState(guide.excerpt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setBlocks(initial);
    setTitle(guide.title);
    setSlug(guide.slug);
    setExcerpt(guide.excerpt);
  }, [guide.id, initial]);

  const uploadImage = async (file: File) => {
    const reader = new FileReader();
    const data = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const res = await fetch('/api/content-assets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64: data }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Image upload failed');
    return out.url as string;
  };

  const save = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/guides', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: guide.id, title, slug, excerpt, sections: blocks, html: blocksToHtml(blocks, brokers) }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save guide');
      await onSaved();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save guide'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[140] flex items-center justify-center bg-ink-950/60 p-3"><div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg">
    <header className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white"><div className="min-w-0 flex-1"><p className="font-display text-lg font-bold">Edit guide</p><p className="text-xs text-slate-400">The guide uses the same PageBuilder blocks as Broker and Best-For pages.</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18}/></button></header>
    <main className="flex-1 overflow-y-auto p-5 sm:p-7">
      {error && <p className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-bold text-slate-600">Title</span><input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm"/></label><label><span className="text-xs font-bold text-slate-600">Slug</span><input value={slug} onChange={e=>setSlug(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm"/></label></div>
      <label className="mt-4 block"><span className="text-xs font-bold text-slate-600">Excerpt</span><textarea value={excerpt} onChange={e=>setExcerpt(e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm"/></label>
      <section className="mt-6 rounded-2xl border border-line bg-paper p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Guide content</p><p className="mt-1 text-xs text-slate-500">Add headings, text, broker cards, comparison tables, CTAs, callouts and other PageBuilder blocks.</p></div><button onClick={()=>setBlocks(b=>[...b,{id:`guide_${Date.now()}`,type:'richtext',html:'<p></p>'} as any])} className="rounded-xl bg-ink-950 px-3 py-2 text-xs font-bold text-white">+ Add Item</button></div><div className="mt-4 rounded-xl border border-line bg-white p-3"><PageBuilder value={blocks} onChange={setBlocks} onUploadImage={uploadImage}/></div></section>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4 text-sm font-bold">Published<input type="checkbox" checked={!!guide.published} onChange={()=>{}} disabled/></label><Link to={`/guides/${guide.slug}`} target="_blank" className="flex items-center justify-center rounded-xl border border-line bg-paper p-4 text-sm font-bold text-ink-900">View live guide →</Link></div>
    </main>
    <footer className="flex justify-end gap-2 border-t border-line px-5 py-4"><button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold text-slate-600">Cancel</button><button disabled={busy} onClick={save} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white">{busy?'Saving…':'Save guide'}</button></footer>
  </div></div>;
}

function GuideWorkspace({ guides, brokers, token, onSaved }: { guides: Guide[]; brokers: Broker[]; token: string; onSaved: () => Promise<void> }) {
  const [guide, setGuide] = useState<Guide | null>(null);
  return <div className="rounded-2xl border border-line bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Guide editor</p><h2 className="mt-1 font-display text-xl font-bold text-ink-950">Global guides</h2><p className="mt-1 text-sm text-slate-500">Every guide can use the same visual PageBuilder blocks.</p><div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">{guides.map(g=><div key={g.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-950">{g.title}</p><p className="text-xs text-slate-400">/guides/{g.slug}</p></div><Link to={`/guides/${g.slug}`} target="_blank" className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-paper">View</Link><button onClick={()=>setGuide(g)} className="rounded-lg bg-ink-950 px-3 py-2 text-xs font-bold text-white">Edit</button></div>)}</div>{guide&&<GuideBuilderEditor guide={guide} brokers={brokers} token={token} onClose={()=>setGuide(null)} onSaved={onSaved}/>}</div>;
}

export default function AdminCanonicalWorkspace() {
  const [session,setSession]=useState<Session|null>(null); const [role,setRole]=useState<string>('checking'); const [loading,setLoading]=useState(true); const [tab,setTab]=useState<'broker'|'global'|'country'|'guides'>('broker');
  const [brokers,setBrokers]=useState<Broker[]>([]); const [intents,setIntents]=useState<Intent[]>([]); const [countries,setCountries]=useState<CountryPage[]>([]); const [docs,setDocs]=useState<ContentDocument[]>([]); const [guides,setGuides]=useState<Guide[]>([]); const [error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);try{const [b,i,c,d,g]=await Promise.all([fetch('/api/brokers').then(r=>r.json()),fetch('/api/intents').then(r=>r.json()),fetch('/api/countries').then(r=>r.json()),fetch('/api/content-documents').then(r=>r.json()),fetch('/api/guides').then(r=>r.json())]);setBrokers(Array.isArray(b)?b:[]);setIntents(Array.isArray(i)?i:[]);setCountries(Array.isArray(c)?c:[]);setDocs(Array.isArray(d)?d:[]);setGuides(Array.isArray(g)?g:[]);setError('')}catch(e){setError(e instanceof Error?e.message:'Could not load CMS data')}finally{setLoading(false)}},[]);
  useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);if(!data.session){setRole('none');return;}fetch('/api/admin-users?self=1',{headers:{Authorization:`Bearer ${data.session.access_token}`}}).then(r=>r.ok?r.json():{role:null}).then(d=>setRole(d.role??'none')).catch(()=>setRole('none'));});const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);if(s)fetch('/api/admin-users?self=1',{headers:{Authorization:`Bearer ${s.access_token}`}}).then(r=>r.ok?r.json():{role:null}).then(d=>setRole(d.role??'none')).catch(()=>setRole('none'));else setRole('none')});return()=>sub.subscription.unsubscribe()},[]);
  useEffect(()=>{if(session&&role!=='none'&&role!=='checking')load()},[session,role,load]);
  if(!session||role==='none')return <div className="flex min-h-screen items-center justify-center bg-paper"><div className="rounded-2xl border border-line bg-white p-7 text-center"><p className="font-display text-xl font-bold text-ink-950">Admin access required</p><p className="mt-2 text-sm text-slate-500">Sign in through the main admin console first.</p><Link to="/archypage" className="mt-4 inline-flex rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white">Open admin</Link></div></div>;
  if(role==='checking'||loading)return <AuthLoading/>;
  const tabs=[['broker','Broker'],['global','Global Best-For'],['country','Country Best-For'],['guides','Guides']] as const;
  return <div className="min-h-screen bg-paper"><header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6"><Link to="/archypage" className="rounded-lg p-2 text-slate-400 hover:bg-paper"><ChevronLeft size={18}/></Link><div className="min-w-0 flex-1"><p className="font-display text-lg font-bold text-ink-950">PipRank Canonical CMS</p><p className="text-xs text-slate-400">Broker, Best-For and Guide PageBuilder editors</p></div><button onClick={()=>supabase.auth.signOut()} className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-rose-600"><LogOut size={17}/></button></div><div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">{tabs.map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold ${tab===key?'bg-ink-950 text-white':'text-slate-500 hover:bg-paper'}`}>{label}</button>)}</div></header><main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">{error&&<div className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}{tab==='broker'&&<CanonicalBrokerWorkspace brokers={brokers} token={session.access_token} onSaved={load}/>} {tab==='global'&&<CanonicalEditorIndex mode="global" intents={intents} docs={docs} brokers={brokers} countries={countries} token={session.access_token} onSaved={load}/>} {tab==='country'&&<CanonicalEditorIndex mode="country" intents={intents} docs={docs} brokers={brokers} countries={countries} token={session.access_token} onSaved={load}/>} {tab==='guides'&&<GuideWorkspace guides={guides} brokers={brokers} token={session.access_token} onSaved={load}/>}</main></div>;
}
