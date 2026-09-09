import { useEffect, useMemo, useState } from 'react';
import PageBuilder, { blocksToHtml, type PageBlock } from '../PageBuilder';
import type { Guide } from '../../lib/types';

type GuideFields = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  level: string;
  minutes: string;
  published: string;
  cover: string;
  sections: PageBlock[];
  published_at?: string;
};

type Props = {
  guide: Guide | null;
  onClose: () => void;
  onSave: (fields: GuideFields, isNew: boolean) => Promise<void> | void;
  onUploadImage?: (file: File) => Promise<string>;
};

const categories = ['Basics', 'Risk', 'Psychology', 'Platforms', 'Costs', 'Strategy'];
const levels = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];

function legacyToBlocks(value: unknown): PageBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((section: any, index) => {
    if (section?.type) return [{ id: section.id || `legacy_${index}`, ...section } as PageBlock];

    const blocks: PageBlock[] = [];
    if (section?.heading) {
      blocks.push({ id: `legacy_heading_${index}`, type: 'heading', title: String(section.heading) });
    }
    const paragraphs = Array.isArray(section?.paragraphs)
      ? section.paragraphs
      : section?.body
        ? [section.body]
        : [];
    paragraphs.filter(Boolean).forEach((p: unknown, pi: number) => {
      blocks.push({
        id: `legacy_text_${index}_${pi}`,
        type: 'richtext',
        html: `<p>${String(p)}</p>`,
      });
    });
    if (Array.isArray(section?.bullets) && section.bullets.length) {
      blocks.push({
        id: `legacy_bullets_${index}`,
        type: 'richtext',
        html: `<ul>${section.bullets.map((b: unknown) => `<li>${String(b)}</li>`).join('')}</ul>`,
      });
    }
    return blocks;
  });
}

function initialBlocks(guide: Guide | null): PageBlock[] {
  const raw = (guide as any)?.sections;
  if (Array.isArray(raw) && raw.some((x: any) => x?.type)) {
    return raw as PageBlock[];
  }
  return legacyToBlocks(raw);
}

export default function GuidePageBuilderEditor({ guide, onClose, onSave, onUploadImage }: Props) {
  const isNew = !guide;
  const [form, setForm] = useState<GuideFields>(() => ({
    title: guide?.title || '',
    slug: guide?.slug || '',
    excerpt: guide?.excerpt || '',
    category: guide?.category || 'Basics',
    level: guide?.level || 'Beginner',
    minutes: String((guide as any)?.minutes ?? (guide as any)?.reading_time ?? 5),
    published: String((guide as any)?.published || new Date().toISOString().slice(0, 10)),
    cover: (guide as any)?.cover || (guide as any)?.cover_image || '',
    sections: initialBlocks(guide),
    published_at: (guide as any)?.published_at,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      title: guide?.title || '',
      slug: guide?.slug || '',
      excerpt: guide?.excerpt || '',
      category: guide?.category || 'Basics',
      level: guide?.level || 'Beginner',
      minutes: String((guide as any)?.minutes ?? (guide as any)?.reading_time ?? 5),
      published: String((guide as any)?.published || new Date().toISOString().slice(0, 10)),
      cover: (guide as any)?.cover || (guide as any)?.cover_image || '',
      sections: initialBlocks(guide),
      published_at: (guide as any)?.published_at,
    });
    setError('');
  }, [guide]);

  const html = useMemo(() => blocksToHtml(form.sections), [form.sections]);

  const save = async () => {
    if (!form.title.trim()) {
      setError('A guide title is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({ ...form, slug: form.slug || form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), sections: form.sections, published_at: form.published_at || form.published }, isNew);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save guide.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500';
  const label = 'mb-1.5 block text-xs font-bold text-ink-900';

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-ink-950/40 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto min-h-full max-w-6xl rounded-2xl bg-white shadow-soft-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Guide editor</p>
            <h2 className="font-display text-xl font-bold text-ink-900">{isNew ? 'New guide' : 'Edit guide'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-slate-600">Cancel</button>
            <button disabled={busy} onClick={save} className="rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save guide'}</button>
          </div>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-line bg-paper p-4">
              <h3 className="font-display text-sm font-bold text-ink-900">Guide details</h3>
              <div className="mt-4 space-y-3">
                <div><label className={label}>Title</label><input className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><label className={label}>Slug</label><input className={input} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></div>
                <div><label className={label}>Excerpt</label><textarea className="min-h-24 w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-emerald-500" value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} /></div>
                <div><label className={label}>Category</label><select className={input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(x => <option key={x}>{x}</option>)}</select></div>
                <div><label className={label}>Level</label><select className={input} value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>{levels.map(x => <option key={x}>{x}</option>)}</select></div>
                <div><label className={label}>Reading time</label><input type="number" min="1" className={input} value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} /></div>
                <div><label className={label}>Published date</label><input type="date" className={input} value={form.published} onChange={e => setForm({ ...form, published: e.target.value })} /></div>
                <div><label className={label}>Cover image</label><input className={input} value={form.cover} onChange={e => setForm({ ...form, cover: e.target.value })} placeholder="/images/guides/..." /></div>
              </div>
            </div>
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          </aside>

          <section className="min-w-0 rounded-2xl border border-line bg-paper p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink-900">Article content</h3>
                <p className="mt-1 text-xs text-slate-500">Build the article with the same reusable content blocks used elsewhere in PipRank.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-500">{form.sections.length} blocks</span>
            </div>
            <PageBuilder value={form.sections} onChange={sections => setForm({ ...form, sections })} onUploadImage={onUploadImage} />
            <details className="mt-4 rounded-xl border border-line bg-white p-3">
              <summary className="cursor-pointer text-xs font-bold text-slate-600">Generated HTML preview</summary>
              <div className="mt-3 max-h-48 overflow-auto rounded-lg bg-ink-950 p-3 font-mono text-[10px] leading-5 text-emerald-200">{html || 'No content yet.'}</div>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
