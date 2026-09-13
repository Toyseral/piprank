import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Search, X, Loader2 } from 'lucide-react';
import type { Broker, ContentDocument, CountryBestFor, CountryPage } from '../../../lib/types';
import CountryGuides from '../CountryGuides';
import PageBuilder, { blocksToHtml, type PageBlock } from '../../../components/PageBuilder';

function HubMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink-900">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}

function EntityPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-xs font-medium text-slate-600">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function emptyDocument(country: CountryPage): ContentDocument {
  const slug = `draft-${Date.now()}`;
  return {
    id: 0,
    content_key: `country-best-for:${country.slug}:${slug}`,
    content_type: 'country-best-for',
    country_slug: country.slug,
    topic_slug: null,
    slug,
    title: `New ${country.name} Best-For page`,
    excerpt: '',
    html: '',
    blocks: [],
    seo_title: null,
    seo_description: null,
    indexable: false,
    published: false,
    updated_by: null,
    created_at: '',
    updated_at: '',
    settings: {},
  };
}

function CountryBestForEditor({
  document,
  country,
  token,
  onClose,
  onSaved,
}: {
  document: ContentDocument;
  country: CountryPage;
  token: string;
  onClose: () => void;
  onSaved: (doc: ContentDocument) => void;
}) {
  const [form, setForm] = useState<ContentDocument>({ ...document, blocks: Array.isArray(document.blocks) ? document.blocks : [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const uploadImage = async (file: File) => {
    const reader = new FileReader();
    const data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch('/api/content-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64: data }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Image upload failed');
    return out.url;
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const slug = String(form.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!slug) throw new Error('A page slug is required.');
      if (!form.title.trim()) throw new Error('A page title is required.');
      const payload = {
        ...form,
        content_type: 'country-best-for',
        country_slug: country.slug,
        slug,
        content_key: `country-best-for:${country.slug}:${slug}`,
        html: blocksToHtml((form.blocks ?? []) as PageBlock[]),
      };
      const res = await fetch('/api/content-documents', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form.id ? { ...payload, id: form.id } : payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save country Best-For page.');
      onSaved(out as ContentDocument);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save country Best-For page.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg">
        <div className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white">
          <div className="min-w-0 flex-1"><p className="font-display font-bold">{form.id ? 'Edit' : 'Create'} {country.name} Best-For page</p><p className="text-xs text-slate-400">Canonical content document · /{country.slug}/{form.slug}</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {error && <p className="mb-5 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Page title / H1</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500"/></label>
            <label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Canonical slug</span><input value={form.slug || ''} onChange={e=>setForm({...form,slug:e.target.value})} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500"/></label>
          </div>
          <label className="mt-4 block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Intro / excerpt</span><textarea value={form.excerpt || ''} onChange={e=>setForm({...form,excerpt:e.target.value})} rows={3} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label>
          <div className="mt-5"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Visual page builder</span><PageBuilder value={(Array.isArray(form.blocks) ? form.blocks : []) as PageBlock[]} onChange={blocks=>setForm({...form,blocks,html:blocksToHtml(blocks)})} onUploadImage={uploadImage}/></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">SEO title</span><input value={form.seo_title || ''} onChange={e=>setForm({...form,seo_title:e.target.value})} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500"/></label>
            <label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">SEO description</span><textarea value={form.seo_description || ''} onChange={e=>setForm({...form,seo_description:e.target.value})} rows={2} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span><span className="block text-sm font-bold">Publish</span><span className="text-xs text-slate-400">Make the canonical page live.</span></span><button type="button" onClick={()=>setForm({...form,published:!form.published})} className={`relative h-6 w-11 rounded-full ${form.published?'bg-emerald-500':'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${form.published?'left-[22px]':'left-0.5'}`}/></button></label>
            <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span><span className="block text-sm font-bold">Index</span><span className="text-xs text-slate-400">Allow search indexing.</span></span><button type="button" onClick={()=>setForm({...form,indexable:!form.indexable})} className={`relative h-6 w-11 rounded-full ${form.indexable?'bg-emerald-500':'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${form.indexable?'left-[22px]':'left-0.5'}`}/></button></label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-white px-5 py-4"><button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-slate-600">Cancel</button><button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{busy&&<Loader2 size={14} className="animate-spin"/>}{form.id?'Save changes':'Create page'}</button></div>
      </div>
    </div>
  );
}

function CountryHub({
  countries,
  brokers,
  countryBestFors: _countryBestFors,
  contentDocs,
  token,
  notify,
  onNewCountry,
  onEditCountry,
  onEditCountryBestFor: _onEditCountryBestFor,
  onNewCountryBestFor: _onNewCountryBestFor,
  onNewContentDoc: _onNewContentDoc,
  onEditContentDoc: _onEditContentDoc,
}: {
  countries: CountryPage[];
  brokers: Broker[];
  countryBestFors?: CountryBestFor[];
  contentDocs: ContentDocument[];
  token: string;
  notify: (msg: string) => void;
  onNewCountry: () => void;
  onEditCountry: (country: CountryPage) => void;
  onEditCountryBestFor?: (page: CountryBestFor) => void;
  onNewCountryBestFor?: (countrySlug: string) => void;
  onNewContentDoc?: (doc?: ContentDocument) => void;
  onEditContentDoc?: (doc: ContentDocument) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(() => countries[0]?.slug ?? '');
  const [editingBestFor, setEditingBestFor] = useState<ContentDocument | null>(null);
  useEffect(() => { if (!selectedSlug && countries[0]) setSelectedSlug(countries[0].slug); }, [countries, selectedSlug]);
  const filtered = countries.filter((country) => `${country.name} ${country.slug}`.toLowerCase().includes(query.toLowerCase()));
  const selected = countries.find((country) => country.slug === selectedSlug) ?? filtered[0] ?? countries[0];
  const guides = selected ? contentDocs.filter((doc) => doc.content_type === 'country-guide' && doc.country_slug === selected.slug) : [];
  const bestForPages = useMemo(() => selected ? contentDocs.filter((doc) => doc.content_type === 'country-best-for' && doc.country_slug === selected.slug) : [], [contentDocs, selected]);
  const publishedState = String((selected as any)?.publishing_state ?? ((selected as any)?.status ?? 'published'));

  const createBestFor = () => {
    if (!selected) return;
    setEditingBestFor(emptyDocument(selected));
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-ink-900">Countries</h2><button onClick={onNewCountry} className="rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-bold text-white"><Plus size={13} className="inline"/> New</button></div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-paper px-3"><Search size={14} className="text-slate-400"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search countries…" className="h-10 flex-1 bg-transparent text-sm outline-none"/></div>
          <div className="mt-3 max-h-[560px] space-y-1 overflow-auto">{filtered.map((country)=><button key={country.id} onClick={()=>setSelectedSlug(country.slug)} className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${selected?.id===country.id?'bg-emerald-50 text-emerald-800':'hover:bg-paper'}`}><span className="font-bold">{country.flag} {country.name}</span><span className="block text-xs text-slate-400">/{country.slug}</span></button>)}</div>
        </section>

        {selected&&<section className="space-y-5">
          <div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country Workspace</p><h2 className="font-display text-2xl font-bold text-ink-900">{selected.flag} {selected.name}</h2><p className="mt-1 text-sm text-slate-500">Manage the country hub, canonical guides and country-specific Best-For pages.</p></div><button onClick={()=>onEditCountry(selected)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white"><Pencil size={14}/> Edit country hub</button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><HubMetric label="Publishing" value={publishedState} sub="draft · published · closed"/><HubMetric label="Guides" value={String(guides.length)} sub="canonical country guides"/><HubMetric label="Best-For" value={String(bestForPages.length)} sub="canonical country pages"/></div></div>
          <div className="grid gap-5 xl:grid-cols-2"><EntityPanel title="SEO QA" items={[selected.seo_title?'SEO title present':'Missing SEO title',selected.seo_description?'Meta description present':'Missing meta description',(selected.seo_intro?.length||0)>0?'Intro present':'Missing SEO intro',(selected.seo_sections?.length||0)>0?'Structured sections present':'Missing sections',(selected.seo_faqs?.length||0)>0?'FAQs present':'Missing FAQs']}/><EntityPanel title="Broker coverage" items={[`${selected.recommended.length} recommended brokers`,`${selected.unavailable.length} unavailable broker flags`,`${brokers.length} brokers in database`,'Use Broker Workspace for searchable eligibility states']}/></div>
          <div className="rounded-2xl border border-line bg-white shadow-soft"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><p className="font-display text-base font-bold text-ink-900">Country Best-For ({bestForPages.length})</p><p className="mt-0.5 text-xs text-slate-400">Canonical pages owned by content_documents; intents remain ranking/config data.</p></div><button onClick={createBestFor} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white"><Plus size={13}/> New page</button></div><div className="divide-y divide-line">
            {bestForPages.map((page) => <div key={page.id} className="flex items-center gap-3 px-5 py-3.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{page.title || page.content_key}</p><p className="truncate text-xs text-slate-400">/{selected.slug}/{page.slug || page.content_key.replace(`country-best-for:${selected.slug}:`, '')}{page.published ? ' · Published' : ' · Draft'}</p></div>{page.slug && <a href={`/${selected.slug}/${page.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Preview live page"><Eye size={14}/></a>}<button onClick={()=>setEditingBestFor(page)} className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Edit canonical page"><Pencil size={14}/></button></div>)}
            {!bestForPages.length && <p className="p-5 text-sm text-slate-400">No canonical country Best-For documents yet.</p>}
          </div></div>
          <CountryGuides country={selected} countries={countries} brokers={brokers} token={token} notify={notify}/>
        </section>}
      </div>
      {editingBestFor && selected && <CountryBestForEditor document={editingBestFor} country={selected} token={token} onClose={()=>setEditingBestFor(null)} onSaved={()=>notify('Country Best-For page saved')}/>} 
    </>
  );
}

export default CountryHub;
