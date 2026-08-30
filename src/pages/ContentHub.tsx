import { useEffect, useMemo, useState } from 'react';
import { FileText, Globe2, Layers3, Plus, Save, Search } from 'lucide-react';
import supabase from '../lib/supabase';
import PageBuilder, { type PageBlock } from '../components/PageBuilder';

type Country = { id:number; name:string; slug:string };
type Intent = { id:number; label:string; slug:string; title?:string };
type Doc = { id:number; content_key:string; content_type:string; country_slug:string|null; topic_slug:string|null; slug:string|null; title:string; excerpt:string; html:string; blocks:PageBlock[]; seo_title:string|null; seo_description:string|null; indexable:boolean; published:boolean; settings:any };
type Guide = { id:number; title:string; slug:string; excerpt:string; category:string; level:string; minutes:number; image:string; sections:{heading:string;body:string[];bullets?:string[]}[]; published:string };
type BestFor = { id:number; country_id:number; country_name?:string; country_slug?:string; intent_id:number|null; slug:string; label:string; title:string; meta_title:string|null; meta_description:string|null; intro:string[]; icon:string; criteria:string[]; sections:{heading:string;body:string[];bullets?:string[]}[]; faqs:{q:string;a:string}[]; indexable:boolean; sort_order:number };

type Mode = 'global-seo'|'global-guide'|'country-guide'|'best-for';

const textFromHtml = (html:string) => html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const guideToBlocks = (sections:Guide['sections']):PageBlock[] => sections.flatMap((s,i)=>[
  {id:`legacy_h_${i}`,type:'heading',title:s.heading},
  ...(s.body||[]).map((p,j)=>({id:`legacy_p_${i}_${j}`,type:'richtext' as const,html:`<p>${p}</p>`})),
  ...((s.bullets||[]).length ? [{id:`legacy_b_${i}`,type:'richtext' as const,html:`<ul>${(s.bullets||[]).map(b=>`<li>${b}</li>`).join('')}</ul>`}] : []),
]);
const bestToBlocks = (p:BestFor):PageBlock[] => [
  ...(p.intro||[]).map((x,i)=>({id:`intro_${i}`,type:'richtext' as const,html:`<p>${x}</p>`})),
  ...(p.sections||[]).flatMap((s,i)=>[
    {id:`s_h_${i}`,type:'heading' as const,title:s.heading},
    ...(s.body||[]).map((x,j)=>({id:`s_p_${i}_${j}`,type:'richtext' as const,html:`<p>${x}</p>`})),
    ...((s.bullets||[]).length?[{id:`s_b_${i}`,type:'richtext' as const,html:`<ul>${(s.bullets||[]).map(b=>`<li>${b}</li>`).join('')}</ul>`}]:[]),
  ]),
];
const blocksToSections = (blocks:PageBlock[]) => {
  const out:{heading:string;body:string[];bullets?:string[]}[]=[]; let current:{heading:string;body:string[];bullets?:string[]}|null=null;
  for(const b of blocks){
    if(b.type==='heading'){ current={heading:b.title||'Section',body:[]}; out.push(current); continue; }
    if(!current){current={heading:'Overview',body:[]};out.push(current);}
    if(b.type==='richtext'){ const html=b.html||''; const lis=[...html.matchAll(/<li[^>]*>(.*?)<\/li>/gis)].map(m=>textFromHtml(m[1])); if(lis.length){current.bullets=[...(current.bullets||[]),...lis];} else {const t=textFromHtml(html); if(t) current.body.push(t);} }
    if(b.type==='callout'){const t=textFromHtml(b.html||'');if(t)current.body.push(t);}
  }
  return out;
};

