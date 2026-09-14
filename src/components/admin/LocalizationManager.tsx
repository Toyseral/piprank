import { FormEvent, useEffect, useMemo, useState } from 'react';
import PageBuilder, { blocksToHtml, type PageBlock } from '../PageBuilder';
import { Globe2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type { ContentDocument, CountryLanguage, CountryPage } from '../../lib/types';
import { countrySeoTopics } from '../../data/countrySeoMatrix.js';
import { getLanguageTopicTemplate } from '../../lib/localization';

type Mutate = (path: string, method: string, body: unknown, msg: string) => Promise<void>;
const CANONICAL_TYPES = new Set(['localized-guide', 'localized-best-for']);

function localeFromKey(key: string) { const parts = key.split(':'); return parts.length >= 4 ? parts[2] : ''; }
function topicFromDoc(doc: ContentDocument) { return doc.topic_slug || doc.slug || doc.content_key.split(':').slice(3).join(':'); }

export function LocalizationManager({ countries, languages, mutate, accessToken }: {
  countries: CountryPage[];
  languages: CountryLanguage[];
  pages?: unknown[];
  mutate: Mutate;
  notify?: (msg: string) => void;
  accessToken?: string;
}) {
  const [docs, setDocs] = useState<ContentDocument[]>([]);
  const [countryId, setCountryId] = useState<number>(countries[0]?.id ?? 0);
  const [selectedLanguage, setSelectedLanguage] = useState<number | null>(null);
  const [name, setName] = useState(''); const [nativeName, setNativeName] = useState('');
  const [code, setCode] = useState(''); const [locale, setLocale] = useState(''); const [prefix, setPrefix] = useState('');
  const [saving, setSaving] = useState(false);

  const loadDocs = async () => {
    if (!accessToken) return;
    const response = await fetch('/api/content-documents?admin=true', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return;
    const data = await response.json();
    setDocs(Array.isArray(data) ? data.filter((d: ContentDocument) => CANONICAL_TYPES.has(d.content_type)) : []);
  };
  useEffect(() => { loadDocs(); }, [accessToken]);

  const country = countries.find((c) => c.id === countryId);
  const selectedLang = languages.find((l) => l.id === selectedLanguage) ?? null;
  const countryLanguages = languages.filter((l) => l.country_id === countryId);
  const selectedDocs = useMemo(() => {
    if (!country || !selectedLang) return [];
    return docs.filter((d) => d.country_slug === country.slug && localeFromKey(d.content_key) === selectedLang.code);
  }, [docs, country, selectedLang]);

  const addLanguage = async (e: FormEvent) => {
    e.preventDefault(); if (!countryId || !name || !nativeName || !code || !locale) return;
    setSaving(true);
    try {
      await mutate('/api/country-languages', 'POST', { country_id: countryId, name, native_name: nativeName, code, locale, url_prefix: prefix || code }, `${nativeName} localization created`);
      setName(''); setNativeName(''); setCode(''); setLocale(''); setPrefix('');
    } finally { setSaving(false); }
  };

  const addTopic = async (topicKey: string) => {
    if (!selectedLang || !country || !accessToken) return;
    const template = getLanguageTopicTemplate(selectedLang.code, topicKey, country.name);
    const slug = template.slug;
    const contentKey = `localized-best-for:${country.slug}:${selectedLang.code}:${slug}`;
    if (docs.some((d) => d.content_key === contentKey)) return;
    const response = await fetch('/api/content-documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        content_key: contentKey, content_type: 'localized-best-for', country_slug: country.slug, topic_slug: slug, slug,
        title: template.title, excerpt: template.description ?? '',
        html: (template.intro ?? []).map((p) => `<p>${String(p).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))}</p>`).join(''),
        blocks: [], settings: { locale: selectedLang.code, topic_key: topicKey, language_code: selectedLang.code }, published: false, indexable: false,
      }),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Failed to create localized page');
    await loadDocs();
  };

  const addableTopics = countrySeoTopics.filter((topic) => !selectedDocs.some((doc) => topicFromDoc(doc) === topic.key));

  return <div className="space-y-6">
    <div className="rounded-3xl border border-line bg-white p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country × Language</p><h2 className="mt-1 font-display text-xl font-bold text-ink-950">Localization Studio</h2><p className="mt-2 text-sm leading-6 text-slate-500">Localized guides and Best-For pages are canonical Content Studio documents. No legacy localized-seo pages are created here.</p></div><Globe2 className="text-emerald-600" size={22} /></div>
      <form onSubmit={addLanguage} className="mt-6 grid gap-3 md:grid-cols-3">
        <select value={countryId} onChange={(e) => setCountryId(Number(e.target.value))} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm">{countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}</select>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Language name" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" />
        <input value={nativeName} onChange={(e) => setNativeName(e.target.value)} placeholder="Native name" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" />
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Language code (vi)" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" />
        <input value={locale} onChange={(e) => setLocale(e.target.value)} placeholder="Locale (vi-VN)" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" />
        <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="URL prefix (vi)" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" />
        <button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink-950 px-4 text-sm font-bold text-white disabled:opacity-60 md:col-span-3">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create localization</button>
      </form>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {countryLanguages.map((language) => <div key={language.id} className={`rounded-2xl border bg-white p-5 ${selectedLanguage === language.id ? 'border-emerald-300' : 'border-line'}`}>
        <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="font-bold text-ink-950">{language.native_name} <span className="font-normal text-slate-400">({language.name})</span></p><p className="mt-1 text-xs text-slate-500">{language.country_name} · {language.locale} · /{language.url_prefix}/ · {language.active ? 'Active' : 'Inactive'}</p></div><button onClick={() => setSelectedLanguage(selectedLanguage === language.id ? null : language.id)} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">{selectedLanguage === language.id ? 'Hide pages' : 'Manage pages'}</button><button onClick={() => mutate('/api/country-languages', 'PUT', { id: language.id, active: !language.active }, language.active ? 'Language disabled' : 'Language enabled')} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">{language.active ? 'Disable' : 'Enable'}</button></div>
        {selectedLanguage === language.id && <div className="mt-5 space-y-3 border-t border-line pt-4">
          {selectedDocs.map((doc) => <LocalizedDocumentRow key={doc.id} doc={doc} token={accessToken} onSaved={loadDocs} />)}
          {!selectedDocs.length && <p className="text-sm text-slate-500">No canonical localized pages yet.</p>}
          {addableTopics.length > 0 && <div className="rounded-xl border border-dashed border-line bg-paper p-3"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Add commercial intent</p><div className="mt-2 flex flex-wrap gap-2">{addableTopics.slice(0, 24).map((t) => <button key={t.key} type="button" onClick={() => addTopic(t.key)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-emerald-400">+ {(t as { shortTitle?: string; title: string }).shortTitle || t.title}</button>)}</div></div>}
        </div>}
      </div>)}
    </div>
  </div>;
}

function LocalizedDocumentRow({ doc, token, onSaved }: { doc: ContentDocument; token?: string; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(doc.title || ''); const [seoTitle, setSeoTitle] = useState(doc.seo_title || ''); const [seoDescription, setSeoDescription] = useState(doc.seo_description || '');
  const [blocks, setBlocks] = useState<PageBlock[]>(Array.isArray(doc.blocks) ? doc.blocks as PageBlock[] : []); const [published, setPublished] = useState(Boolean(doc.published)); const [indexable, setIndexable] = useState(Boolean(doc.indexable));
  const [expanded, setExpanded] = useState(false); const [saving, setSaving] = useState(false);
  const save = async () => { if (!token) return; setSaving(true); try { const response = await fetch('/api/content-documents', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: doc.id, title, seo_title: seoTitle || null, seo_description: seoDescription || null, blocks, html: blocksToHtml(blocks), published, indexable }) }); if (!response.ok) throw new Error('Failed to save localized document'); await onSaved(); } finally { setSaving(false); } };
  const remove = async () => { if (!token || !window.confirm(`Delete ${doc.title || doc.slug}?`)) return; const response = await fetch('/api/content-documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: doc.id }) }); if (!response.ok) throw new Error('Failed to delete localized document'); await onSaved(); };
  return <div className="rounded-xl border border-line bg-paper p-4"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="font-semibold text-ink-950">{doc.title || doc.slug}</p><p className="text-xs text-slate-500">{doc.content_type} · {doc.slug} · {doc.published ? 'Published' : 'Draft'}</p></div><button type="button" onClick={() => setExpanded(!expanded)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold">{expanded ? 'Close' : 'Edit'}</button></div>{expanded && <div className="mt-4 space-y-3"><input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm" placeholder="Title" /><input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm" placeholder="SEO title" /><textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className="min-h-20 w-full rounded-lg border border-line bg-white p-3 text-sm" placeholder="SEO description" /><PageBuilder value={blocks} onChange={setBlocks} /><div className="flex flex-wrap items-center gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published</label><label className="flex items-center gap-2"><input type="checkbox" checked={indexable} onChange={(e) => setIndexable(e.target.checked)} /> Indexable</label></div><div className="flex gap-2"><button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-ink-950 px-4 py-2 text-xs font-bold text-white"><Save size={14} /> {saving ? 'Saving…' : 'Save'}</button><button type="button" onClick={remove} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700"><Trash2 size={14} /> Delete</button></div></div>}</div>;
}

export default LocalizationManager;
