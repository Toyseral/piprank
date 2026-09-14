import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ContentDocument, Intent } from '../../lib/types';
import supabase from '../../lib/supabase';
import PageBuilder, { blocksToHtml, type PageBlock } from '../../components/PageBuilder';

const GLOBAL_BEST_FOR_PATHS: Record<string, string> = {
  'eur-usd': 'eur-usd-forex-brokers',
  gold: 'gold-forex-brokers',
  mt5: 'mt5-forex-brokers',
  'low-spread': 'low-spread-forex-brokers',
  beginners: 'forex-brokers-for-beginners',
  scalping: 'forex-brokers-for-scalping',
  islamic: 'islamic-forex-brokers',
  'low-deposit': 'low-minimum-deposit-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  demo: 'forex-brokers-with-demo-accounts',
  hedging: 'forex-brokers-for-hedging',
  'raw-spread': 'raw-spread-forex-brokers',
  ecn: 'ecn-forex-brokers',
  standard: 'standard-account-forex-brokers',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
};

type Props = {
  guides: ContentDocument[];
  onNewGuide: () => void;
  onEditGuide: (guide: ContentDocument) => void;
  /** Legacy intent-config callbacks kept source-compatible with Admin while intents remain non-owning config. */
  intents?: Intent[];
  onNewIntent?: () => void;
  onEditIntent?: (intent: Intent) => void;
  intentToTopic?: Record<string, string>;
};

