import { useMemo, useState } from 'react';
import { Pencil, Plus, Save, X } from 'lucide-react';
import type { ContentDocument } from '../../lib/types';
import EntityPanel from './components/EntityPanel';

const emptyAuthor = (): ContentDocument => ({
  id: 0,
  content_key: '',
  content_type: 'author',
  country_slug: null,
  topic_slug: null,
  slug: '',
  title: '',
  excerpt: '',
  html: '',
  blocks: [],
  seo_title: null,
  seo_description: null,
  indexable: false,
  published: true,
  updated_by: null,
  created_at: '',
  updated_at: '',
  settings: { role: 'Author', short_bio: '', expertise: [], credentials: [], links: [], display_order: 0, photo_url: '' },
});

const asList = (value: unknown) => Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];

export default function AuthorHub({ authors, allContent, token, onRefresh }: { authors: ContentDocument[]; allContent: ContentDocument[]; token: string; onRefresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<ContentDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sorted = useMemo(() => [...authors].sort((a, b) => Number(a.settings?.display_order ?? 0) - Number(b.settings?.display_order ?? 0)), [authors]);

  const open = (doc: ContentDocument) => { setError(''); setEditing({ ...doc, settings: { ...(doc.settings || {}) } }); };
  const save = async () => {
    if (!editing) return;
    const name = String(editing.title || '').trim();
    const slug = String(editing.slug || name).trim();
    if (!name || !slug) return setError('Author name and slug are required.');
    setBusy(true); setError('');
    try {
      const settings = {
        ...(editing.settings || {}),
        role: String(editing.settings?.role || 'Author').trim(),
        short_bio: String(editing.settings?.short_bio || '').trim(),
        expertise: asList(editing.settings?.expertise),
        credentials: asList(editing.settings?.credentials),
        links: Array.isArray(editing.settings?.links) ? editing.settings?.links : [],
        photo_url: String(editing.settings?.photo_url || '').trim(),
        display_order: Number(editing.settings?.display_order || 0),
      };
      const payload = { ...editing, title: name, slug, content_type: 'author', country_slug: null, topic_slug: null, excerpt: settings.short_bio, html: '', blocks: [], settings, indexable: false, published: editing.published !== false };
      const response = await fetch('/api/content-documents', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editing.id ? { ...payload, id: editing.id } : payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save author profile');
      setEditing(null);
      await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save author profile'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Author Hub</p><h2 className="font-display text-2xl font-bold text-ink-900">Editorial authors and reviewers</h2><p className="mt-1 text-sm text-slate-500">Authors are canonical content records. Add and edit their public bio, role, expertise, credentials, photo and links here.</p></div>
        <button onClick={() => open(emptyAuthor())} className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold text-white"><Plus size={14} /> New author</button>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((author) => <button key={author.id || author.content_key} onClick={() => open(author)} className="rounded-2xl border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-soft">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">{author.settings?.photo_url ? <img src={String(author.settings.photo_url)} alt="" className="h-full w-full object-cover" /> : (author.title || 'AU').slice(0, 2).toUpperCase()}</div><div><p className="font-display text-lg font-bold text-ink-900">{author.title || 'Untitled author'}</p><p className="text-xs text-slate-400">{String(author.settings?.role ?? 'Author')} · {author.published ? 'Published' : 'Draft'}</p></div></div>
        <p className="mt-3 line-clamp-3 text-sm text-slate-600">{String(author.settings?.short_bio ?? author.excerpt ?? '')}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{asList(author.settings?.expertise).slice(0, 4).map((x) => <span key={x} className="rounded-full bg-paper px-2 py-1 text-[11px] font-bold text-slate-500">{x}</span>)}</div>
      </button>)}
      {!sorted.length && <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">No author profiles are visible to the admin API yet. Existing author records in <code>content_documents</code> will appear here once loaded as the canonical <code>author</code> content type.</div>}
    </div>

    <EntityPanel title="Attribution readiness" items={[`${authors.length} author records`, `${allContent.filter((d) => d.settings?.written_by || d.settings?.reviewed_by || d.settings?.fact_checked_by).length} content documents with attribution metadata`, 'Use canonical author records for Written by, Reviewed by and Fact checked by attribution']} />

    {editing && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm"><div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg"><div className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white"><div className="flex-1"><p className="font-display text-lg font-bold">{editing.id ? 'Edit author profile' : 'New author profile'}</p><p className="text-xs text-slate-400">Canonical author content document</p></div><button onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18} /></button></div><div className="flex-1 overflow-y-auto p-5 sm:p-6">{error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>}<div className="grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-bold text-slate-500">Name / pen name</span><input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500" /></label><label><span className="text-xs font-bold text-slate-500">Slug</span><input value={editing.slug || ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="r-adeyemi" className="mt-1.5 h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500" /></label></div><label className="mt-4 block"><span className="text-xs font-bold text-slate-500">Role</span><input value={String(editing.settings?.role || '')} onChange={(e) => setEditing({ ...editing, settings: { ...(editing.settings || {}), role: e.target.value } })} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500" /></label><label className="mt-4 block"><span className="text-xs font-bold text-slate-500">Author bio</span><textarea value={String(editing.settings?.short_bio || '')} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value, settings: { ...(editing.settings || {}), short_bio: e.target.value } })} rows={7} placeholder="Write the public author bio…" className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm leading-relaxed outline-none focus:border-emerald-500" /></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-bold text-slate-500">Expertise (one per line)</span><textarea value={asList(editing.settings?.expertise).join('\n')} onChange={(e) => setEditing({ ...editing, settings: { ...(editing.settings || {}), expertise: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) } })} rows={5} className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm outline-none focus:border-emerald-500" /></label><label><span className="text-xs font-bold text-slate-500">Credentials (one per line)</span><textarea value={asList(editing.settings?.credentials).join('\n')} onChange={(e) => setEditing({ ...editing, settings: { ...(editing.settings || {}), credentials: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) } })} rows={5} className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm outline-none focus:border-emerald-500" /></label></div><label className="mt-4 block"><span className="text-xs font-bold text-slate-500">Photo URL</span><input value={String(editing.settings?.photo_url || '')} onChange={(e) => setEditing({ ...editing, settings: { ...(editing.settings || {}), photo_url: e.target.value } })} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500" /></label><label className="mt-4 block"><span className="text-xs font-bold text-slate-500">Display order</span><input type="number" value={Number(editing.settings?.display_order || 0)} onChange={(e) => setEditing({ ...editing, settings: { ...(editing.settings || {}), display_order: Number(e.target.value) || 0 } })} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500" /></label><label className="mt-4 flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span><span className="block text-sm font-bold">Published</span><span className="text-xs text-slate-400">Show this author on the public Authors page.</span></span><input type="checkbox" checked={editing.published !== false} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} /></label></div><div className="flex justify-end gap-2 border-t border-line bg-white px-5 py-4"><button onClick={() => setEditing(null)} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-slate-600">Cancel</button><button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={14} />{busy ? 'Saving…' : 'Save author'}</button></div></div></div>}
  </div>;
}
