import { useMemo, useState } from 'react';
import { Eye, FileText, Link2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage } from '../lib/types';
import PageBuilder, { blocksToHtml } from './PageBuilder';
import { canonicalContentKeyForDocument, canonicalPathForDocument } from '../lib/canonicalHub/resolver';

type ManagedPage = ContentDocument & { route: string; entityType: 'country'|'broker'|'document' };

type Props = {
  countries: CountryPage[];
  brokers: Broker[];
  contentDocs: ContentDocument[];
  token: string;
  onSave: (fields: Record<string, unknown>, isNew: boolean) => Promise<void>;
  onDelete: (doc: ContentDocument) => void;
};

const MANAGED_TYPES = new Set(['country', 'country-guide', 'global-best-for', 'guide', 'broker', 'compare']);

export default function PageManager({ countries, brokers, contentDocs, token, onSave, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<ContentDocument | null | false>(null);
  const pages = useMemo<ManagedPage[]>(() => {
    const docs = contentDocs
      .filter(d => MANAGED_TYPES.has(d.content_type))
      .map(d => ({
        ...d,
        route: canonicalPathForDocument(d) || '#',
        entityType: (d.content_type === 'broker' ? 'broker' : d.country_slug ? 'country' : 'document') as ManagedPage['entityType'],
      }));
    const keys = new Set(docs.map(d => d.content_key));
    const generated: ManagedPage[] = [];
    countries.forEach(c => {
      const key = `country:${c.slug}:hub`;
      if (!keys.has(key)) {
        generated.push({
          id: -c.id,
          content_key: key,
          content_type: 'country',
          country_slug: c.slug,
          topic_slug: null,
          slug: c.slug,
          title: `${c.name} Forex Brokers`,
          excerpt: '',
          html: '',
          blocks: [],
          seo_title: c.seo_title || '',
          seo_description: c.seo_description || '',
          indexable: true,
          published: true,
          updated_by: null,
          created_at: '',
          updated_at: '',
          settings: {},
          route: canonicalPathForDocument({ content_type: 'country', country_slug: c.slug, topic_slug: null, slug: c.slug }) || `/${c.slug}`,
          entityType: 'country',
        });
      }
    });
    return [...generated, ...docs].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  }, [countries, contentDocs]);

  const filtered = pages.filter(p => {
    if (kind !== 'all' && p.entityType !== kind) return false;
    if (status === 'published' && !p.published) return false;
    if (status === 'draft' && p.published) return false;
    if (status === 'noindex' && p.indexable) return false;
    const q = query.toLowerCase().trim();
    return !q || [p.title, p.content_key, p.route, p.country_slug, p.topic_slug].some(v => String(v || '').toLowerCase().includes(q));
  });

  if (editing !== null) {
    return <PageManagerEditor
      document={editing || null}
      countries={countries}
      brokers={brokers}
      token={token}
      onClose={() => setEditing(null)}
      onSave={async (f, n) => { await onSave(f, n); setEditing(null); }}
    />;
  }

  return <div className="space-y-5">
    <div className="rounded-3xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Unified publishing</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink-950">Page Manager</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">One CMS for canonical content documents: country hubs, country guides, global best-for pages, guides, broker profiles and comparison pages.</p>
        </div>
        <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white">
          <Plus size={14} className="text-emerald-400"/> New page
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, route, country or key…" className="h-11 w-full rounded-xl border border-line bg-paper pl-9 pr-3 text-sm outline-none focus:border-emerald-500"/>
        </div>
        <select value={kind} onChange={e => setKind(e.target.value)} className="h-11 rounded-xl border border-line bg-paper px-3 text-xs font-bold">
          <option value="all">All page types</option><option value="country">Country pages</option><option value="broker">Broker profiles</option><option value="document">Content documents</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-11 rounded-xl border border-line bg-paper px-3 text-xs font-bold">
          <option value="all">All status</option><option value="published">Published</option><option value="draft">Drafts</option><option value="noindex">Noindex</option>
        </select>
      </div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line bg-paper px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{filtered.length} pages</div>
      {filtered.map(p => <div key={`${p.content_key}-${p.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${p.entityType === 'broker' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>{p.entityType}</span><p className="truncate text-sm font-bold text-ink-900">{p.title || p.content_key}</p></div><p className="mt-1 truncate text-[11px] text-slate-400">{p.route}</p></div>
        <div className="hidden sm:flex gap-1.5"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${p.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{p.published ? 'Published' : 'Draft'}</span>{!p.indexable && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Noindex</span>}</div>
        <div className="flex gap-1"><a href={p.route} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper"><Eye size={15}/></a><button onClick={() => setEditing(p.id > 0 ? p : { ...p, id: 0, published: false })} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"><Pencil size={15}/></button>{p.id > 0 && <button onClick={() => onDelete(p)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15}/></button>}</div>
      </div>)}
    </div>
  </div>;
}

function PageManagerEditor({ document, countries, brokers, token, onClose, onSave }: { document: ContentDocument | null; countries: CountryPage[]; brokers: Broker[]; token: string; onClose: () => void; onSave: (f: Record<string, unknown>, n: boolean) => Promise<void> }) {
  const isNew = !document || document.id === 0;
  const [form, setForm] = useState<any>(() => document ? { ...document, settings: document.settings || {} } : { content_key: '', content_type: 'country-guide', country_slug: '', topic_slug: '', slug: '', title: '', excerpt: '', html: '', blocks: [], seo_title: '', seo_description: '', indexable: true, published: false, settings: {} });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(false);
  const settings = form.settings || {};
  const [faqs, setFaqs] = useState<any[]>(settings.faqs || []);
  const [links, setLinks] = useState<any[]>(settings.internalLinks || []);
  const isBroker = form.content_type === 'broker';
  const route = canonicalPathForDocument(form) || '#';
  const input = 'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500';

  const uploadImage = async (file: File) => {
    const reader = new FileReader();
    const data = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const r = await fetch('/api/content-assets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64: data }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Image upload failed');
    return d.url;
  };

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const key = form.content_key || canonicalContentKeyForDocument(form);
      if (!key) throw new Error('Complete the page type and canonical fields before saving.');
      await onSave({ ...form, content_key: key, html: blocksToHtml(form.blocks || []), settings: { ...settings, faqs, internalLinks: links }, ...(isNew ? {} : { id: document!.id }) }, isNew);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[120] bg-ink-950/60 p-2 backdrop-blur-sm"><div className="flex h-full flex-col overflow-hidden rounded-3xl bg-paper shadow-soft-lg">
    <header className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white"><FileText size={20} className="text-emerald-400"/><div className="min-w-0 flex-1"><p className="font-display text-lg font-bold">{isNew ? 'Create page' : 'Edit page'}</p><p className="truncate text-xs text-slate-400">{route} · unified Page Manager</p></div>{route !== '#' && <a href={route} target="_blank" rel="noreferrer" className="hidden rounded-xl border border-white/10 px-3 py-2 text-xs font-bold sm:inline-flex"><Eye size={14} className="mr-1.5"/> Live</a>}<button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18}/></button></header>
    <div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><main className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5"><div className="grid gap-3 sm:grid-cols-2"><label><b className="text-xs">Page type</b><select value={form.content_type} onChange={e => setForm({ ...form, content_type: e.target.value })} className={input}><option value="country-guide">Country guide</option><option value="country">Country hub</option><option value="global-best-for">Global best-for</option><option value="guide">Guide</option><option value="broker">Broker profile</option><option value="compare">Comparison page</option></select></label><label><b className="text-xs">Title</b><input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className={input}/></label>{!isBroker ? <><label><b className="text-xs">Country</b><select value={form.country_slug || ''} onChange={e => setForm({ ...form, country_slug: e.target.value })} className={input}><option value="">Select country</option>{countries.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label><label><b className="text-xs">Slug</b><input value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} className={input}/></label></> : <label><b className="text-xs">Broker</b><select value={form.slug || ''} onChange={e => { const b = brokers.find(x => x.slug === e.target.value); setForm({ ...form, slug: e.target.value, title: form.title || `${b?.name || ''} Review` }); }} className={input}><option value="">Select broker</option>{brokers.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></label>}<label className="sm:col-span-2"><b className="text-xs">Introduction</b><textarea value={form.excerpt || ''} onChange={e => setForm({ ...form, excerpt: e.target.value })} rows={3} className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"/></label></div></section>
      <section className="rounded-2xl border border-line bg-white p-5"><div className="flex items-center justify-between"><div><b className="font-display">Page content</b><p className="text-xs text-slate-400">Reorder sections, add rich text, images, tables, callouts and links.</p></div><button onClick={() => setPreview(v => !v)} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">{preview ? 'Edit' : 'Preview'}</button></div>{preview ? <div className="piprank-rich-content mt-5 rounded-2xl border border-line bg-paper p-5" dangerouslySetInnerHTML={{ __html: blocksToHtml(form.blocks || []) }}/> : <div className="mt-3"><PageBuilder value={form.blocks || []} onChange={blocks => setForm({ ...form, blocks, html: blocksToHtml(blocks) })} onUploadImage={uploadImage}/></div>}</section>
    </main><aside className="space-y-4"><section className="rounded-2xl border border-line bg-white p-4"><b className="font-display">Publishing</b><div className="mt-3 space-y-2"><Toggle label="Published" value={!!form.published} setValue={v => setForm({ ...form, published: v })}/><Toggle label="Indexable" value={!!form.indexable} setValue={v => setForm({ ...form, indexable: v })}/></div></section><section className="rounded-2xl border border-line bg-white p-4"><b className="font-display">SEO</b><input value={form.seo_title || ''} onChange={e => setForm({ ...form, seo_title: e.target.value })} className={`${input} mt-3`} placeholder="SEO title"/><textarea value={form.seo_description || ''} onChange={e => setForm({ ...form, seo_description: e.target.value })} rows={4} className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs" placeholder="Meta description"/></section><section className="rounded-2xl border border-line bg-white p-4"><b className="font-display">FAQs</b>{faqs.map((f, i) => <div key={i} className="mt-2 rounded-xl border border-line bg-paper p-3"><input value={f.q || ''} onChange={e => setFaqs(x => x.map((y, j) => j === i ? { ...y, q: e.target.value } : y))} className={input} placeholder="Question"/><textarea value={f.a || ''} onChange={e => setFaqs(x => x.map((y, j) => j === i ? { ...y, a: e.target.value } : y))} rows={3} className="mt-2 w-full rounded-xl border border-line bg-white px-2 py-2 text-xs" placeholder="Answer"/><button onClick={() => setFaqs(x => x.filter((_, j) => j !== i))} className="mt-1 text-[11px] font-bold text-rose-600">Remove</button></div>)}<button onClick={() => setFaqs(x => [...x, { q: '', a: '' }])} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold"><Plus size={12}/> Add FAQ</button></section><section className="rounded-2xl border border-line bg-white p-4"><b className="font-display">Internal links</b>{links.map((l, i) => <div key={i} className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-1"><input value={l.label || ''} onChange={e => setLinks(x => x.map((y, j) => j === i ? { ...y, label: e.target.value } : y))} className="rounded-lg border border-line px-2 py-2 text-xs" placeholder="Label"/><input value={l.href || ''} onChange={e => setLinks(x => x.map((y, j) => j === i ? { ...y, href: e.target.value } : y))} className="rounded-lg border border-line px-2 py-2 text-xs" placeholder="/country/guides/topic"/><button onClick={() => setLinks(x => x.filter((_, j) => j !== i))}><Trash2 size={14}/></button></div>)}<button onClick={() => setLinks(x => [...x, { label: 'Related page', href: '/' }])} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold"><Link2 size={12}/> Add link</button></section><button onClick={save} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white disabled:opacity-60"><Save size={15}/>{busy ? 'Saving…' : form.published ? 'Save & publish' : 'Save draft'}</button>{err && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{err}</p>}</aside></div></div>
  </div></div>;
}

function Toggle({ label, value, setValue }: { label: string; value: boolean; setValue: (v: boolean) => void }) {
  return <button type="button" onClick={() => setValue(!value)} className="flex w-full items-center justify-between rounded-xl bg-paper px-3 py-2.5 text-xs font-bold"><span>{label}</span><span className={`h-5 w-9 rounded-full p-0.5 ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`block h-4 w-4 rounded-full bg-white ${value ? 'translate-x-4' : ''}`}/></span></button>;
}
