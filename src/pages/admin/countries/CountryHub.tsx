import { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { Broker, ContentDocument, CountryBestFor, CountryPage } from '../../../lib/types';
import CountryGuides from '../CountryGuides';
import PageBuilder, { blocksToHtml, type PageBlock } from '../../../components/PageBuilder';

type Props = {
  countries: CountryPage[];
  brokers: Broker[];
  /** @deprecated retained by the dashboard while the legacy endpoint is retired. */
  countryBestFors?: CountryBestFor[];
  contentDocs: ContentDocument[];
  token: string;
  notify: (msg: string) => void;
  onNewCountry: () => void;
  onEditCountry: (country: CountryPage) => void;
  onEditCountryBestFor?: (page: CountryBestFor) => void;
  onNewCountryBestFor?: (countrySlug: string) => void;
};

function HubMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="rounded-xl border border-line bg-paper p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 font-display text-xl font-bold text-ink-900">{value}</p><p className="mt-0.5 text-[10px] text-slate-400">{sub}</p></div>;
}

function EntityPanel({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl border border-line bg-white p-5"><h3 className="font-display text-lg font-bold text-ink-900">{title}</h3><div className="mt-3 space-y-2">{items.map((item) => <div key={item} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-xs font-medium text-slate-600"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{item}</div>)}</div></div>;
}

function emptyDoc(country: string): ContentDocument {
  return { id: 0, content_key: `country-best-for:${country}:`, content_type: 'country-best-for', country_slug: country, topic_slug: null, slug: '', title: '', excerpt: '', html: '', blocks: [], seo_title: null, seo_description: null, indexable: true, published: false, updated_by: null, created_at: '', updated_at: '', settings: {} };
}

