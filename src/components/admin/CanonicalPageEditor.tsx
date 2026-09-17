import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage } from '../../lib/types';
import PageBuilder, { blocksToHtml, type PageBlock } from '../PageBuilder';
import BestForCanonicalPageEditor from './BestForCanonicalPageEditor';

type CanonicalEditorKind = 'broker' | 'best-for';
type CanonicalSlot =
  | 'overview'
  | 'editorial_before_pricing'
  | 'pricing'
  | 'platforms'
  | 'trust'
  | 'editorial_after_trust'
  | 'faq'
  | 'final_cta';

type Props = {
  kind: CanonicalEditorKind;
  document: ContentDocument | null;
  brokers: Broker[];
  countries: CountryPage[];
  token: string;
  onClose: () => void;
  onSave: (document: ContentDocument, isNew: boolean) => Promise<void>;
};

const BROKER_SLOTS: { key: CanonicalSlot; label: string }[] = [
  { key: 'overview', label: 'Broker Overview' },
  { key: 'editorial_before_pricing', label: 'Editorial Zone — before Pricing' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'platforms', label: 'Platforms' },
  { key: 'trust', label: 'Regulation / Trust' },
  { key: 'editorial_after_trust', label: 'Editorial Zone — after Trust' },
  { key: 'faq', label: 'FAQ' },
  { key: 'final_cta', label: 'Final CTA' },
];

function normalizeBlocks(document: ContentDocument | null): PageBlock[] {
  if (!document) return [];
  if (Array.isArray(document.blocks) && document.blocks.length) return document.blocks as PageBlock[];
  if (document.html) return [{ id: 'legacy', type: 'richtext', html: document.html }];
  return [];
}

function zoneOf(block: PageBlock): CanonicalSlot {
  const zone = (block as PageBlock & { zone?: string }).zone;
  return (BROKER_SLOTS.some((slot) => slot.key === zone) ? zone : 'overview') as CanonicalSlot;
}

export default function CanonicalPageEditor({ kind, document, brokers, countries, token, onClose, onSave }: Props) {
  // Best-For has one canonical editor. Keep this existing admin entry point
  // as the compatibility boundary so callers do not create a second editor.
  if (kind === 'best-for') {
    const topicSlug = String(document?.topic_slug || document?.slug || '').trim().toLowerCase();
    const countrySlug = document?.country_slug || undefined;
    const contentType = document?.content_type || '';
    const editorKind = contentType === 'localized-best-for' ? 'localized' : countrySlug ? 'country' : 'global';
    const locale = document?.settings && typeof document.settings === 'object'
      ? String((document.settings as Record<string, unknown>).locale || '')
      : undefined;

    return (
      <BestForCanonicalPageEditor
        kind={editorKind}
        document={document}
        brokers={brokers}
        countries={countries}
        token={token}
        countrySlug={countrySlug}
        topicSlug={topicSlug}
        locale={locale}
        onClose={onClose}
        onSave={onSave}
      />
    );
  }

  return <BrokerCanonicalPageEditor
    document={document}
    brokers={brokers}
    token={token}
    onClose={onClose}
    onSave={onSave}
  />;
}