export default function GlobalHub({ guides, onNewGuide, onEditGuide }: Props) {
  const [bestFors, setBestFors] = useState<ContentDocument[]>([]);
  const [editing, setEditing] = useState<ContentDocument | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBestFors = async () => {
    try {
      const res = await fetch('/api/content-documents?type=global-best-for');
      if (!res.ok) throw new Error('Could not load global Best-For documents');
      const data = await res.json();
      setBestFors(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load global Best-For documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBestFors();
  }, []);

  const sortedBestFors = useMemo(
    () => [...bestFors].sort((a, b) => a.title.localeCompare(b.title)),
    [bestFors],
  );

  return (
    <div className="space-y-5">
      {error && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="font-display text-base font-bold text-ink-900">Guides ({guides.length})</p>
            <button onClick={onNewGuide} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white">
              <Plus size={13} /> New guide
            </button>
          </div>
          <div className="divide-y divide-line">
            {guides.map((guide) => (
              <div key={guide.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{guide.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    /guides/{guide.slug ?? ''}{guide.published ? ' · Published' : ' · Draft'}
                  </p>
                </div>
                {guide.slug && (
                  <a href={`/guides/${guide.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400" title="Preview live page">
                    <Eye size={14} />
                  </a>
                )}
                <button onClick={() => onEditGuide(guide)} className="rounded-lg p-2 text-slate-400" title="Edit guide">
                  <Pencil size={14} />
                </button>
              </div>
            ))}
            {!guides.length && <p className="p-5 text-sm text-slate-400">No guides yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="font-display text-base font-bold text-ink-900">Best-For pages ({bestFors.length})</p>
              <p className="text-[11px] text-slate-400">Canonical Content Studio documents</p>
            </div>
            <button onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white">
              <Plus size={13} /> <span>New page</span>
            </button>
          </div>
          <div className="divide-y divide-line">
            {loading && <p className="p-5 text-sm text-slate-400">Loading…</p>}
            {!loading && sortedBestFors.map((doc) => {
              const slug = doc.slug ?? '';
              const path = GLOBAL_BEST_FOR_PATHS[slug] ?? slug;
              return (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-900">{doc.title || slug}</p>
                    <p className="truncate text-xs text-slate-400">
                      /{path}{doc.published ? ' · Published' : ' · Draft'}{doc.indexable ? '' : ' · Noindex'}
                    </p>
                  </div>
                  <a href={`/${path}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400" title="Preview live page">
                    <Eye size={14} />
                  </a>
                  <button onClick={() => setEditing(doc)} className="rounded-lg p-2 text-slate-400" title="Edit page">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete ${doc.title || slug}?`)) {
                        void deleteGlobalBestFor(doc.id, loadBestFors, setError);
                      }
                    }}
                    className="rounded-lg p-2 text-slate-400"
                    title="Delete page"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            {!loading && !sortedBestFors.length && <p className="p-5 text-sm text-slate-400">No canonical Best-For documents yet.</p>}
          </div>
        </div>
      </div>

      {editing && (
        <GlobalBestForEditor
          document={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadBestFors();
          }}
        />
      )}
    </div>
  );
}

async function deleteGlobalBestFor(id: number, reload: () => Promise<void>, setError: (value: string) => void) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/content-documents', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not delete page');
    await reload();
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Could not delete page');
  }
}

function GlobalBestForEditor({
  document,
  onClose,
  onSaved,
}: {
  document: ContentDocument | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initial = document ?? ({
    id: 0,
    content_key: '',
    content_type: 'global-best-for',
    country_slug: null,
    topic_slug: null,
    slug: '',
    title: '',
    excerpt: '',
    html: '',
    blocks: [],
    seo_title: null,
    seo_description: null,
    indexable: true,
    published: false,
    updated_by: null,
    created_at: '',
    updated_at: '',
    settings: {},
  } as ContentDocument);

  const [form, setForm] = useState<ContentDocument>(initial);
  const [blocks, setBlocks] = useState<PageBlock[]>(
    Array.isArray(initial.blocks)
      ? initial.blocks as PageBlock[]
      : initial.html
        ? [{ id: 'legacy', type: 'richtext', html: initial.html }]
        : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<ContentDocument>) => setForm((current) => ({ ...current, ...patch }));

  const uploadImage = async (file: File) => {
    const reader = new FileReader();
    const data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/content-assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64: data }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Image upload failed');
    return out.url;
  };

  const save = async () => {
    const rawSlug = form.slug ?? '';
    if (!rawSlug.trim()) return setError('A URL slug is required.');
    if (!form.title.trim()) return setError('A page title/H1 is required.');
    setBusy(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const payload = {
        ...form,
        content_type: 'global-best-for',
        slug,
        content_key: form.content_key.trim() || `best-for:${slug}`,
        html: blocksToHtml(blocks),
        blocks,
        id: document ? form.id : undefined,
      };
      const res = await fetch('/api/content-documents', {
        method: document ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save Best-For page');
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save Best-For page');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-ink-950/60 p-3 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg">
        <div className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{document ? 'Edit' : 'Create'} global Best-For page</p>
            <p className="text-xs text-slate-400">Canonical Content Studio document · intents remain ranking/config only</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">URL slug</span>
              <input value={form.slug ?? ''} onChange={(e) => set({ slug: e.target.value })} placeholder="mt5-forex-brokers" className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none" />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Content key</span>
              <input value={form.content_key} onChange={(e) => set({ content_key: e.target.value })} placeholder="best-for:mt5" className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none" />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">H1 / title</span>
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none" />
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Excerpt</span>
            <textarea value={form.excerpt} onChange={(e) => set({ excerpt: e.target.value })} rows={3} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none" />
          </label>

          <div className="mt-5">
            <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Page content</span>
            <PageBuilder value={blocks} onChange={(next) => { setBlocks(next); set({ blocks: next, html: blocksToHtml(next) }); }} onUploadImage={uploadImage} />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">SEO title</span>
              <input value={form.seo_title ?? ''} onChange={(e) => set({ seo_title: e.target.value })} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none" />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">SEO description</span>
              <textarea value={form.seo_description ?? ''} onChange={(e) => set({ seo_description: e.target.value })} rows={2} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none" />
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4">
              <span className="block text-sm font-bold">Publish</span>
              <button type="button" onClick={() => set({ published: !form.published })} className={`relative h-6 w-11 rounded-full ${form.published ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white ${form.published ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4">
              <span className="block text-sm font-bold">Index</span>
              <button type="button" onClick={() => set({ indexable: !form.indexable })} className={`relative h-6 w-11 rounded-full ${form.indexable ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white ${form.indexable ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line bg-white px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-slate-600">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-ink-950 px-5 py-2 text-xs font-bold text-white disabled:opacity-60">
            {busy ? 'Saving…' : document ? 'Save changes' : 'Create page'}
          </button>
        </div>
      </div>
    </div>
  );
}