function CountryBestForEditor({ country, document, token, onClose, onSaved, notify }: { country: CountryPage; document: ContentDocument | null; token: string; onClose: () => void; onSaved: () => void; notify: (msg: string) => void }) {
  const [form, setForm] = useState<ContentDocument>(() => document ? { ...document } : emptyDoc(country.slug));
  const [blocks, setBlocks] = useState<PageBlock[]>(() => Array.isArray(document?.blocks) && document.blocks.length ? document.blocks as PageBlock[] : document?.html ? [{ id: 'legacy', type: 'richtext', html: document.html }] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const uploadImage = async (file: File) => {
    const reader = new FileReader();
    const data = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const res = await fetch('/api/content-assets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64: data }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Image upload failed');
    return out.url;
  };

  const save = async () => {
    const slug = String(form.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) return setError('Best-For slug is required.');
    if (String(form.title || '').trim().length < 8) return setError('Write a useful page H1/title.');
    setBusy(true); setError('');
    try {
      const payload = { ...form, slug, country_slug: country.slug, content_type: 'country-best-for', content_key: `country-best-for:${country.slug}:${slug}`, blocks, html: blocksToHtml(blocks) };
      const res = await fetch('/api/content-documents', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form.id ? { ...payload, id: form.id } : payload) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save Best-For page');
      notify(form.id ? 'Country Best-For page saved' : 'Country Best-For page created');
      onSaved();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save Best-For page'); } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/60 p-3 backdrop-blur-sm"><div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg"><div className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white"><div className="min-w-0 flex-1"><p className="font-display font-bold">{form.id ? 'Edit' : 'Create'} country Best-For page</p><p className="text-xs text-slate-400">/{country.slug}/{form.slug || 'best-for-slug'} · canonical Content Studio document</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18}/></button></div><div className="flex-1 overflow-y-auto p-5 sm:p-7">{error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>}<div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Slug</span><input value={form.slug || ''} onChange={e=>setForm({...form,slug:e.target.value})} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500" placeholder="forex-brokers-for-beginners"/></label><label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Title (H1)</span><input value={form.title || ''} onChange={e=>setForm({...form,title:e.target.value})} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500" placeholder="Best Forex Brokers for Beginners in Vietnam"/></label></div><label className="mt-4 block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Intro / excerpt</span><textarea value={form.excerpt || ''} onChange={e=>setForm({...form,excerpt:e.target.value})} rows={3} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label><div className="mt-5"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Visual page builder</p><PageBuilder value={blocks} onChange={next=>{setBlocks(next);setForm(f=>({...f,blocks:next,html:blocksToHtml(next)}))}} onUploadImage={uploadImage}/></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">SEO title</span><input value={form.seo_title || ''} onChange={e=>setForm({...form,seo_title:e.target.value})} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500"/></label><label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">SEO description</span><textarea value={form.seo_description || ''} onChange={e=>setForm({...form,seo_description:e.target.value})} rows={2} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label></div><div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-paper p-4"><div><p className="text-sm font-bold text-ink-900">Index this page</p><p className="text-xs text-slate-500">Only index substantial, unique commercial content.</p></div><button type="button" onClick={()=>setForm(f=>({...f,indexable:!f.indexable}))} className={`relative h-6 w-11 rounded-full ${form.indexable?'bg-emerald-500':'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${form.indexable?'left-[22px]':'left-0.5'}`}/></button></div><button onClick={save} disabled={busy} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white disabled:opacity-60">{busy&&<Loader2 size={15} className="animate-spin"/>}{form.id?'Save changes':'Create Best-For page'}</button></div></div></div>;
}

export default function CountryHub({ countries, brokers, contentDocs, token, notify, onNewCountry, onEditCountry }: Props) {
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(() => countries[0]?.slug ?? '');
  const [editingBestFor, setEditingBestFor] = useState<ContentDocument | null | 'new'>(null);
  const [docs, setDocs] = useState<ContentDocument[]>(contentDocs);
  useEffect(() => setDocs(contentDocs), [contentDocs]);

  const filtered = countries.filter((country) => `${country.name} ${country.slug}`.toLowerCase().includes(query.toLowerCase()));
  const selected = countries.find((country) => country.slug === selectedSlug) ?? filtered[0] ?? countries[0];
  const bestFor = useMemo(() => selected ? docs.filter((doc) => doc.content_type === 'country-best-for' && doc.country_slug === selected.slug) : [], [docs, selected]);
  const countryDocs = useMemo(() => selected ? docs.filter((doc) => doc.country_slug === selected.slug && doc.content_type !== 'country-best-for') : [], [docs, selected]);
  const publishedState = String((selected as any)?.publishing_state ?? ((selected as any)?.status ?? 'published'));

  if (!selected) return <div className="rounded-2xl border border-line bg-white p-8 text-sm text-slate-500">No countries found.</div>;

  const reload = async () => {
    const res = await fetch('/api/content-documents?admin=true', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => []);
    if (res.ok && Array.isArray(data)) setDocs(data);
  };

  return <div className="grid gap-5 lg:grid-cols-[300px_1fr]"><section className="rounded-2xl border border-line bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-ink-900">Countries</h2><button onClick={onNewCountry} className="rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-bold text-white"><Plus size={13} className="inline"/> New</button></div><div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-paper px-3"><Search size={14} className="text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search countries…" className="h-10 flex-1 bg-transparent text-sm outline-none"/></div><div className="mt-3 max-h-[560px] space-y-1 overflow-auto">{filtered.map(country=><button key={country.id} onClick={()=>setSelectedSlug(country.slug)} className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${selected.id===country.id?'bg-emerald-50 text-emerald-800':'hover:bg-paper'}`}><span className="font-bold">{country.flag} {country.name}</span><span className="block text-xs text-slate-400">/{country.slug}</span></button>)}</div></section><section className="space-y-5"><div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country Workspace</p><h2 className="font-display text-2xl font-bold text-ink-900">{selected.flag} {selected.name}</h2><p className="mt-1 text-sm text-slate-500">Canonical country guides and Best-For pages are managed as Content Studio documents.</p></div><button onClick={()=>onEditCountry(selected)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white"><Pencil size={14}/> Edit country hub</button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><HubMetric label="Publishing" value={publishedState} sub="draft · published · closed"/><HubMetric label="Best-For" value={String(bestFor.length)} sub="canonical country documents"/><HubMetric label="Country content" value={String(countryDocs.length + bestFor.length)} sub="guides and content docs"/></div></div><div className="grid gap-5 xl:grid-cols-2"><EntityPanel title="SEO QA" items={[selected.seo_title?'SEO title present':'Missing SEO title',selected.seo_description?'Meta description present':'Missing meta description']}/><EntityPanel title="Broker coverage" items={[`${selected.recommended.length} recommended brokers`,`${selected.unavailable.length} unavailable broker flags`,`${brokers.length} brokers in database`,'Use Broker Workspace for searchable eligibility states']}/></div><div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-display text-lg font-bold text-ink-900">Best-For pages</h3><p className="mt-0.5 text-xs text-slate-500">Canonical Content Studio ownership — no legacy country_best_for rows.</p></div><button onClick={()=>setEditingBestFor('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white"><Plus size={13}/> Add new page</button></div><div className="mt-3 divide-y divide-line rounded-xl border border-line">{bestFor.map(doc=><div key={doc.id} className="flex items-center justify-between px-4 py-3"><button onClick={()=>setEditingBestFor(doc)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold text-ink-900">{doc.title || doc.slug || doc.content_key}</span><span className="text-xs text-slate-400">/{selected.slug}/{doc.slug} · {doc.published?'Published':'Draft'} · {doc.indexable?'Indexable':'Noindex'}</span></button><div className="flex shrink-0 items-center gap-1">{doc.slug&&<a href={`/${selected.slug}/${doc.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Preview live page"><Eye size={14}/></a>}<button onClick={()=>setEditingBestFor(doc)} className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Edit page"><Pencil size={14}/></button><button onClick={async()=>{if(!window.confirm('Delete this canonical Best-For document?'))return;const res=await fetch('/api/content-documents',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({id:doc.id})});if(!res.ok){const out=await res.json().catch(()=>({}));notify(out.error||'Could not delete page');return;}notify('Country Best-For page deleted');await reload();}} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete page"><Trash2 size={14}/></button></div></div>)}{!bestFor.length&&<p className="p-4 text-sm text-slate-400">No canonical country Best-For documents yet.</p>}</div></div><CountryGuides country={selected} countries={countries} brokers={brokers} token={token} notify={notify}/></section>{editingBestFor&&<CountryBestForEditor country={selected} document={editingBestFor==='new'?null:editingBestFor} token={token} notify={notify} onClose={()=>setEditingBestFor(null)} onSaved={reload}/>}</div>;
}
