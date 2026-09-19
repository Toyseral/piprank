import { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Pencil, Plus, Search, Trash2, X, Wand2 } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage } from '../../../lib/types';
import CountryGuides from '../CountryGuides';
import BestForEditorialPageBuilder from '../../../components/BestForEditorialPageBuilder';
import PageBuilder, { blocksToHtml, type PageBlock } from '../../../components/PageBuilder';

type Props = {
  countries: CountryPage[];
  brokers: Broker[];
  contentDocs: ContentDocument[];
  token: string;
  notify: (msg: string) => void;
};

function HubMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="rounded-xl border border-line bg-paper p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 font-display text-xl font-bold text-ink-900">{value}</p><p className="mt-0.5 text-[10px] text-slate-400">{sub}</p></div>;
}

const SEO_GENERATOR_TOPICS = [
  ['eur-usd-forex-brokers', 'EUR/USD Forex Brokers'],
  ['gold-forex-brokers', 'Gold Forex Brokers'],
  ['mt5-forex-brokers', 'MT5 Forex Brokers'],
  ['low-spread-forex-brokers', 'Low Spread Forex Brokers'],
  ['forex-brokers-for-beginners', 'Forex Brokers for Beginners'],
  ['forex-brokers-for-scalping', 'Forex Brokers for Scalping'],
  ['islamic-forex-brokers', 'Islamic Forex Brokers'],
  ['low-minimum-deposit-forex-brokers', 'Low Minimum Deposit Forex Brokers'],
  ['copy-trading-forex-brokers', 'Copy Trading Forex Brokers'],
  ['forex-brokers-with-demo-accounts', 'Forex Brokers with Demo Accounts'],
  ['forex-brokers-for-hedging', 'Forex Brokers for Hedging'],
  ['raw-spread-forex-brokers', 'Raw Spread Forex Brokers'],
  ['ecn-forex-brokers', 'ECN Forex Brokers'],
  ['standard-account-forex-brokers', 'Standard Account Forex Brokers'],
  ['forex-brokers-for-swing-trading', 'Forex Brokers for Swing Trading'],
  ['high-leverage-forex-brokers', 'High Leverage Forex Brokers'],
  ['eur-usd-mt5-forex-brokers', 'EUR/USD MT5 Forex Brokers'],
  ['eur-usd-forex-brokers-for-scalping', 'EUR/USD Forex Brokers for Scalping'],
  ['mt5-gold-forex-brokers', 'MT5 Gold Forex Brokers'],
  ['gold-forex-brokers-for-scalping', 'Gold Forex Brokers for Scalping'],
  ['mt5-forex-brokers-for-scalping', 'MT5 Forex Brokers for Scalping'],
  ['low-spread-mt5-forex-brokers', 'Low Spread MT5 Forex Brokers'],
  ['low-spread-forex-brokers-for-scalping', 'Low Spread Forex Brokers for Scalping'],
  ['islamic-mt5-forex-brokers', 'Islamic MT5 Forex Brokers'],
  ['mt5-forex-brokers-for-beginners', 'MT5 Forex Brokers for Beginners'],
  ['low-spread-gold-forex-brokers', 'Low Spread Gold Forex Brokers'],
] as const;

