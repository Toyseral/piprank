import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, FileText, Globe2, Languages, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import type { ContentDocument, CountryBestFor, CountryLanguage, CountryPage, Guide, Intent, LocalizedSeoPage } from '../lib/types';
import PageBuilder, { blocksToHtml, type PageBlock } from '../components/PageBuilder';

const inputClass = 'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500';
const areaClass = 'w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm outline-none focus:border-emerald-500';

type Props = { session: Session; role: string; onBack: () => void };
type Scope = 'country' | 'global';
type CountryTab = 'guides' | 'best-for' | 'languages';
type GlobalTab = 'best-for' | 'guides';

async function api(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function AdminContentHub({ session, role, onBack }: Props) {
  const [scope, setScope] = useState<Scope>('country');
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryPage | null>(null);
  const [countryTab, setCountryTab] = useState<CountryTab>('guides');
  const [globalTab, setGlobalTab] = useState<GlobalTab>('best-for');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const loadCountries = async () => {
    try {
      const rows = await api('/api/countries-public?admin=1', session.access_token);
      setCountries(Array.isArray(rows) ? rows : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load countries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCountries(); }, [session.access_token]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  };

  if (loading) return <div className="min-h-screen bg-paper p-8 text-sm text-slate-500">Loading content hub…</div>;

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-slate-500 hover:bg-paper">
            <ArrowLeft size={15} /> Admin Hub
          </button>
          <span className="h-5 w-px bg-line" />
          <p className="font-display font-bold">Content Hub</p>
          <nav className="ml-auto flex gap-1">
            <button onClick={() => setScope('country')} className={`rounded-lg px-3 py-2 text-xs font-bold ${scope === 'country' ? 'bg-ink-950 text-white' : 'text-slate-500 hover:bg-paper'}`}>Country Hub</button>
            <button onClick={() => setScope('global')} className={`rounded-lg px-3 py-2 text-xs font-bold ${scope === 'global' ? 'bg-ink-950 text-white' : 'text-slate-500 hover:bg-paper'}`}>Global Hub</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {scope === 'country' && !selectedCountry && (
          <CountryPicker countries={countries} onPick={setSelectedCountry} />
        )}
        {scope === 'country' && selectedCountry && (
          <CountryWorkspace
            country={selectedCountry}
            token={session.access_token}
            role={role}
            tab={countryTab}
            setTab={setCountryTab}
            onBack={() => setSelectedCountry(null)}
            notify={notify}
          />
        )}
        {scope === 'global' && (
          <GlobalWorkspace token={session.access_token} role={role} tab={globalTab} setTab={setGlobalTab} notify={notify} />
        )}
      </main>
      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-emerald-300">✓ {toast}</div>}
    </div>
  );
}

function CountryPicker({ countries, onPick }: { countries: CountryPage[]; onPick: (country: CountryPage) => void }) {
  const [q, setQ] = useState('');
  const filtered = countries.filter(c => `${c.name} ${c.slug}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country Hub</p>
      <h1 className="mt-1 font-display text-3xl font-bold">Country content</h1>
      <p className="mt-1 text-sm text-slate-500">Select a country to open its existing Country Workspace.</p>
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-white px-3">
        <Search size={16} className="text-slate-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search countries…" className="h-11 flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
        {filtered.map(c => (
          <button key={c.id} onClick={() => onPick(c)} className="flex w-full items-center gap-4 border-b border-line p-4 text-left last:border-0 hover:bg-paper">
            <span className="text-3xl">{c.flag}</span>
            <div className="flex-1"><b>{c.name}</b><p className="text-xs text-slate-500">/{c.slug} · {(c.status || 'published').toUpperCase()}</p></div>
            <span className="text-xs font-bold text-emerald-700">Open workspace →</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CountryWorkspace({ country, token, role, tab, setTab, onBack, notify }: { country: CountryPage; token: string; role: string; tab: CountryTab; setTab: (v: CountryTab) => void; onBack: () => void; notify: (v: string) => void }) {
  return (
    <>
      <button onClick={onBack} className="text-xs font-bold text-emerald-700">← All Countries</button>
      <div className="mt-3 rounded-2xl bg-ink-950 p-6 text-white">
        <p className="text-xs text-emerald-300">Country Workspace</p>
        <h1 className="font-display text-3xl font-bold">{country.flag} {country.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Country Guides & SEO Content · Country Best-For · Languages</p>
      </div>
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-line pb-2">
        {([['guides', 'Country Guides & SEO Content'], ['best-for', 'Country Best-For'], ['languages', 'Languages']] as [CountryTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${tab === id ? 'bg-ink-950 text-white' : 'text-slate-500 hover:bg-white'}`}>{label}</button>
        ))}
      </div>
      <div className="mt-5">
        {tab === 'guides' && <CountryGuides country={country} token={token} role={role} notify={notify} />}
        {tab === 'best-for' && <CountryBestForManager country={country} token={token} role={role} notify={notify} />}
        {tab === 'languages' && <CountryLanguages country={country} token={token} role={role} notify={notify} />}
      </div>
    </>
  );
}

