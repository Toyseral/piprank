import { useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { CountryPage, Guide, GuideSection, ContentDocument } from '../../lib/types';
import { guideSectionsToLegacySections, isBlockShape } from '../../lib/contentBlocks';
import PageBuilder, { type PageBlock } from '../PageBuilder';

const GUIDE_CATEGORIES = ['Basics', 'Risk', 'Psychology', 'Platforms', 'Costs', 'Strategy'];
const GUIDE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];
const GUIDE_IMAGES = [
  '/images/guides/basics.jpg',
  '/images/guides/risk.jpg',
  '/images/guides/psychology.jpg',
  '/images/guides/platforms.jpg',
  '/images/guides/costs.jpg',
  '/images/guides/strategy.jpg',
];

type GuideContext = 'global' | 'country' | 'localized';

type GuideEditorDocument = Guide | ContentDocument | null;

interface GuideForm {
  title: string;
  excerpt: string;
  category: string;
  level: string;
  minutes: string;
  published: string;
  image: string;
  sections: unknown[];
  seo_title: string;
  seo_description: string;
  indexable: boolean;
  publishedFlag: boolean;
  slug: string;
  content_key: string;
  content_type: string;
  country_slug: string;
  languageCode: string;
  languagePrefix: string;
}

export interface SharedGuideEditorProps {
  document: GuideEditorDocument;
  context: GuideContext;
  countries?: CountryPage[];
  token: string;
  countrySlug?: string;
  languageCode?: string;
  languagePrefix?: string;
  onClose: () => void;
  onSave: (fields: Record<string, unknown>, isNew: boolean) => Promise<void>;
}

function toForm(document: GuideEditorDocument, props: SharedGuideEditorProps): GuideForm {
  const d = document as any;
  const settings = (d?.settings ?? {}) as Record<string, unknown>;
  const isGlobal = props.context === 'global';
  const countrySlug = props.countrySlug || String(d?.country_slug ?? '');
  const languageCode = props.languageCode || String(settings.languageCode ?? '');
  const languagePrefix = props.languagePrefix || String(settings.languagePrefix ?? '');
  return {
    title: String(d?.title ?? ''),
    excerpt: String(d?.excerpt ?? ''),
    category: String(isGlobal ? d?.category ?? 'Basics' : settings.category ?? d?.category ?? 'Basics'),
    level: String(isGlobal ? d?.level ?? 'Beginner' : settings.level ?? d?.level ?? 'Beginner'),
    minutes: String(isGlobal ? d?.minutes ?? 10 : settings.minutes ?? d?.minutes ?? 10),
    published: String(isGlobal ? d?.published ?? new Date().toISOString().slice(0, 10) : settings.publishedDate ?? new Date().toISOString().slice(0, 10)),
    image: String(isGlobal ? d?.image ?? GUIDE_IMAGES[0] : settings.coverImage ?? d?.image ?? GUIDE_IMAGES[0]),
    sections: Array.isArray(d?.sections) ? d.sections : Array.isArray(d?.blocks) ? d.blocks : [],
    seo_title: String(d?.seo_title ?? settings.seo_title ?? ''),
    seo_description: String(d?.seo_description ?? settings.seo_description ?? ''),
    indexable: Boolean(d?.indexable ?? true),
    publishedFlag: Boolean(d?.published === true || (props.context !== 'global' && d?.published === true)),
    slug: String(d?.slug ?? ''),
    content_key: String(d?.content_key ?? ''),
    content_type: String(d?.content_type ?? (props.context === 'localized' ? 'localized-guide' : props.context === 'country' ? 'country-guide' : 'guide')),
    country_slug: countrySlug,
    languageCode,
    languagePrefix,
  };
}