function SeoGeneratorPanel({ country, token, notify, onCreated }: { country: CountryPage; token: string; notify: (msg: string) => void; onCreated: () => void }) {
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generate = async () => {
    if (!topic) return setMessage('Select an SEO topic first.');
    setBusy(true); setMessage('Generating draft and checking canonical broker eligibility…');
    try {
      const res = await fetch('/api/seo-page-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ country_slug: country.slug, topic_slug: topic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setMessage(`Draft created with ${data.qualifyingBrokerCount} qualifying brokers. ${data.eligibleForIndexing ? 'It meets the indexing threshold; review before publishing.' : 'It is noindex because it does not meet the broker threshold.'}`);
      notify('SEO draft generated');
      setTopic('');
      onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };
  return <div className="rounded-2xl border border-line bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">SEO generator</p><h3 className="mt-1 font-display text-lg font-bold text-ink-900">Generate a country Best-For draft</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Creates a canonical country Best-For draft using the country broker ranking eligibility rules. It never auto-publishes.</p></div>
      <Wand2 size={18} className="text-emerald-600"/>
    </div>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <select value={topic} onChange={e=>setTopic(e.target.value)} className="h-10 flex-1 rounded-xl border border-line bg-paper px-3 text-sm">
        <option value="">Select SEO topic</option>
        {SEO_GENERATOR_TOPICS.map(([slug,label])=><option key={slug} value={slug}>{label}</option>)}
      </select>
      <button disabled={busy} onClick={generate} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ink-950 px-4 text-xs font-bold text-white disabled:opacity-60"><Wand2 size={14}/>{busy?'Generating…':'Generate draft'}</button>
    </div>
    {message&&<p className="mt-3 rounded-xl bg-paper px-3 py-2.5 text-xs leading-5 text-slate-600">{message}</p>}
  </div>;
}

function EntityPanel({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl border border-line bg-white p-5"><h3 className="font-display text-lg font-bold text-ink-900">{title}</h3><div className="mt-3 space-y-2">{items.map((item) => <div key={item} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-xs font-medium text-slate-600"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{item}</div>)}</div></div>;
}

function emptyDoc(country: string): ContentDocument {
  return { id: 0, content_key: `country-best-for:${country}:`, content_type: 'country-best-for', country_slug: country, topic_slug: null, slug: '', title: '', excerpt: '', html: '', blocks: [], seo_title: null, seo_description: null, indexable: true, published: false, updated_by: null, created_at: '', updated_at: '', settings: {} };
}

function CountryBestForEditor({ country, document, brokers, globalBestFor, token, onClose, onSaved, notify }: { country: CountryPage; document: ContentDocument | null; brokers: Broker[]; globalBestFor: ContentDocument[]; token: string; onClose: () => void; onSaved: () => void; notify: (msg: string) => void }) {
  const [form, setForm] = useState<ContentDocument>(() => document ? { ...document } : emptyDoc(country.slug));
  const [owners, setOwners] = useState<ContentDocument[]>(globalBestFor);
  const [showOwnerCreator, setShowOwnerCreator] = useState(false);
  const [blocks, setBlocks] = useState<PageBlock[]>(() => Array.isArray(document?.blocks) && document.blocks.length ? document.blocks as PageBlock[] : document?.html ? [{ id: 'legacy', type: 'richtext', html: document.html }] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const createGlobalOwner = async (title: string, slugInput: string) => {
    const titleValue = title.trim();
    const slug = slugInput.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (titleValue.length < 8) throw new Error('Global Best-For title must be at least 8 characters.');
    if (!slug) throw new Error('A valid Best-For slug is required.');
    if (owners.some((owner) => owner.slug === slug)) throw new Error('A global Best-For owner with this slug already exists. Select it from the owner list.');

    const res = await fetch('/api/content-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        content_type: 'global-best-for',
        slug,
        title: titleValue,
        excerpt: '',
        html: '',
        blocks: [],
        indexable: false,
        published: false,
        settings: {},
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Could not create global Best-For owner');
    const created = out as ContentDocument;
    setOwners((current) => [...current, created].sort((a, b) => String(a.title || a.slug).localeCompare(String(b.title || b.slug))));
    setForm((current) => ({ ...current, topic_slug: created.slug, slug: created.slug, title: created.title }));
    setShowOwnerCreator(false);
    notify('Global Best-For owner created');
  };

  const uploadImage = async (file: File) => {
    const reader = new FileReader();
    const data = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const res = await fetch('/api/content-assets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64: data }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Image upload failed');
    return out.url;
  };

  const save = async (publish = false) => {
    const slug = String(form.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) return setError('Best-For slug is required.');
    if (String(form.title || '').trim().length < 8) return setError('Write a useful page H1/title.');
    setBusy(true); setError('');
    try {
      const payload = { ...form, slug, country_slug: country.slug, content_type: 'country-best-for', content_key: `country-best-for:${country.slug}:${slug}`, blocks, html: blocksToHtml(blocks), published: publish ? true : Boolean(form.published), indexable: Boolean(form.indexable) };
      const res = await fetch('/api/content-documents', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form.id ? { ...payload, id: form.id } : payload) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save Best-For page');
      notify(publish ? 'Country Best-For page published' : (form.id ? 'Country Best-For page saved' : 'Country Best-For page created'));
      onSaved();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save Best-For page'); } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/60 p-3 backdrop-blur-sm"><div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg"><div className="flex items-center gap-3 bg-ink-950 px-5 py-4 text-white"><div className="min-w-0 flex-1"><p className="font-display font-bold">{form.id ? 'Edit' : 'Create'} country Best-For page</p><p className="text-xs text-slate-400">/{country.slug}/{form.slug || 'best-for-slug'} · canonical Content Studio document</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18}/></button></div><div className="flex-1 overflow-y-auto p-5 sm:p-7">{error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>}<div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Canonical Best-For owner</span><div className="flex gap-2"><select value={form.topic_slug || ''} disabled={Boolean(form.id)} onChange={e=>{const topic=e.target.value;const owner=owners.find(doc=>doc.slug===topic);setForm(f=>({...f,topic_slug:topic,slug:owner?.slug || f.slug,title:owner?.title || f.title}))}} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500 disabled:opacity-60"><option value="">Select canonical Best-For</option>{owners.map(owner=><option key={owner.id} value={owner.slug || ''}>{owner.title || owner.slug}</option>)}</select>{!form.id&&<button type="button" onClick={()=>setShowOwnerCreator(true)} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-paper px-3 text-xs font-bold text-slate-600 hover:border-emerald-400"><Plus size={13}/>Create new</button>}</div></label><label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Slug</span><input value={form.slug || ''} readOnly={Boolean(!form.id && form.topic_slug)} onChange={e=>setForm({...form,slug:e.target.value})} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500 read-only:opacity-60" placeholder="forex-brokers-for-beginners"/></label><label className="sm:col-span-2"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Title (H1)</span><input value={form.title || ''} onChange={e=>setForm({...form,title:e.target.value})} className="h-10 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-emerald-500" placeholder="Best Forex Brokers for Beginners in Vietnam"/></label></div><label className="mt-4 block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Intro / excerpt</span><textarea value={form.excerpt || ''} onChange={e=>setForm({...form,excerpt:e.target.value})} rows={3} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label><div className="mt-5"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Visual page builder</p><BestForEditorialPageBuilder
  value={blocks}
  brokers={brokers}
  analysisBrokers={brokers}
  onChange={next=>{setBlocks(next);setForm(f=>({...f,blocks:next,html:blocksToHtml(next)}))}}
  onUploadImage={uploadImage}
/></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">SEO title</span><input value={form.seo_title || ''} onChange={e=>setForm({...form,seo_title:e.target.value})} className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500"/></label><label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">SEO description</span><textarea value={form.seo_description || ''} onChange={e=>setForm({...form,seo_description:e.target.value})} rows={2} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-emerald-500"/></label></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><div><p className="text-sm font-bold text-ink-900">Publish this page</p><p className="text-xs text-slate-500">Drafts stay out of the public site until published.</p></div><button type="button" onClick={()=>setForm(f=>({...f,published:!f.published}))} className={`relative h-6 w-11 rounded-full ${form.published?'bg-emerald-500':'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${form.published?'left-[22px]':'left-0.5'}`}/></button></div><div className="flex items-center justify-between rounded-xl border border-line bg-paper p-4"><div><p className="text-sm font-bold text-ink-900">Index this page</p><p className="text-xs text-slate-500">Only index substantial, unique commercial content.</p></div><button type="button" onClick={()=>setForm(f=>({...f,indexable:!f.indexable}))} className={`relative h-6 w-11 rounded-full ${form.indexable?'bg-emerald-500':'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${form.indexable?'left-[22px]':'left-0.5'}`}/></button></div></div><button onClick={save} disabled={busy} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-bold text-white disabled:opacity-60">{busy&&<Loader2 size={15} className="animate-spin"/>}Save country hub</button>
      </div>
    </div>
    {showOwnerCreator && <GlobalBestForOwnerCreator onClose={() => setShowOwnerCreator(false)} onCreate={createGlobalOwner} />}
  </div>;
}

function GlobalBestForOwnerCreator({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, slug: string) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try { await onCreate(title, slug); } catch (e) { setError(e instanceof Error ? e.message : 'Could not create global Best-For owner'); } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-950/40 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft-lg">
      <div className="flex items-start justify-between gap-4"><div><p className="font-display text-lg font-bold text-ink-900">Create global Best-For owner</p><p className="mt-1 text-xs leading-5 text-slate-500">This creates the canonical global owner first. The country page will be linked to it automatically.</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-paper"><X size={17}/></button></div>
      {error&&<p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-600">{error}</p>}
      <label className="mt-4 block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Global Best-For name</span><input autoFocus value={title} onChange={e=>{setTitle(e.target.value);if(!slug)setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}} placeholder="Best Stock Trading Apps" className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500"/></label>
      <label className="mt-4 block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Canonical slug</span><input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="best-stock-trading-apps" className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500"/></label>
      <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-slate-600">Cancel</button><button disabled={busy} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{busy&&<Loader2 size={13} className="animate-spin"/>}Create owner</button></div>
    </div>
  </div>;
}

function CountryBrokerRankingPanel({ country, brokers, token, notify }: { country: CountryPage; brokers: Broker[]; token: string; notify: (msg: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [eligibleBrokers, setEligibleBrokers] = useState<Broker[]>([]);
  const [mode, setMode] = useState<'automatic' | 'manual'>('automatic');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/country-broker-rankings?country=${encodeURIComponent(country.slug)}&admin=true`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setMode(data.ranking_mode === 'manual' ? 'manual' : 'automatic'); setRows(Array.isArray(data.rows) ? data.rows.slice(0, 9) : []); setEligibleBrokers(Array.isArray(data.eligible_brokers) ? data.eligible_brokers : []); }
  };
  useEffect(() => { load(); }, [country.slug]);

  const saveMode = async (next: 'automatic' | 'manual') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/country-broker-rankings?country=${encodeURIComponent(country.slug)}&admin=true`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ranking_mode: next }),
      });
      if (!res.ok) throw new Error('Could not save ranking mode');
      setMode(next); notify(`Country broker ranking set to ${next}`);
    } catch (e) { notify(e instanceof Error ? e.message : 'Could not save ranking mode'); } finally { setBusy(false); }
  };

  const saveRank = async (brokerId: number, manualRank: number | null) => {
    const res = await fetch(`/api/country-broker-rankings?country=${encodeURIComponent(country.slug)}&admin=true`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ broker_id: brokerId, manual_rank: manualRank }),
    });
    if (!res.ok) { const out = await res.json().catch(() => ({})); notify(out.error || 'Could not save broker rank'); return; }
    await load(); notify('Country broker ranking updated');
  };

  const rankedIds = new Set(rows.map((row) => Number(row.broker_id)));
  const candidates = eligibleBrokers.filter((broker) => !rankedIds.has(Number(broker.id))).slice(0, 12);

  return <div className="rounded-2xl border border-line bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-display text-lg font-bold text-ink-900">Top Brokers for {country.name}</h3><p className="mt-0.5 text-xs text-slate-500">Country-level ranking. Separate from Best-For / intent rankings.</p></div>
      <div className="flex rounded-xl border border-line bg-paper p-1">
        {(['automatic','manual'] as const).map((item) => <button key={item} disabled={busy} onClick={() => saveMode(item)} className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${mode === item ? 'bg-ink-950 text-white' : 'text-slate-500'}`}>{item}</button>)}
      </div>
    </div>
    <div className="mt-4 space-y-2">
      {rows.map((row, index) => <div key={row.broker_id} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
        <span className="w-6 text-center text-xs font-bold text-slate-400">#{index + 1}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{row.broker?.name}</p><p className="text-[11px] text-slate-400">Score {Number(row.final_score).toFixed(1)} · {row.availability_status}</p></div>
        {mode === 'manual' && <select value={row.manual_rank ?? ''} onChange={e => saveRank(Number(row.broker_id), e.target.value ? Number(e.target.value) : null)} className="h-9 rounded-lg border border-line bg-white px-2 text-xs">
          <option value="">Auto</option>{Array.from({length: 9}, (_, i) => <option key={i+1} value={i+1}>Rank {i+1}</option>)}
        </select>}
      </div>)}
      {!rows.length && <p className="rounded-xl bg-paper p-4 text-sm text-slate-400">No ranked brokers are currently available.</p>}
    </div>
    {mode === 'manual' && candidates.length > 0 && <div className="mt-4 flex flex-wrap gap-2">
      {candidates.slice(0, 6).map((broker) => <button key={broker.id} onClick={() => saveRank(Number(broker.id), rows.length + 1)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-400">Add {broker.name}</button>)}
    </div>}
  </div>;
}

export default function CountryHub({ countries, brokers, contentDocs, token, notify }: Props) {
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(() => countries[0]?.slug ?? '');
  const [editingBestFor, setEditingBestFor] = useState<ContentDocument | null | 'new'>(null);
  const [editingCountryHub, setEditingCountryHub] = useState(false);
  const [docs, setDocs] = useState<ContentDocument[]>(contentDocs);
  useEffect(() => setDocs(contentDocs), [contentDocs]);

  const filtered = countries.filter((country) => `${country.name} ${country.slug}`.toLowerCase().includes(query.toLowerCase()));
  const selected = countries.find((country) => country.slug === selectedSlug) ?? filtered[0] ?? countries[0];
  const bestFor = useMemo(() => selected ? docs.filter((doc) => doc.content_type === 'country-best-for' && doc.country_slug === selected.slug) : [], [docs, selected]);
  const globalBestFor = useMemo(() => docs.filter((doc) => doc.content_type === 'global-best-for' && doc.slug), [docs]);
  const countryDocs = useMemo(() => selected ? docs.filter((doc) => doc.country_slug === selected.slug && doc.content_type !== 'country-best-for') : [], [docs, selected]);
  const publishedState = String((selected as any)?.publishing_state ?? ((selected as any)?.status ?? 'published'));

  if (!selected) return <div className="rounded-2xl border border-line bg-white p-8 text-sm text-slate-500">No countries found.</div>;

  const reload = async () => {
    const res = await fetch('/api/content-documents?admin=true', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => []);
    if (res.ok && Array.isArray(data)) setDocs(data);
  };

  return <div className="grid gap-5 lg:grid-cols-[300px_1fr]"><section className="rounded-2xl border border-line bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-ink-900">Countries</h2></div><div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-paper px-3"><Search size={14} className="text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search countries…" className="h-10 flex-1 bg-transparent text-sm outline-none"/></div><div className="mt-3 max-h-[560px] space-y-1 overflow-auto">{filtered.map(country=><button key={country.id} onClick={()=>setSelectedSlug(country.slug)} className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${selected.id===country.id?'bg-emerald-50 text-emerald-800':'hover:bg-paper'}`}><span className="font-bold">{country.flag} {country.name}</span><span className="block text-xs text-slate-400">/{country.slug}</span></button>)}</div></section><section className="space-y-5"><div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country Workspace</p><h2 className="font-display text-2xl font-bold text-ink-900">{selected.flag} {selected.name}</h2><p className="mt-1 text-sm text-slate-500">Canonical country guides and Best-For pages are managed as Content Studio documents.</p></div><button onClick={()=>setEditingCountryHub(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white"><Pencil size={14}/> Edit country hub</button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><HubMetric label="Publishing" value={publishedState} sub="draft · published · closed"/><HubMetric label="Best-For" value={String(bestFor.length)} sub="canonical country documents"/><HubMetric label="Country content" value={String(countryDocs.length + bestFor.length)} sub="guides and content docs"/></div></div><CountryBrokerRankingPanel country={selected} brokers={brokers} token={token} notify={notify}/><SeoGeneratorPanel country={selected} token={token} notify={notify} onCreated={reload}/><div className="grid gap-5 xl:grid-cols-2"><EntityPanel title="SEO QA" items={[selected.seo_title?'SEO title present':'Missing SEO title',selected.seo_description?'Meta description present':'Missing meta description']}/><EntityPanel title="Broker coverage" items={[`${brokers.length} brokers in database`,'Country eligibility is opt-out: brokers are eligible unless explicitly restricted or unavailable.','Use Broker Workspace to manage country availability states.']}/></div><div className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-display text-lg font-bold text-ink-900">Best-For pages</h3><p className="mt-0.5 text-xs text-slate-500">Canonical Content Studio ownership — no legacy country_best_for rows.</p></div><button onClick={()=>setEditingBestFor('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white"><Plus size={13}/> Add new page</button></div><div className="mt-3 divide-y divide-line rounded-xl border border-line">{bestFor.map(doc=><div key={doc.id} className="flex items-center justify-between px-4 py-3"><button onClick={()=>setEditingBestFor(doc)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold text-ink-900">{doc.title || doc.slug || doc.content_key}</span><span className="text-xs text-slate-400">/{selected.slug}/{doc.slug} · {doc.published?'Published':'Draft'} · {doc.indexable?'Indexable':'Noindex'}</span></button><div className="flex shrink-0 items-center gap-1">{doc.slug && (doc.published
  ? <a href={`/${selected.slug}/${doc.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Open published page"><Eye size={14}/></a>
  : <a href={`/archypage/preview/${doc.id}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50" title="Preview draft"><Eye size={14}/></a>)}<button onClick={()=>setEditingBestFor(doc)} className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Edit page"><Pencil size={14}/></button><button onClick={async()=>{if(!window.confirm('Delete this canonical Best-For document?'))return;const res=await fetch('/api/content-documents',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({id:doc.id})});if(!res.ok){const out=await res.json().catch(()=>({}));notify(out.error||'Could not delete page');return;}notify('Country Best-For page deleted');await reload();}} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete page"><Trash2 size={14}/></button></div></div>)}{!bestFor.length&&<p className="p-4 text-sm text-slate-400">No canonical country Best-For documents yet.</p>}</div></div><CountryGuides country={selected} countries={countries} brokers={brokers} token={token} notify={notify}/></section>{editingCountryHub&&<CountryHubEditor country={selected} document={docs.find(doc=>doc.content_type==='country'&&doc.content_key===`country:${selected.slug}:hub`) ?? null} token={token} notify={notify} onClose={()=>setEditingCountryHub(false)} onSaved={reload}/>} {editingBestFor&&<CountryBestForEditor country={selected} document={editingBestFor==='new'?null:editingBestFor} brokers={brokers} globalBestFor={globalBestFor} token={token} notify={notify} onClose={()=>setEditingBestFor(null)} onSaved={reload}/>}</div>;
}
