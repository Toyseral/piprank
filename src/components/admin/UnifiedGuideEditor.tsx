import { useMemo, useState } from 'react';
import { Eye, FileText, Link2, Plus, Save, Trash2, X, Loader2 } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage } from '../../lib/types';
import PageBuilder, { blocksToHtml } from '../PageBuilder';
import ManualBrokerOrder from '../ManualBrokerOrder';
import { getCountrySeoTopic, rankCountryTopicBrokers } from '../../data/countrySeoTopics';

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

type Props = {
  document: ContentDocument | null;
  countries: CountryPage[];
  brokers: Broker[];
  token: string;
  onClose: () => void;
  onSave: (fields: Record<string, unknown>, isNew: boolean) => Promise<void>;
  defaultContentType?: 'guide' | 'country-guide' | 'localized-guide' | 'country-topic';
  defaultCountrySlug?: string;
  languageCode?: string;
  languagePrefix?: string;
};

export default function UnifiedGuideEditor({ document, countries, brokers, token, onClose, onSave, defaultContentType = 'country-guide', defaultCountrySlug = '', languageCode = '', languagePrefix = '' }: Props) {
  const isNew = !document || document.id === 0;
  const initialSettings = document?.settings || {};
  const [form, setForm] = useState<any>(() => document ? {
    ...document,
    settings: initialSettings,
    category: document.category || initialSettings.category || 'Basics',
    level: document.level || initialSettings.level || 'Beginner',
    minutes: document.minutes ?? initialSettings.minutes ?? 8,
    image: document.image || initialSettings.image || GUIDE_IMAGES[0],
  } : {
    content_key: '', content_type: defaultContentType, country_slug: defaultCountrySlug, topic_slug: '', slug: '', title: '', excerpt: '',
    category: 'Basics', level: 'Beginner', minutes: 8, image: GUIDE_IMAGES[0], html: '', blocks: [], seo_title: '', seo_description: '',
    indexable: false, published: false, settings: languageCode ? { languageCode } : {},
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(false);
  const settings = form.settings || {};
  const [rankingMode, setRankingMode] = useState(settings.rankingMode || 'auto');
  const [pinned, setPinned] = useState<string[]>(settings.pinnedBrokerSlugs || []);
  const [excluded, setExcluded] = useState<string[]>(settings.excludedBrokerSlugs || []);
  const [faqs, setFaqs] = useState<any[]>(settings.faqs || []);
  const [links, setLinks] = useState<any[]>(settings.internalLinks || []);
  const isTopic = form.content_type === 'country-topic';
  const route = form.content_type === 'guide' && form.slug ? `/guides/${form.slug}` : form.content_type === 'localized-guide' && form.country_slug && form.slug && languagePrefix ? `/${form.country_slug}/${languagePrefix}/guides/${form.slug}` : form.content_type === 'country-guide' && form.country_slug && form.slug ? `/${form.country_slug}/guides/${form.slug}` : form.country_slug ? (form.topic_slug ? `/${form.country_slug}/${form.topic_slug}` : `/${form.country_slug}`) : '#';
  const input = 'h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500';
  const manualPool = useMemo(() => {
    if (!isTopic) return [] as Broker[];
    const country = countries.find(c => c.slug === form.country_slug);
    const topic = form.topic_slug ? getCountrySeoTopic(form.topic_slug) : null;
    if (!country || !topic) return [] as Broker[];
    const excludedSet = new Set(excluded);
    return rankCountryTopicBrokers(brokers, country, topic).filter((b: Broker) => !excludedSet.has(b.slug));
  }, [isTopic, form.country_slug, form.topic_slug, countries, brokers, excluded]);
  const unavailablePinned = useMemo(() => pinned.filter(slug => !manualPool.some(b => b.slug === slug)), [pinned, manualPool]);
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
      if (isTopic && rankingMode === 'manual' && pinned.length === 0) throw new Error('Manual ranking requires at least one selected eligible broker.');
      const slug = form.slug || form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!slug && form.indexable) throw new Error('An indexable guide needs a slug.');
      const type = form.content_type || defaultContentType;
      const key = form.content_key || (type === 'localized-guide' ? `localized-guide:${form.country_slug}:${languageCode || settings.languageCode || ''}:${slug}` : type === 'country-guide' ? `country-guide:${form.country_slug}:${slug}` : type === 'guide' ? `guide:${slug}` : `country-topic:${form.country_slug}:${form.topic_slug}`);
      const cleanPinned = Array.from(new Set(pinned));
      await onSave({ ...form, content_type: type, slug, content_key: key, html: blocksToHtml(form.blocks || []), settings: {
        ...settings, category: form.category, level: form.level, minutes: Number(form.minutes) || 0, image: form.image,
        rankingMode, pinnedBrokerSlugs: cleanPinned, excludedBrokerSlugs: excluded, faqs, internalLinks: links,
        ...(languageCode ? { languageCode } : {}),
      }, ...(isNew ? {} : { id: document!.id }) }, isNew);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  const fixedContext = defaultContentType === 'guide' || defaultContentType === 'country-guide' || defaultContentType === 'localized-guide';
  return <div className="fixed inset-0 z-[120] bg-ink-950/60 p-2 backdrop-blur-sm"><div className="flex h-full flex-col overflow-hidden rounded-3xl bg-paper shadow-soft-lg">
    <header className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white"><FileText size={20} className="text-emerald-400"/><div className="min-w-0 flex-1"><p className="font-display text-lg font-bold">{isNew ? 'Create guide' : 'Edit guide'}</p><p className="truncate text-xs text-slate-400">{route} · {form.content_type === 'localized-guide' ? 'localized guide' : form.content_type === 'country-guide' ? 'country guide' : form.content_type === 'guide' ? 'global guide' : 'SEO content'}</p></div>{route !== '#' && <a href={`${route}${form.content_type === 'localized-guide' ? '?preview=1' : ''}`} target="_blank" rel="noreferrer" className="hidden rounded-xl border border-white/10 px-3 py-2 text-xs font-bold sm:inline-flex"><Eye size={14} className="mr-1.5"/> Preview</a>}<button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18}/></button></header>
    <div className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <main className="space-y-5">
        <section className="rounded-2xl border border-line bg-white p-5"><div className="grid gap-3 sm:grid-cols-2">
          {fixedContext ? <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Context</p><p className="mt-1 font-display text-sm font-bold text-ink-900">{form.content_type === 'localized-guide' ? `Localized guide · ${form.country_slug} · ${languageCode || settings.languageCode || 'language'}` : form.content_type === 'country-guide' ? `Country guide · ${form.country_slug || 'country not selected'}` : 'Global guide'}</p></div> : <label><b className="text-xs">Page type</b><select value={form.content_type} onChange={e => setForm({ ...form, content_type: e.target.value })} className={input}><option value="country-topic">Country SEO</option><option value="country-guide">Country guide</option><option value="localized-guide">Localized guide</option><option value="guide">Global guide</option></select></label>}
          <label><b className="text-xs">Title</b><input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className={input}/></label>
          {!fixedContext && <label><b className="text-xs">Country</b><select value={form.country_slug || ''} onChange={e => setForm({ ...form, country_slug: e.target.value })} className={input}><option value="">Select country</option>{countries.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>}
          {!fixedContext && <label><b className="text-xs">Slug</b><input value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="guide-slug" className={input}/></label>}
          <label><b className="text-xs">Category</b><select value={form.category || 'Basics'} onChange={e => setForm({ ...form, category: e.target.value })} className={input}>{GUIDE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
          <label><b className="text-xs">Level</b><select value={form.level || 'Beginner'} onChange={e => setForm({ ...form, level: e.target.value })} className={input}>{GUIDE_LEVELS.map(l => <option key={l}>{l}</option>)}</select></label>
          <label><b className="text-xs">Minutes</b><input type="number" min="1" value={form.minutes ?? 8} onChange={e => setForm({ ...form, minutes: e.target.value })} className={`tnum ${input}`} /></label>
          <label className="sm:col-span-2"><b className="text-xs">Introduction</b><textarea value={form.excerpt || ''} onChange={e => setForm({ ...form, excerpt: e.target.value })} rows={3} className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"/></label>
        </div>
        <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cover image</p><div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-6">{GUIDE_IMAGES.map(img => <button key={img} type="button" onClick={() => setForm({ ...form, image: img })} className={`overflow-hidden rounded-xl border-2 transition ${form.image === img ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-transparent opacity-70 hover:opacity-100'}`}><img src={img} alt="" className="h-16 w-full object-cover"/></button>)}</div></div>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5"><div className="flex items-center justify-between"><div><b className="font-display">Article content</b><p className="text-xs text-slate-400">Build the article with the same reorderable content blocks used by the global guide editor.</p></div><button onClick={() => setPreview(v => !v)} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">{preview ? 'Edit' : 'Preview'}</button></div>{preview ? <div className="piprank-rich-content mt-5 rounded-2xl border border-line bg-paper p-5" dangerouslySetInnerHTML={{ __html: blocksToHtml(form.blocks || []) }} /> : <div className="mt-3"><PageBuilder value={form.blocks || []} onChange={blocks => setForm({ ...form, blocks, html: blocksToHtml(blocks) })} onUploadImage={uploadImage}/></div>}</section>
      </main>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-line bg-white p-4"><b className="font-display">Publishing</b><div className="mt-3 space-y-2"><Toggle label="Published" value={!!form.published} setValue={v => setForm({ ...form, published: v })}/><Toggle label="Indexable" value={!!form.indexable} setValue={v => setForm({ ...form, indexable: v })}/></div></section>
        <section className="rounded-2xl border border-line bg-white p-4"><b className="font-display">SEO</b><input value={form.seo_title || ''} onChange={e => setForm({ ...form, seo_title: e.target.value })} className={`${input} mt-3`} placeholder="SEO title"/><textarea value={form.seo_description || ''} onChange={e => setForm({ ...form, seo_description: e.target.value })} rows={4} className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs" placeholder="Meta description"/></section>
        {isTopic && <section className="rounded-2xl border border-line bg-white p-4"><div><b className="font-display">Broker ranking</b><p className="mt-1 text-[11px] leading-5 text-slate-500">Automatic uses PipRank's existing country/topic ranking. Manual lets you choose the exact brokers and exact display order.</p></div><select value={rankingMode} onChange={e => setRankingMode(e.target.value)} className={`${input} mt-3`}><option value="auto">Automatic ranking</option><option value="manual">Manual broker order</option></select>{rankingMode === 'manual' && <><ManualBrokerOrder brokers={manualPool} value={pinned.filter(slug => manualPool.some(b => b.slug === slug))} onChange={setPinned}/>{unavailablePinned.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[10px] leading-5 text-amber-800"><b>{unavailablePinned.length} saved selection{unavailablePinned.length === 1 ? '' : 's'} not currently eligible.</b> They will not appear publicly until the broker is eligible for this country/topic again.</div>}</>}</section>}
        <section className="rounded-2xl border border-line bg-white p-4"><b className="font-display">FAQs</b>{faqs.map((f, i) => <div key={i} className="mt-2 rounded-xl border border-line bg-paper p-3"><input value={f.q || ''} onChange={e => setFaqs(x => x.map((y, j) => j === i ? { ...y, q: e.target.value } : y))} className={input} placeholder="Question"/><textarea value={f.a || ''} onChange={e => setFaqs(x => x.map((y, j) => j === i ? { ...y, a: e.target.value } : y))} rows={3} className="mt-2 w-full rounded-xl border border-line bg-white px-2 py-2 text-xs" placeholder="Answer"/><button onClick={() => setFaqs(x => x.filter((_, j) => j !== i))} className="mt-1 text-[11px] font-bold text-rose-600">Remove</button></div>)}<button onClick={() => setFaqs(x => [...x, { q: '', a: '' }])} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold"><Plus size={12}/> Add FAQ</button></section>
        <section className="rounded-2xl border border-line bg-white p-4"><b className="font-display">Internal links</b>{links.map((l, i) => <div key={i} className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-1"><input value={l.label || ''} onChange={e => setLinks(x => x.map((y, j) => j === i ? { ...y, label: e.target.value } : y))} className="rounded-lg border border-line px-2 py-2 text-xs" placeholder="Label"/><input value={l.href || ''} onChange={e => setLinks(x => x.map((y, j) => j === i ? { ...y, href: e.target.value } : y))} className="rounded-lg border border-line px-2 py-2 text-xs" placeholder="/ghana/mt5-forex-brokers"/><button onClick={() => setLinks(x => x.filter((_, j) => j !== i))}><Trash2 size={14}/></button></div>)}<button onClick={() => setLinks(x => [...x, { label: 'Related page', href: '/' }])} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold"><Link2 size={12}/> Add link</button></section>
        <button onClick={save} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white disabled:opacity-60"><Save size={15}/>{busy ? <><Loader2 size={14} className="animate-spin"/> Saving…</> : form.published ? 'Save & publish' : 'Save draft'}</button>{err && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{err}</p>}
      </aside>
    </div></div></div></div>;
}

function Toggle({ label, value, setValue }: { label: string; value: boolean; setValue: (v: boolean) => void }) {
  return <button type="button" onClick={() => setValue(!value)} className="flex w-full items-center justify-between rounded-xl bg-paper px-3 py-2.5 text-xs font-bold"><span>{label}</span><span className={`h-5 w-9 rounded-full p-0.5 ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`block h-4 w-4 rounded-full bg-white ${value ? 'translate-x-4' : ''}/></span></span></button>;
}
