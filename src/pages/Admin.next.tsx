import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { BarChart3, BookOpen, Globe2, Landmark, Languages, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import supabase from '../lib/supabase';
import type { Broker, ContentDocument, CountryLanguage, CountryPage, Guide, Intent, LocalizedSeoPage } from '../lib/types';
import { fetchBrokers, fetchCountries, fetchGuides, fetchIntents } from '../lib/api';
import CanonicalBrokerWorkspace from '../components/admin/CanonicalBrokerWorkspace';
import CanonicalEditorIndex from '../components/admin/CanonicalEditorIndex';
import CanonicalGuideWorkspace from '../components/admin/CanonicalGuideWorkspace';
import LocalizationWorkspace from '../components/admin/LocalizationWorkspace';
import AnalyticsPanel from './AnalyticsPanel';
import BrokerDataEditor from '../components/admin/BrokerDataEditor';

type Tab = 'overview' | 'brokers' | 'countries' | 'global' | 'localization' | 'analytics';
const ROLE_ACCESS: Record<Tab, string[]> = {
  overview: ['super_admin','admin','brokers_admin','content_admin','moderator'],
  brokers: ['super_admin','admin','brokers_admin'],
  countries: ['super_admin','admin','content_admin','brokers_admin'],
  global: ['super_admin','admin','content_admin'],
  localization: ['super_admin','admin','content_admin'],
  analytics: ['super_admin','admin','brokers_admin','content_admin','moderator'],
};
const TABS: { key: Tab; label: string; icon: typeof Landmark }[] = [
  { key:'overview', label:'Overview', icon:LayoutDashboard },
  { key:'brokers', label:'Brokers', icon:Landmark },
  { key:'countries', label:'Country Pages', icon:Globe2 },
  { key:'global', label:'Global', icon:BookOpen },
  { key:'localization', label:'Localization', icon:Languages },
  { key:'analytics', label:'Analytics', icon:BarChart3 },
];
const TAB_KEY = 'piprank-admin-active-tab';

function getSavedTab(): Tab {
  if (typeof window === 'undefined') return 'overview';
  const value = window.localStorage.getItem(TAB_KEY) as Tab | null;
  return value && TABS.some(t => t.key === value) ? value : 'overview';
}

export default function AdminNext() {
  const [session,setSession] = useState<Session|null>(null);
  const [checking,setChecking] = useState(true);
  const [role,setRole] = useState('checking');
  const [tab,setTab] = useState<Tab>(getSavedTab);
  const [menu,setMenu] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [brokers,setBrokers] = useState<Broker[]>([]);
  const [countries,setCountries] = useState<CountryPage[]>([]);
  const [guides,setGuides] = useState<Guide[]>([]);
  const [intents,setIntents] = useState<Intent[]>([]);
  const [docs,setDocs] = useState<ContentDocument[]>([]);
  const [languages,setLanguages] = useState<CountryLanguage[]>([]);
  const [localizedPages,setLocalizedPages] = useState<LocalizedSeoPage[]>([]);
  const [editingBroker,setEditingBroker] = useState<Broker|null>(null);

  const token = session?.access_token ?? '';
  const allowedTabs = useMemo(() => TABS.filter(t => ROLE_ACCESS[t.key].includes(role)), [role]);

  useEffect(() => {
    document.title = 'PipRank Content Management';
    let active = true;
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setChecking(false);
      setRole('none');
      setError('Authentication could not be initialized. Please refresh and try again.');
    }, 10000);

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(error.message || 'Unable to initialize authentication.');
          setSession(null);
          setRole('none');
        } else if (data.session) {
          setSession(data.session);
        } else {
          setSession(null);
          setRole('none');
        }
        setChecking(false);
      })
      .catch((error) => {
        if (!active) return;
        setError(error instanceof Error ? error.message : 'Unable to initialize authentication.');
        setSession(null);
        setRole('none');
        setChecking(false);
      })
      .finally(() => window.clearTimeout(timeout));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setRole(next ? 'checking' : 'none');
      setChecking(false);
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  },[]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setRole('checking');
    fetch('/api/admin-users?self=1',{headers:{Authorization:`Bearer ${session.access_token}`}})
      .then(async r => { const d = await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'Unable to resolve admin role'); return d; })
      .then(d => { if(active) setRole(String(d.role||'none')); })
      .catch(() => { if(active) setRole('none'); });
    return () => { active = false; };
  },[session?.user?.id]);

  const load = async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const [b,c,g,i,doc,langs,pages] = await Promise.all([
        fetchBrokers(), fetchCountries(), fetchGuides(), fetchIntents(),
        fetch('/api/content-documents',{headers:{Authorization:`Bearer ${token}`}}).then(async r => { const d=await r.json(); if(!r.ok) throw new Error(d.error||'Failed to load content'); return Array.isArray(d)?d:[]; }),
        fetch('/api/country-languages?admin=true',{headers:{Authorization:`Bearer ${token}`}}).then(async r => { const d=await r.json(); if(!r.ok) throw new Error(d.error||'Failed to load languages'); return Array.isArray(d)?d:[]; }),
        fetch('/api/localized-seo-pages?admin=true',{headers:{Authorization:`Bearer ${token}`}}).then(async r => { const d=await r.json(); if(!r.ok) throw new Error(d.error||'Failed to load localized pages'); return Array.isArray(d)?d:[]; }),
      ]);
      setBrokers(b); setCountries(c); setGuides(g); setIntents(i); setDocs(doc); setLanguages(langs); setLocalizedPages(pages);
    } catch(e) { setError(e instanceof Error ? e.message : 'Failed to load admin data'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if(role !== 'checking' && role !== 'none') load(); },[role,token]);

  useEffect(() => {
    if (!allowedTabs.some(t => t.key === tab)) setTab(allowedTabs[0]?.key ?? 'overview');
  },[allowedTabs,tab]);
  const changeTab = (next: Tab) => { setTab(next); setMenu(false); try { window.localStorage.setItem(TAB_KEY,next); } catch {} };

  const mutate = async (path:string, method:string, body:unknown, msg:string) => {
    const res = await fetch(path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||`Failed: ${msg}`);
    await load();
  };

  if(checking || role === 'checking') return <div className="min-h-screen bg-paper p-8 text-sm font-semibold text-slate-500">Loading PipRank Content Management…</div>;
  if(!session) return <div className="min-h-screen bg-paper p-8"><div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6"><h1 className="font-display text-xl font-bold">Sign in required</h1><p className="mt-2 text-sm text-slate-500">Sign in to access PipRank Content Management.</p></div></div>;
  if(role === 'none') return <div className="min-h-screen bg-paper p-8"><div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-white p-6"><h1 className="font-display text-xl font-bold text-rose-700">Access denied</h1><p className="mt-2 text-sm text-slate-500">This account does not have an admin role.</p></div></div>;

  const current = allowedTabs.find(t=>t.key===tab) ?? allowedTabs[0];
  const docCount = docs.filter(d=>d.published).length;
  const guideDocCount = docs.filter(d=>d.content_type==='guide'||d.content_type==='country-guide').length;

  return <div className="min-h-screen bg-paper text-ink-950">
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
        <button className="rounded-xl p-2 lg:hidden" onClick={()=>setMenu(v=>!v)} aria-label="Open navigation">{menu?<X size={19}/>:<Menu size={19}/>}</button>
        <div className="min-w-0 flex-1"><p className="font-display text-lg font-bold">PipRank <span className="text-emerald-600">Content Management</span></p><p className="hidden text-[11px] text-slate-400 sm:block">Brokers, Best-For pages, guides and localization</p></div>
        <span className="hidden rounded-full bg-paper px-3 py-1 text-xs font-bold text-slate-500 sm:inline-flex">{role.replaceAll('_',' ')}</span>
        <button onClick={()=>supabase.auth.signOut()} className="rounded-xl p-2 text-slate-500 hover:bg-paper" title="Sign out"><LogOut size={17}/></button>
      </div>
    </header>
    <div className="mx-auto flex max-w-[1500px]">
      <aside className={`${menu?'block':'hidden'} fixed inset-x-0 top-16 z-40 border-b border-line bg-white p-3 lg:static lg:block lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:bg-transparent lg:p-4`}>
        <nav className="space-y-1">{allowedTabs.map(item=>{const Icon=item.icon;return <button key={item.key} onClick={()=>changeTab(item.key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${tab===item.key?'bg-ink-950 text-white':'text-slate-600 hover:bg-white'}`}><Icon size={16}/>{item.label}</button>})}</nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">PipRank Content Management</p><h1 className="mt-1 font-display text-2xl font-bold">{current?.label}</h1></div>
        {error && <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button onClick={load} className="font-bold underline">Retry</button></div>}
        {loading ? <div className="h-80 animate-pulse rounded-2xl border border-line bg-white"/> : <>
          {tab==='overview' && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Brokers',brokers.length],['Countries',countries.length],['Published pages',docCount],['Guide documents',guideDocCount]].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-line bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 font-display text-3xl font-bold">{value}</p></div>)}</div><div className="grid gap-4 lg:grid-cols-3"><button onClick={()=>changeTab('brokers')} className="rounded-2xl border border-line bg-white p-5 text-left hover:border-emerald-300"><p className="font-display font-bold">Broker Editor</p><p className="mt-1 text-sm text-slate-500">Structured broker data and visual editorial content.</p></button><button onClick={()=>changeTab('global')} className="rounded-2xl border border-line bg-white p-5 text-left hover:border-emerald-300"><p className="font-display font-bold">Best-For Pages</p><p className="mt-1 text-sm text-slate-500">Global commercial pages and guides in the shared PageBuilder system.</p></button><button onClick={()=>changeTab('countries')} className="rounded-2xl border border-line bg-white p-5 text-left hover:border-emerald-300"><p className="font-display font-bold">Country Pages</p><p className="mt-1 text-sm text-slate-500">Country Best-For and country guide content.</p></button></div></div>}
          {tab==='brokers' && <div className="space-y-5">{editingBroker ? <BrokerDataEditor broker={editingBroker} token={token} onClose={()=>setEditingBroker(null)} onSaved={load}/> : <div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Broker Editor</p><h2 className="mt-1 font-display text-xl font-bold">Structured broker data</h2><p className="mt-1 text-sm text-slate-500">Edit fixed broker fields and open the visual editorial PageBuilder for the same broker.</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{brokers.map(b=><div key={b.id} className="rounded-xl border border-line bg-paper p-4"><p className="font-display text-sm font-bold">{b.name}</p><p className="mt-1 text-xs text-slate-400">/brokers/{b.slug}</p><div className="mt-3 flex gap-2"><button onClick={()=>setEditingBroker(b)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold">Edit broker</button></div></div>)}</div></div>}<CanonicalBrokerWorkspace brokers={brokers} token={token} onSaved={load}/></div>}
          {tab==='global' && <div className="space-y-6"><div><h2 className="font-display text-xl font-bold">Best-For Pages</h2><p className="mt-1 text-sm text-slate-500">Create and edit global commercial pages with fixed sections and PageBuilder blocks.</p></div><CanonicalEditorIndex mode="global" intents={intents} docs={docs} brokers={brokers} countries={countries} token={token} onSaved={load}/><div><h2 className="font-display text-xl font-bold">Guides</h2><p className="mt-1 text-sm text-slate-500">Edit global guides with the same broker-aware PageBuilder.</p></div><CanonicalGuideWorkspace guides={guides} brokers={brokers} countries={countries} docs={docs} token={token} onSaved={load}/></div>}
          {tab==='countries' && <div className="space-y-6"><div><h2 className="font-display text-xl font-bold">Country Pages</h2><p className="mt-1 text-sm text-slate-500">Country Best-For pages and country guides use the same editor architecture as global content.</p></div><CanonicalEditorIndex mode="country" intents={intents} docs={docs} brokers={brokers} countries={countries} token={token} onSaved={load}/><div className="rounded-2xl border border-line bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country Guides</p><p className="mt-1 text-sm text-slate-500">Choose a country to edit its guides.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{countries.map(c=><details key={c.slug} className="rounded-xl border border-line bg-paper"><summary className="cursor-pointer px-4 py-3 text-sm font-bold">{c.name}</summary><div className="border-t border-line p-3"><CanonicalGuideWorkspace guides={guides} brokers={brokers} countries={countries} docs={docs} token={token} countrySlug={c.slug} onSaved={load}/></div></details>)}</div></div></div>}
          {tab==='localization' && <LocalizationWorkspace countries={countries} languages={languages} pages={localizedPages} contentDocs={docs} mutate={mutate} accessToken={token}/>} 
          {tab==='analytics' && <AnalyticsPanel token={token} brokers={brokers}/>} 
        </>}
      </main>
    </div>
  </div>;
}