function BrokerCanonicalPageEditor({
  document,
  brokers,
  token,
  onClose,
  onSave,
}: {
  document: ContentDocument | null;
  brokers: Broker[];
  token: string;
  onClose: () => void;
  onSave: (document: ContentDocument, isNew: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<ContentDocument>(() => document ? { ...document, settings: document.settings ?? {} } : {
    id: 0,
    content_key: 'broker:new:main',
    content_type: 'broker',
    country_slug: null,
    topic_slug: null,
    slug: 'main',
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
  });
  const [blocks, setBlocks] = useState<PageBlock[]>(normalizeBlocks(document));
  const [activeSlot, setActiveSlot] = useState<CanonicalSlot>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(document ? { ...document, settings: document.settings ?? {} } : {
      id: 0,
      content_key: 'broker:new:main',
      content_type: 'broker',
      country_slug: null,
      topic_slug: null,
      slug: 'main',
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
    });
    setBlocks(normalizeBlocks(document));
  }, [document?.id]);

  const grouped = useMemo(() => {
    const map = new Map<CanonicalSlot, PageBlock[]>();
    BROKER_SLOTS.forEach(({ key }) => map.set(key, []));
    blocks.forEach((block) => {
      const key = zoneOf(block);
      map.get(key)!.push(block);
    });
    return map;
  }, [blocks]);

  const updateSlot = (slot: CanonicalSlot, next: PageBlock[]) => {
    setBlocks((current) => {
      const kept = current.filter((block) => zoneOf(block) !== slot);
      return [...kept, ...next.map((block) => ({ ...block, zone: slot }))];
    });
  };

  const save = async () => {
    try {
      setBusy(true);
      setError('');
      await onSave({
        ...form,
        content_type: 'broker',
        blocks,
        html: blocksToHtml(blocks, brokers),
      }, !document);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save broker content');
    } finally {
      setBusy(false);
    }
  };

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
    return out.url as string;
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-ink-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg">
        <header className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{document ? 'Edit' : 'Create'} broker page</p>
            <p className="text-xs text-slate-400">Broker editorial content with fixed page sections.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-line bg-paper p-3 md:block">
            <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Page structure</p>
            <div className="mt-2 space-y-1">
              {BROKER_SLOTS.map((slot) => {
                const count = grouped.get(slot.key)?.length ?? 0;
                return <button key={slot.key} onClick={() => setActiveSlot(slot.key)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold ${activeSlot === slot.key ? 'bg-ink-950 text-white' : 'text-slate-600 hover:bg-white'}`}><span>{slot.label}</span>{count > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">{count}</span>}</button>;
              })}
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto p-5 sm:p-7">
            {error && <p className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="text-xs font-bold text-slate-600">Title</span><input value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
              <label><span className="text-xs font-bold text-slate-600">Slug</span><input value={form.slug || ''} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
            </div>
            <label className="mt-4 block"><span className="text-xs font-bold text-slate-600">Excerpt</span><textarea value={form.excerpt || ''} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>

            <div className="mt-6 rounded-2xl border border-line bg-paper p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{BROKER_SLOTS.find((s) => s.key === activeSlot)?.label}</p><p className="mt-1 text-xs text-slate-500">Add content items in this position.</p></div>
                <button onClick={() => updateSlot(activeSlot, [...(grouped.get(activeSlot) || []), { id: `b_${Date.now()}`, type: 'richtext', html: '<p></p>', zone: activeSlot } as PageBlock])} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink-950 px-3 py-2 text-xs font-bold text-white"><Plus size={13} className="text-emerald-400" /> Add Item</button>
              </div>
              <div className="mt-4 rounded-xl border border-line bg-white p-3">
                <PageBuilder value={grouped.get(activeSlot) || []} onChange={(next) => updateSlot(activeSlot, next)} onUploadImage={uploadImage} />
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label><span className="text-xs font-bold text-slate-600">SEO title</span><input value={form.seo_title || ''} onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
              <label><span className="text-xs font-bold text-slate-600">SEO description</span><textarea value={form.seo_description || ''} onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span><strong className="block text-sm">Publish</strong><span className="text-xs text-slate-400">Show this page publicly.</span></span><input type="checkbox" checked={!!form.published} onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))} /></label>
              <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span><strong className="block text-sm">Index</strong><span className="text-xs text-slate-400">Allow search indexing.</span></span><input type="checkbox" checked={!!form.indexable} onChange={(e) => setForm((f) => ({ ...f, indexable: e.target.checked }))} /></label>
            </div>
          </main>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line bg-white px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold text-slate-600">Cancel</button>
          <button disabled={busy} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"><Save size={14} />{busy ? 'Saving…' : 'Save page'}</button>
        </footer>
      </div>
    </div>
  );
}