function CountryGuides({ country, token, role, notify }: { country: CountryPage; token: string; role: string; notify: (v: string) => void }) {
  const [docs, setDocs] = useState<ContentDocument[]>([]);
  const [editing, setEditing] = useState<ContentDocument | null>(null);
  const [newPage, setNewPage] = useState(false);
  const load = async () => setDocs(await api(`/api/content-documents?country=${encodeURIComponent(country.slug)}`, token));
  useEffect(() => { void load(); }, [country.slug]);
  const pages = docs.filter(d => d.content_type === 'country-guide' || d.content_type === 'country-seo' || d.content_type === 'page');
  if (editing || newPage) return <ContentDocumentEditor country={country} token={token} document={editing} defaultType="country-guide" onClose={() => { setEditing(null); setNewPage(false); }} onSaved={() => { setEditing(null); setNewPage(false); void load(); notify('Country page saved'); }} />;
  return <DocumentList title="Country Guides & SEO Content" description="Add new pages, edit existing pages, and open every page in the visual editor." pages={pages} onNew={() => setNewPage(true)} onEdit={setEditing} onDelete={async d => { if (!window.confirm(`Delete ${d.title || d.content_key}?`)) return; await api('/api/content-documents', token, { method: 'DELETE', body: JSON.stringify({ id: d.id }) }); void load(); notify('Page deleted'); }} />;
}