export default function ContentHub(){
  const [mode,setMode]=useState<Mode>('global-seo');
  const [countries,setCountries]=useState<Country[]>([]); const [intents,setIntents]=useState<Intent[]>([]);
  const [docs,setDocs]=useState<Doc[]>([]); const [guides,setGuides]=useState<Guide[]>([]); const [bestFors,setBestFors]=useState<BestFor[]>([]);
  const [country,setCountry]=useState(''); const [selectedId,setSelectedId]=useState<number|null>(null); const [query,setQuery]=useState('');
  const [title,setTitle]=useState(''); const [slug,setSlug]=useState(''); const [excerpt,setExcerpt]=useState(''); const [seoTitle,setSeoTitle]=useState(''); const [seoDescription,setSeoDescription]=useState(''); const [published,setPublished]=useState(true); const [indexable,setIndexable]=useState(true); const [category,setCategory]=useState('Basics'); const [level,setLevel]=useState('Beginner'); const [minutes,setMinutes]=useState(8); const [image,setImage]=useState('/images/guides/basics.jpg'); const [intentId,setIntentId]=useState(''); const [blocks,setBlocks]=useState<PageBlock[]>([]); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const token=async()=>{const {data}=await supabase.auth.getSession();return data.session?.access_token||''};
  const load=async()=>{const h={Authorization:`Bearer ${await token()}`}; const [c,i,d,g,b]=await Promise.all([fetch('/api/countries').then(r=>r.json()),fetch('/api/intents').then(r=>r.json()),fetch('/api/content-documents',{headers:h}).then(r=>r.json()),fetch('/api/guides').then(r=>r.json()),fetch('/api/country-best-for').then(r=>r.json())]);setCountries(Array.isArray(c)?c:[]);setIntents(Array.isArray(i)?i:[]);setDocs(Array.isArray(d)?d:[]);setGuides(Array.isArray(g)?g:[]);setBestFors(Array.isArray(b)?b:[]);};
  useEffect(()=>{load().catch(e=>setMessage(e.message||'Failed to load content'));},[]);
  const countryBest=useMemo(()=>bestFors.filter(x=>!country||x.country_slug===country),[bestFors,country]);
  const countryDocs=useMemo(()=>docs.filter(x=>x.content_type==='country-guide'&&(!country||x.country_slug===country)),[docs,country]);
  const items = mode==='global-seo'?docs.filter(x=>x.content_type==='global-seo'):mode==='global-guide'?guides:mode==='country-guide'?countryDocs:countryBest;
  const visible=items.filter((x:any)=>`${x.title||x.label||''} ${x.slug||''}`.toLowerCase().includes(query.toLowerCase()));
  const reset=()=>{setSelectedId(null);setTitle('');setSlug('');setExcerpt('');setSeoTitle('');setSeoDescription('');setPublished(true);setIndexable(true);setCategory('Basics');setLevel('Beginner');setMinutes(8);setImage('/images/guides/basics.jpg');setIntentId('');setBlocks([]);};
  const edit=(item:any)=>{setSelectedId(item.id);setTitle(item.title||item.label||'');setSlug(item.slug||'');setExcerpt(item.excerpt||'');setSeoTitle(item.seo_title||item.meta_title||'');setSeoDescription(item.seo_description||item.meta_description||'');setPublished(item.published===undefined?true:!!item.published);setIndexable(item.indexable===undefined?true:!!item.indexable);setCategory(item.category||'Basics');setLevel(item.level||'Beginner');setMinutes(item.minutes||8);setImage(item.image||'/images/guides/basics.jpg');setIntentId(item.intent_id?String(item.intent_id):'');setBlocks(Array.isArray(item.blocks)?item.blocks:(mode==='global-guide'?guideToBlocks(item.sections||[]):mode==='best-for'?bestToBlocks(item):[]));};
  const save=async()=>{setBusy(true);setMessage('');try{const h={'Content-Type':'application/json',Authorization:`Bearer ${await token()}`};let res:Response;
    if(mode==='global-seo'||mode==='country-guide'){const body={id:selectedId||undefined,content_key:`${mode}:${country||'global'}:${slug}`,content_type:mode,country_slug:mode==='country-guide'?country:null,slug,title,excerpt,html:'',blocks,seo_title:seoTitle||null,seo_description:seoDescription||null,indexable,published};res=await fetch('/api/content-documents',{method:selectedId?'PUT':'POST',headers:h,body:JSON.stringify(body)});}
    else if(mode==='global-guide'){const body={id:selectedId||undefined,title,slug,excerpt,category,level,minutes,image,sections:blocksToSections(blocks),published:new Date().toISOString().slice(0,10)};res=await fetch('/api/guides',{method:selectedId?'PUT':'POST',headers:h,body:JSON.stringify(body)});}
    else {const body={id:selectedId||undefined,country_id:countries.find(c=>c.slug===country)?.id,intent_id:intentId?Number(intentId):null,slug,label:title,title,meta_title:seoTitle||null,meta_description:seoDescription||null,intro:[],sections:blocksToSections(blocks),faqs:[],indexable,sort_order:0};res=await fetch('/api/country-best-for',{method:selectedId?'PUT':'POST',headers:h,body:JSON.stringify(body)});}
    const data=await res.json();if(!res.ok)throw new Error(data.error||'Save failed');setMessage('Saved successfully');await load();if(data?.id)setSelectedId(data.id);
  }catch(e:any){setMessage(e.message||'Save failed')}finally{setBusy(false)}};
  const create=()=>{reset();if(mode==='country-guide'&&!country)setMessage('Select a country first');};
  return <div className="space-y-6">
    <div className="grid gap-3 md:grid-cols-4">{([['global-seo','Global SEO','Global SEO titles, descriptions and editorial pages'],['global-guide','Global Guides','Create and edit site-wide guides'],['country-guide','Country Guides','Create and edit guides for any country'],['best-for','Best-For Pages','Create and edit country recommendation pages']] as const).map(([k,l,d])=><button key={k} onClick={()=>{setMode(k);reset();}} className={`rounded-2xl border p-4 text-left ${mode===k?'border-emerald-500 bg-emerald-50':'border-line bg-white'}`}><div className="flex items-center gap-2 font-bold text-sm"><Layers3 size={15}/>{l}</div><p className="mt-1 text-xs text-slate-500">{d}</p></button>)}</div>
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="rounded-2xl border border-line bg-white p-4"><div className="flex items-center gap-2"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search content" className="w-full rounded-lg border border-line px-2.5 py-2 text-xs"/></div>{(mode==='country-guide'||mode==='best-for')&&<select value={country} onChange={e=>{setCountry(e.target.value);reset();}} className="mt-3 w-full rounded-lg border border-line px-2.5 py-2 text-xs"><option value="">Select country</option>{countries.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select>}<button onClick={create} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink-950 px-3 py-2.5 text-xs font-bold text-white"><Plus size={14}/> New page</button><div className="mt-4 space-y-1">{visible.map((x:any)=><button key={x.id} onClick={()=>edit(x)} className={`w-full rounded-xl p-3 text-left ${selectedId===x.id?'bg-ink-950 text-white':'hover:bg-paper'}`}><div className="truncate text-xs font-bold">{x.title||x.label}</div><div className="mt-1 truncate text-[10px] opacity-60">/{x.slug}</div></button>)}</div></aside>
      <section className="rounded-2xl border border-line bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-bold">{selectedId?'Edit':'Create'} {mode==='global-seo'?'SEO content':mode==='global-guide'?'global guide':mode==='country-guide'?'country guide':'Best-For page'}</h2><p className="mt-1 text-xs text-slate-500">Every editorial page uses the same visual Page Builder.</p></div><button onClick={save} disabled={busy||(!title.trim())} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{busy?'Saving…':'Save page'}</button></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Page title" className="input"/><input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="URL slug" className="input"/><input value={seoTitle} onChange={e=>setSeoTitle(e.target.value)} placeholder="SEO title" className="input"/><input value={seoDescription} onChange={e=>setSeoDescription(e.target.value)} placeholder="SEO description" className="input"/>{(mode==='global-guide')&&<><input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Category" className="input"/><input value={level} onChange={e=>setLevel(e.target.value)} placeholder="Level" className="input"/></>}{mode==='best-for'&&<select value={intentId} onChange={e=>setIntentId(e.target.value)} className="input"><option value="">No master intent</option>{intents.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select>}</div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold"><label><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Published</label><label><input type="checkbox" checked={indexable} onChange={e=>setIndexable(e.target.checked)}/> Indexable</label></div>
        <div className="mt-6"><PageBuilder value={blocks} onChange={setBlocks}/></div>{message&&<p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>}
      </section>
    </div>
  </div>;
}