export default function GuideEditor(props: SharedGuideEditorProps) {
  const { document, context, token, onClose, onSave } = props;
  const isGlobal = context === 'global';
  const isCountry = context === 'country';
  const isLocalized = context === 'localized';
  const [form, setForm] = useState<GuideForm>(() => toForm(document, props));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const initialBlocks = useMemo<PageBlock[]>(() => {
    if (isBlockShape(form.sections)) return form.sections as PageBlock[];
    return [];
  }, []);

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

  const submit = async () => {
    if (form.title.trim().length < 4) return setErr('A guide title is required.');
    if (!form.slug.trim() && !isGlobal) return setErr('A guide slug is required.');
    setBusy(true);
    try {
      const blocks = form.sections as PageBlock[];
      if (isGlobal) {
        const out: Record<string, unknown> = {
          title: form.title,
          excerpt: form.excerpt,
          category: form.category,
          level: form.level,
          minutes: parseInt(form.minutes, 10) || 8,
          published: form.published,
          image: form.image,
          sections: blocks,
        };
        if (document) out.id = (document as Guide).id;
        await onSave(out, !document);
      } else {
        const settings = {
          ...((document as ContentDocument | null)?.settings ?? {}),
          category: form.category,
          level: form.level,
          minutes: parseInt(form.minutes, 10) || 8,
          coverImage: form.image,
          publishedDate: form.published,
          languageCode: form.languageCode || undefined,
          languagePrefix: form.languagePrefix || undefined,
        };
        const out: Record<string, unknown> = {
          ...(document as ContentDocument | null),
          title: form.title,
          excerpt: form.excerpt,
          slug: form.slug,
          content_type: form.content_type,
          country_slug: form.country_slug || null,
          topic_slug: null,
          blocks,
          html: '',
          seo_title: form.seo_title || null,
          seo_description: form.seo_description || null,
          indexable: form.indexable,
          published: form.publishedFlag,
          settings,
          content_key: form.content_key || (isLocalized
            ? `localized-guide:${form.country_slug}:${form.languageCode}:${form.slug}`
            : `country-guide:${form.country_slug}:${form.slug}`),
        };
        delete out.id;
        if (document) out.id = (document as ContentDocument).id;
        await onSave(out, !document);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save guide.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium outline-none transition focus:border-emerald-500';
  const title = document ? 'Edit guide' : 'New guide';
  const contextLabel = isGlobal ? 'Global guide' : isLocalized ? 'Localized guide' : 'Country guide';

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-soft-lg sm:max-w-5xl">
        <div className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{title}</p>
            <p className="text-xs text-slate-400">{contextLabel}{form.country_slug ? ` · ${form.country_slug}` : ''}{form.languageCode ? ` · ${form.languageCode}` : ''}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="mx-auto max-w-4xl space-y-5">
            {err && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{err}</p>}

            <div className="space-y-3">
              <label className="block"><FieldLabel>Title</FieldLabel><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="e.g. Forex Trading for Beginners" /></label>
              <label className="block"><FieldLabel>Excerpt</FieldLabel><textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label><FieldLabel>Category</FieldLabel><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>{GUIDE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label><FieldLabel>Level</FieldLabel><select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={inputCls}>{GUIDE_LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
                <label><FieldLabel>Minutes</FieldLabel><input type="number" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} className={`tnum ${inputCls}`} /></label>
                <label><FieldLabel>Published</FieldLabel><input value={form.published} onChange={(e) => setForm({ ...form, published: e.target.value })} className={inputCls} /></label>
              </div>
              <div>
                <FieldLabel>Cover image</FieldLabel>
                <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {GUIDE_IMAGES.map((img) => <button key={img} type="button" onClick={() => setForm({ ...form, image: img })} className={`overflow-hidden rounded-xl border-2 transition ${form.image === img ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-transparent opacity-70 hover:opacity-100'}`}><img src={img} alt="" className="aspect-[16/9] w-full object-cover" /></button>)}
                </div>
              </div>
            </div>

            <div>
              <FieldLabel hint="Reorder, add headings, images, tables, callouts and more">Article content</FieldLabel>
              <div className="mt-1.5"><PageBuilder value={initialBlocks} onChange={(blocks) => setForm((f) => ({ ...f, sections: blocks }))} onUploadImage={uploadImage} /></div>
            </div>

            {!isGlobal && <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label><FieldLabel>Slug</FieldLabel><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inputCls} /></label>
                <label><FieldLabel>SEO title</FieldLabel><input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} className={inputCls} /></label>
              </div>
              <label><FieldLabel>SEO description</FieldLabel><textarea value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} rows={3} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span className="text-sm font-bold">Publish</span><Toggle on={form.publishedFlag} onToggle={() => setForm({ ...form, publishedFlag: !form.publishedFlag })} /></label>
                <label className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><span className="text-sm font-bold">Index page</span><Toggle on={form.indexable} onToggle={() => setForm({ ...form, indexable: !form.indexable })} /></label>
              </div>
            </>}

            <button onClick={submit} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-60">{busy && <Loader2 size={15} className="animate-spin" />}{document ? 'Save guide' : 'Publish guide'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{children}{hint && <span className="ml-1.5 font-medium normal-case tracking-normal text-slate-400/70">{hint}</span>}</span>;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-200'}`} aria-pressed={on}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${on ? 'left-6' : 'left-1'}`} /></button>;
}

void guideSectionsToLegacySections;