function CountryBestForManager({ country, token, role, notify }: { country: CountryPage; token: string; role: string; notify: (v: string) => void }) {
  const [rows, setRows] = useState<CountryBestFor[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [editing, setEditing] = useState<CountryBestFor | null>(null);
  const [newPage, setNewPage] = useState(false);
  const load = async () => { const [b, i] = await Promise.all([api(`/api/country-best-for?country=${encodeURIComponent(country.slug)}`, token), api('/api/intents', token)]); setRows(Array.isArray(b) ? b : []); setIntents(Array.isArray(i) ? i : []); };
  useEffect(() => { void load(); }, [country.slug]);
  if (editing || newPage) return <BestForEditor country={country} token={token} page={editing} intents={intents} onClose={() => { setEditing(null); setNewPage(false); }} onSaved={() => { setEditing(null); setNewPage(false); void load(); notify('Country Best-For page saved'); }} />;
  return (
    <div className="space-y-5">
      <SectionHeader title="Country Best-For" description="Create and edit country-specific Best-For pages with the same visual page builder." action="Add new page" onAction={() => setNewPage(true)} />
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {rows.map(row => <div key={row.id} className="flex items-center gap-3 border-b border-line p-4 last:border-0"><div className="flex-1"><p className="font-bold">{row.title}</p><p className="text-xs text-slate-400">/{country.slug}/best/{row.slug} · {row.indexable ? 'Indexable' : 'Noindex'}</p></div><button onClick={() => setEditing(row)} className="rounded-lg p-2 text-slate-400 hover:bg-paper"><Pencil size={15} /></button></div>)}
        {!rows.length && <Empty text="No country Best-For pages yet." />}
      </div>
    </div>
  );
}

function GlobalWorkspace({ token, role, tab, setTab, notify }: { token: string; role: string; tab: GlobalTab; setTab: (v: GlobalTab) => void; notify: (v: string) => void }) {
  return <div>
    <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Global Hub</p>
    <h1 className="mt-1 font-display text-3xl font-bold">Global content</h1>
    <p className="mt-1 text-sm text-slate-500">The same page architecture and visual editor, without a country scope.</p>
    <div className="mt-5 flex gap-1 border-b border-line pb-2">
      {([['best-for', 'Global Best-For'], ['guides', 'Global Guides / SEO']] as [GlobalTab, string][]).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === id ? 'bg-ink-950 text-white' : 'text-slate-500 hover:bg-white'}`}>{label}</button>)}
    </div>
    <div className="mt-5">{tab === 'best-for' ? <GlobalBestFor token={token} notify={notify} /> : <GlobalGuides token={token} notify={notify} />}</div>
  </div>;
}

function GlobalBestFor({ token, notify }: { token: string; notify: (v: string) => void }) {
  const [rows, setRows] = useState<Intent[]>([]); const [editing, setEditing] = useState<Intent | null>(null); const [newPage, setNewPage] = useState(false);
  const load = async () => setRows(await api('/api/intents', token)); useEffect(() => { void load(); }, []);
  if (editing || newPage) return <GlobalBestForEditor token={token} page={editing} onClose={() => { setEditing(null); setNewPage(false); }} onSaved={() => { setEditing(null); setNewPage(false); void load(); notify('Global Best-For page saved'); }} />;
  return <div className="space-y-5"><SectionHeader title="Global Best-For" description="Global intent pages use the same editor and content document architecture." action="Add new page" onAction={() => setNewPage(true)} /><div className="overflow-hidden rounded-2xl border border-line bg-white">{rows.map(r => <div key={r.id} className="flex items-center gap-3 border-b border-line p-4 last:border-0"><div className="flex-1"><b>{r.title}</b><p className="text-xs text-slate-400">/best/{r.slug}</p></div><button onClick={() => setEditing(r)} className="rounded-lg p-2 text-slate-400 hover:bg-paper"><Pencil size={15} /></button></div>)}</div></div>;
}

function GlobalGuides({ token, notify }: { token: string; notify: (v: string) => void }) {
  const [docs, setDocs] = useState<ContentDocument[]>([]); const [editing, setEditing] = useState<ContentDocument | null>(null); const [newPage, setNewPage] = useState(false);
  const load = async () => setDocs(await api('/api/content-documents?type=global', token)); useEffect(() => { void load(); }, []);
  if (editing || newPage) return <ContentDocumentEditor token={token} document={editing} defaultType="global-guide" onClose={() => { setEditing(null); setNewPage(false); }} onSaved={() => { setEditing(null); setNewPage(false); void load(); notify('Global page saved'); }} />;
  return <DocumentList title="Global Guides / SEO" description="Manage global guides and SEO pages with the same visual editor." pages={docs} onNew={() => setNewPage(true)} onEdit={setEditing} onDelete={async d => { if (!window.confirm(`Delete ${d.title}?`)) return; await api('/api/content-documents', token, { method: 'DELETE', body: JSON.stringify({ id: d.id }) }); void load(); notify('Global page deleted'); }} />;
}

function DocumentList({ title, description, pages, onNew, onEdit, onDelete }: { title: string; description: string; pages: ContentDocument[]; onNew: () => void; onEdit: (d: ContentDocument) => void; onDelete: (d: ContentDocument) => void }) {
  return <div className="space-y-5"><SectionHeader title={title} description={description} action="Add new page" onAction={onNew} /><div className="overflow-hidden rounded-2xl border border-line bg-white">{pages.map(d => <div key={d.id} className="flex items-center gap-3 border-b border-line p-4 last:border-0"><div className="flex-1"><div className="flex items-center gap-2"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700">{d.content_type}</span><b>{d.title || d.content_key}</b></div><p className="mt-1 text-xs text-slate-400">/{d.slug || d.content_key} · {d.published ? 'Published' : 'Draft'} · {d.indexable ? 'Indexable' : 'Noindex'}</p></div><button onClick={() => onEdit(d)} className="rounded-lg p-2 text-slate-400 hover:bg-paper"><Pencil size={15} /></button><button onClick={() => onDelete(d)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button></div>)}{!pages.length && <Empty text="No pages yet." />}</div></div>;
}

function ContentDocumentEditor({ country, token, document, defaultType, onClose, onSaved }: { country?: CountryPage; token: string; document: ContentDocument | null; defaultType: string; onClose: () => void; onSaved: () => void }) {
  const initial = document || { content_key: '', content_type: defaultType, country_slug: country?.slug || null, topic_slug: '', slug: '', title: '', excerpt: '', html: '', blocks: [], seo_title: '', seo_description: '', indexable: false, published: false } as ContentDocument;
  const [form, setForm] = useState<any>(initial); const [blocks, setBlocks] = useState<PageBlock[]>(Array.isArray(initial.blocks) ? initial.blocks as PageBlock[] : []); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const uploadImage = async (file: File) => { const reader = new FileReader(); const data = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }); const out = await api('/api/content-assets', token, { method: 'POST', body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64: data }) }); return out.url as string; };
  const save = async () => { try { setBusy(true); setError(''); const payload = { ...form, country_slug: country?.slug || form.country_slug || null, content_type: form.content_type || defaultType, blocks, html: blocksToHtml(blocks), content_key: form.content_key || `${form.content_type}:${country?.slug || 'global'}:${form.slug || Date.now()}` }; await api('/api/content-documents', token, { method: document ? 'PUT' : 'POST', body: JSON.stringify(document ? { ...payload, id: document.id } : payload) }); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save page'); } finally { setBusy(false); } };
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-950/70 p-3 backdrop-blur-sm"><div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg"><div className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white"><FileText size={20} className="text-emerald-400"/><div className="flex-1"><p className="font-display font-bold">{document ? 'Edit page' : 'Add new page'}</p><p className="text-xs text-slate-400">{country ? `${country.name} · ` : 'Global · '}Visual content editor</p></div><button onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10">Close</button></div><div className="flex-1 overflow-y-auto p-5 sm:p-7">{error && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</div>}<div className="grid gap-4 md:grid-cols-2"><label><span className="text-[10px] font-bold uppercase text-slate-400">Page title</span><input className={`${inputClass} mt-1`} value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label><span className="text-[10px] font-bold uppercase text-slate-400">Slug</span><input className={`${inputClass} mt-1`} value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} /></label><label><span className="text-[10px] font-bold uppercase text-slate-400">Content type</span><select className={`${inputClass} mt-1`} value={form.content_type || defaultType} onChange={e => setForm({ ...form, content_type: e.target.value })}><option value="country-guide">Country Guide</option><option value="country-seo">Country SEO</option><option value="global-guide">Global Guide</option><option value="global-seo">Global SEO</option></select></label><label><span className="text-[10px] font-bold uppercase text-slate-400">Excerpt</span><input className={`${inputClass} mt-1`} value={form.excerpt || ''} onChange={e => setForm({ ...form, excerpt: e.target.value })} /></label></div><div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Visual editor</p><p className="mb-2 text-xs text-slate-500">Add, remove and reorder sections using the existing PageBuilder.</p><PageBuilder value={blocks} onChange={next => setBlocks(next)} onUploadImage={uploadImage} /></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label><span className="text-[10px] font-bold uppercase text-slate-400">SEO title</span><input className={`${inputClass} mt-1`} value={form.seo_title || ''} onChange={e => setForm({ ...form, seo_title: e.target.value })} /></label><label><span className="text-[10px] font-bold uppercase text-slate-400">Meta description</span><textarea className={`${areaClass} mt-1`} rows={2} value={form.seo_description || ''} onChange={e => setForm({ ...form, seo_description: e.target.value })} /></label></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Toggle label="Published" value={!!form.published} onChange={v => setForm({ ...form, published: v })} /><Toggle label="Indexable" value={!!form.indexable} onChange={v => setForm({ ...form, indexable: v })} /></div></div><div className="flex justify-end gap-2 border-t border-line bg-white px-5 py-4"><button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold">Cancel</button><button disabled={busy} onClick={save} className="rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : document ? 'Save changes' : 'Create page'}</button></div></div></div>;
}

function BestForEditor({ country, token, page, intents, onClose, onSaved }: { country: CountryPage; token: string; page: CountryBestFor | null; intents: Intent[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>(page || { country_id: country.id, intent_id: intents[0]?.id ?? null, slug: '', label: '', title: '', meta_title: '', meta_description: '', intro: [], icon: 'beginners', criteria: [], sections: [], faqs: [], indexable: false, sort_order: 0 });
  const [blocks, setBlocks] = useState<PageBlock[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!page) return; void api(`/api/content-documents?key=${encodeURIComponent(`country-best-for:${country.slug}:${page.slug}`)}`, token).then(d => setBlocks(Array.isArray(d?.blocks) ? d.blocks : [])); }, [page?.id]);
  const save = async () => { try { setBusy(true); setError(''); const contentKey = `country-best-for:${country.slug}:${form.slug}`; const saved = await api('/api/country-best-for', token, { method: page ? 'PUT' : 'POST', body: JSON.stringify({ ...form, id: page?.id }) }); const payload = { content_key: contentKey, content_type: 'country-best-for', country_slug: country.slug, topic_slug: saved.slug, slug: saved.slug, title: saved.title, excerpt: saved.meta_description || '', html: blocksToHtml(blocks), blocks, seo_title: saved.meta_title, seo_description: saved.meta_description, published: false, indexable: false }; const existing = await api(`/api/content-documents?key=${encodeURIComponent(contentKey)}`, token); if (existing) await api('/api/content-documents', token, { method: 'PUT', body: JSON.stringify({ ...payload, id: existing.id }) }); else await api('/api/content-documents', token, { method: 'POST', body: JSON.stringify(payload) }); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save Best-For page'); } finally { setBusy(false); } };
  return <EditorShell title={page ? 'Edit Country Best-For page' : 'Add Country Best-For page'} subtitle={`${country.name} · visual editor`} onClose={onClose} busy={busy} error={error} onSave={save}><div className="grid gap-4 md:grid-cols-2"><label>Label<input className={`${inputClass} mt-1`} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></label><label>Slug<input className={`${inputClass} mt-1`} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></label><label>Title<input className={`${inputClass} mt-1`} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Intent<select className={`${inputClass} mt-1`} value={form.intent_id ?? ''} onChange={e => setForm({ ...form, intent_id: e.target.value ? Number(e.target.value) : null })}><option value="">Custom</option>{intents.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}</select></label><label>Meta title<input className={`${inputClass} mt-1`} value={form.meta_title || ''} onChange={e => setForm({ ...form, meta_title: e.target.value })} /></label><label>Meta description<textarea className={`${areaClass} mt-1`} rows={2} value={form.meta_description || ''} onChange={e => setForm({ ...form, meta_description: e.target.value })} /></label></div><div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Visual editor</p><PageBuilder value={blocks} onChange={setBlocks} /></div></EditorShell>;
}

function GlobalBestForEditor({ token, page, onClose, onSaved }: { token: string; page: Intent | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>(page || { label: '', slug: '', title: '', meta_title: '', meta_description: '', intro: [], criteria: [], sections: [], faqs: [], indexable: false, sort_order: 0 });
  const [blocks, setBlocks] = useState<PageBlock[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!page) return; void api(`/api/content-documents?key=${encodeURIComponent(`global-best-for:${page.slug}`)}`, token).then(d => setBlocks(Array.isArray(d?.blocks) ? d.blocks : [])); }, [page?.id]);
  const save = async () => { try { setBusy(true); setError(''); const saved = await api('/api/intents', token, { method: page ? 'PUT' : 'POST', body: JSON.stringify({ ...form, id: page?.id }) }); const key = `global-best-for:${saved.slug}`; const existing = await api(`/api/content-documents?key=${encodeURIComponent(key)}`, token); const payload = { content_key: key, content_type: 'global-best-for', country_slug: null, topic_slug: saved.slug, slug: saved.slug, title: saved.title, excerpt: saved.meta_description || '', html: blocksToHtml(blocks), blocks, seo_title: saved.meta_title, seo_description: saved.meta_description, published: false, indexable: false }; if (existing) await api('/api/content-documents', token, { method: 'PUT', body: JSON.stringify({ ...payload, id: existing.id }) }); else await api('/api/content-documents', token, { method: 'POST', body: JSON.stringify(payload) }); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save global Best-For page'); } finally { setBusy(false); } };
  return <EditorShell title={page ? 'Edit Global Best-For page' : 'Add Global Best-For page'} subtitle="Global Hub · visual editor" onClose={onClose} busy={busy} error={error} onSave={save}><div className="grid gap-4 md:grid-cols-2"><label>Label<input className={`${inputClass} mt-1`} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></label><label>Slug<input className={`${inputClass} mt-1`} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></label><label>Title<input className={`${inputClass} mt-1`} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Meta title<input className={`${inputClass} mt-1`} value={form.meta_title || ''} onChange={e => setForm({ ...form, meta_title: e.target.value })} /></label><label className="md:col-span-2">Meta description<textarea className={`${areaClass} mt-1`} rows={2} value={form.meta_description || ''} onChange={e => setForm({ ...form, meta_description: e.target.value })} /></label></div><div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Visual editor</p><PageBuilder value={blocks} onChange={setBlocks} /></div></EditorShell>;
}

function CountryLanguages({ country, token, role, notify }: { country: CountryPage; token: string; role: string; notify: (v: string) => void }) {
  const [languages, setLanguages] = useState<CountryLanguage[]>([]); const [pages, setPages] = useState<LocalizedSeoPage[]>([]); const [form, setForm] = useState({ name: '', native_name: '', code: '', locale: '', url_prefix: '' }); const [selected, setSelected] = useState<number | null>(null); const [editing, setEditing] = useState<LocalizedSeoPage | null>(null);
  const load = async () => { const [l, p] = await Promise.all([api(`/api/country-languages?admin=true&country=${encodeURIComponent(country.slug)}`, token), api(`/api/localized-seo-pages?admin=true&country=${encodeURIComponent(country.slug)}`, token)]); setLanguages(Array.isArray(l) ? l : []); setPages(Array.isArray(p) ? p : []); };
  useEffect(() => { void load(); }, [country.slug]);
  const add = async () => { await api('/api/country-languages', token, { method: 'POST', body: JSON.stringify({ country_id: country.id, ...form, url_prefix: form.url_prefix || form.code }) }); setForm({ name: '', native_name: '', code: '', locale: '', url_prefix: '' }); void load(); notify('Language added and localized topic pages seeded'); };
  const toggle = async (l: CountryLanguage) => { await api('/api/country-languages', token, { method: 'PUT', body: JSON.stringify({ id: l.id, active: !l.active }) }); void load(); notify(l.active ? 'Language disabled' : 'Language enabled'); };
  if (editing) return <LocalizedEditor page={editing} token={token} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); notify('Localized page saved'); }} />;
  return <div className="space-y-6">
    <SectionHeader title="Languages" description={`Add and manage languages for ${country.name}. Adding a language automatically uses the existing localization API and seeds localized topic pages.`} action="" onAction={() => {}} />
    <div className="rounded-2xl border border-line bg-white p-5"><div className="grid gap-3 md:grid-cols-3"><input className={inputClass} placeholder="Language name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input className={inputClass} placeholder="Native name" value={form.native_name} onChange={e => setForm({ ...form, native_name: e.target.value })} /><input className={inputClass} placeholder="Code (vi)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /><input className={inputClass} placeholder="Locale (vi-VN)" value={form.locale} onChange={e => setForm({ ...form, locale: e.target.value })} /><input className={inputClass} placeholder="URL prefix (vi)" value={form.url_prefix} onChange={e => setForm({ ...form, url_prefix: e.target.value })} /><button onClick={add} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ink-950 px-4 text-xs font-bold text-white"><Plus size={14} /> Add language</button></div></div>
    <div className="grid gap-4 lg:grid-cols-2">{languages.map(l => { const localPages = pages.filter(p => p.language_id === l.id); const open = selected === l.id; return <div key={l.id} className="rounded-2xl border border-line bg-white p-5"><div className="flex items-center gap-3"><Languages size={18} className="text-emerald-600" /><div className="min-w-0 flex-1"><b>{l.native_name} <span className="font-normal text-slate-400">({l.name})</span></b><p className="text-xs text-slate-500">{l.code} · {l.locale} · /{l.url_prefix}/ · {l.active ? 'Enabled' : 'Disabled'}</p></div><button onClick={() => toggle(l)} className="rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-bold">{l.active ? 'Disable' : 'Enable'}</button></div><button onClick={() => setSelected(open ? null : l.id)} className="mt-4 text-xs font-bold text-emerald-700">{open ? 'Hide localized pages' : `View localized pages (${localPages.length})`}</button>{open && <div className="mt-4 divide-y divide-line border-t border-line">{localPages.map(p => <div key={p.id} className="flex items-center gap-2 py-3"><div className="flex-1"><b className="text-sm">{p.title}</b><p className="text-[10px] text-slate-400">/{p.slug} · {p.published ? 'Published' : 'Draft'}</p></div><button onClick={() => setEditing(p)} className="rounded-lg p-2 text-slate-400 hover:bg-paper"><Pencil size={14} /></button></div>)}</div>}</div>})}</div>
  </div>;
}

function LocalizedEditor({ page, token, onClose, onSaved }: { page: LocalizedSeoPage; token: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>(page); const [doc, setDoc] = useState<ContentDocument | null>(null); const [blocks, setBlocks] = useState<PageBlock[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!page.content_document_id) return; void api(`/api/content-documents?id=${page.content_document_id}`, token).then(d => { setDoc(d); setBlocks(Array.isArray(d?.blocks) ? d.blocks : []); }); }, [page.id]);
  const save = async () => { try { setBusy(true); setError(''); let docId = form.content_document_id; const key = `localized:${page.country_slug}:${page.language_code}:${form.topic_key}`; const payload = { content_key: key, content_type: 'localized-seo', country_slug: page.country_slug, topic_slug: form.topic_key, slug: form.slug, title: form.title, excerpt: form.meta_description || '', html: blocksToHtml(blocks), blocks, seo_title: form.meta_title, seo_description: form.meta_description, published: false, indexable: false }; if (docId) await api('/api/content-documents', token, { method: 'PUT', body: JSON.stringify({ ...payload, id: docId }) }); else { const existing = await api(`/api/content-documents?key=${encodeURIComponent(key)}`, token); if (existing) docId = existing.id; else { const created = await api('/api/content-documents', token, { method: 'POST', body: JSON.stringify(payload) }); docId = created.id; } } await api('/api/localized-seo-pages', token, { method: 'PUT', body: JSON.stringify({ ...form, id: page.id, content_document_id: docId }) }); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save localized page'); } finally { setBusy(false); } };
  return <EditorShell title={`Edit localized page · ${page.language_native_name || page.language_code || ''}`} subtitle={`${page.country_name || page.country_slug} · ${page.topic_key}`} onClose={onClose} busy={busy} error={error} onSave={save}><div className="grid gap-4 md:grid-cols-2"><label>Title<input className={`${inputClass} mt-1`} value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Slug<input className={`${inputClass} mt-1`} value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} /></label><label>H1<input className={`${inputClass} mt-1`} value={form.h1 || ''} onChange={e => setForm({ ...form, h1: e.target.value })} /></label><label>Meta title<input className={`${inputClass} mt-1`} value={form.meta_title || ''} onChange={e => setForm({ ...form, meta_title: e.target.value })} /></label><label className="md:col-span-2">Meta description<textarea className={`${areaClass} mt-1`} rows={2} value={form.meta_description || ''} onChange={e => setForm({ ...form, meta_description: e.target.value })} /></label></div><div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Localized content</p><PageBuilder value={blocks} onChange={setBlocks} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Toggle label="Published" value={!!form.published} onChange={v => setForm({ ...form, published: v })} /><Toggle label="Indexable" value={!!form.indexable} onChange={v => setForm({ ...form, indexable: v })} /></div></EditorShell>;
}

function EditorShell({ title, subtitle, error, busy, onClose, onSave, children }: { title: string; subtitle: string; error: string; busy: boolean; onClose: () => void; onSave: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-950/70 p-3 backdrop-blur-sm"><div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg"><div className="bg-ink-950 px-5 py-4 text-white"><p className="font-display font-bold">{title}</p><p className="text-xs text-slate-400">{subtitle}</p></div><div className="flex-1 overflow-y-auto p-5 sm:p-7">{error && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</div>}{children}</div><div className="flex justify-end gap-2 border-t border-line bg-white px-5 py-4"><button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold">Cancel</button><button disabled={busy} onClick={onSave} className="rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save changes'}</button></div></div></div>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) { return <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span className="text-sm font-bold">{label}</span><button type="button" onClick={() => onChange(!value)} className={`h-6 w-11 rounded-full ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${value ? 'translate-x-5' : 'translate-x-0.5'}`} /></button></label>; }
function SectionHeader({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) { return <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>{action && <button onClick={onAction} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white"><Plus size={14} className="text-emerald-400" /> {action}</button>}</div>; }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm text-slate-500">{text}</div>; }
