import { FormEvent, useMemo, useState } from 'react';
import PageBuilder, { blocksToHtml, type PageBlock } from '../PageBuilder';
import { Eye, Globe2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type { ContentDocument, CountryLanguage, CountryPage } from '../../lib/types';
import { getLanguageTopicTemplate } from '../../lib/localization';

type Mutate = (path: string, method: string, body: unknown, msg: string) => Promise<void>;
const CANONICAL_TYPES = new Set(['localized-guide', 'localized-best-for']);

function localeFromKey(key: string) {
  const parts = key.split(':');
  return parts.length >= 4 ? parts[2] : '';
}

function topicFromDoc(doc: ContentDocument) {
  return doc.topic_slug || doc.slug || doc.content_key.split(':').slice(3).join(':');
}

export function LocalizationManager({ countries, languages, contentDocs, mutate }: {
  countries: CountryPage[];
  languages: CountryLanguage[];
  contentDocs: ContentDocument[];
  mutate: Mutate;
}) {
  const [countryId, setCountryId] = useState<number>(countries[0]?.id ?? 0);
  const [selectedLanguage, setSelectedLanguage] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [nativeName, setNativeName] = useState('');
  const [code, setCode] = useState('');
  const [locale, setLocale] = useState('');
  const [prefix, setPrefix] = useState('');
  const [saving, setSaving] = useState(false);

  const docs = useMemo(() => contentDocs.filter((doc) => CANONICAL_TYPES.has(doc.content_type)), [contentDocs]);
  const country = countries.find((c) => c.id === countryId);
  const selectedLang = languages.find((l) => l.id === selectedLanguage) ?? null;
  const countryLanguages = languages.filter((l) => l.country_id === countryId);
  const selectedDocs = useMemo(() => {
    if (!country || !selectedLang) return [];
    return docs.filter((doc) => doc.country_slug === country.slug && localeFromKey(doc.content_key) === selectedLang.code)
      .sort((a, b) => String(a.title || a.slug).localeCompare(String(b.title || b.slug)));
  }, [docs, country, selectedLang]);
  const localizedBestFors = selectedDocs.filter((doc) => doc.content_type === 'localized-best-for');
  const globalBestForOwners = useMemo(
    () => contentDocs
      .filter((doc) => doc.content_type === 'global-best-for' && doc.slug)
      .sort((a, b) => String(a.title || a.slug).localeCompare(String(b.title || b.slug))),
    [contentDocs],
  );

  const addLanguage = async (e: FormEvent) => {
    e.preventDefault();
    if (!countryId || !name || !nativeName || !code || !locale) return;
    setSaving(true);
    try {
      await mutate('/api/country-languages', 'POST', { country_id: countryId, name, native_name: nativeName, code, locale, url_prefix: prefix || code }, `${nativeName} localization created`);
      setName(''); setNativeName(''); setCode(''); setLocale(''); setPrefix('');
    } finally { setSaving(false); }
  };

  const addTopic = async (ownerSlug: string) => {
    if (!selectedLang || !country) return;
    const owner = globalBestForOwners.find((doc) => doc.slug === ownerSlug);
    if (!owner) return;

    const canonicalOwnerSlug = String(owner.slug || '').trim();
    if (!canonicalOwnerSlug) return;

    const templateKeyBySlug: Record<string, string> = {
      'forex-brokers-for-beginners': 'beginners',
      'mt4-forex-brokers': 'mt4',
      'mt5-forex-brokers': 'mt5',
      'gold-forex-brokers': 'gold',
      'low-spread-forex-brokers': 'low-spread',
    };
    const templateKey = templateKeyBySlug[canonicalOwnerSlug] ?? canonicalOwnerSlug;
    const template = getLanguageTopicTemplate(selectedLang.code, templateKey, country.name);
    const slug = template.slug;
    const contentKey = `localized-best-for:${country.slug}:${selectedLang.code}:${slug}`;
    if (docs.some((doc) => doc.content_key === contentKey)) return;

    await mutate('/api/content-documents', 'POST', {
      content_key: contentKey,
      content_type: 'localized-best-for',
      country_slug: country.slug,
      topic_slug: owner.slug,
      slug,
      title: template.title,
      excerpt: template.description ?? '',
      html: (template.intro ?? []).map((p) => `<p>${String(p).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] || ch))}</p>`).join(''),
      blocks: [],
      settings: {
        locale: selectedLang.code,
        language_code: selectedLang.code,
        intent_slug: owner.slug,
        canonicalIntentSlug: owner.slug,
        source_best_for_id: owner.id,
      },
      published: false,
      indexable: false,
    }, `${template.title} created as a draft`);
  };

  const addableOwners = globalBestForOwners.filter(
    (owner) => !localizedBestFors.some(
      (doc) => String(doc.settings?.intent_slug || doc.topic_slug || '') === String(owner.slug),
    ),
  );
  return <div className="space-y-6">
    <div className="rounded-3xl border border-line bg-white p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country × Language</p><h2 className="mt-1 font-display text-xl font-bold text-ink-950">Localization Studio</h2><p className="mt-2 text-sm leading-6 text-slate-500">Localized guides and Best-For pages are canonical Content Studio documents. Best-For pages are created and edited here; legacy localized-seo pages are not used.</p></div><Globe2 className="text-emerald-600" size={22} /></div>
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
      {countryLanguages.map((language) => {
        const languageCountrySlug = countries.find((c) => c.id === language.country_id)?.slug;
        const languageDocs = docs.filter((doc) => doc.country_slug === languageCountrySlug && localeFromKey(doc.content_key) === language.code);
        const languageBestFors = languageDocs.filter((doc) => doc.content_type === 'localized-best-for');
        const open = selectedLanguage === language.id;
        return <div key={language.id} className={`rounded-2xl border bg-white p-5 ${open ? 'border-emerald-300' : 'border-line'}`}>
          <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="font-bold text-ink-950">{language.native_name} <span className="font-normal text-slate-400">({language.name})</span></p><p className="mt-1 text-xs text-slate-500">{language.country_name} · {language.locale} · /{language.url_prefix}/ · {language.active ? 'Active' : 'Inactive'}</p><p className="mt-1 text-xs font-semibold text-emerald-700">{languageBestFors.length} localized Best-For · {languageDocs.length} localized documents</p></div><button onClick={() => { setCountryId(language.country_id); setSelectedLanguage(open ? null : language.id); }} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">{open ? 'Hide pages' : 'Manage pages'}</button><button onClick={() => mutate('/api/country-languages', 'PUT', { id: language.id, active: !language.active }, language.active ? 'Language disabled' : 'Language enabled')} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">{language.active ? 'Disable' : 'Enable'}</button></div>
          {open && <div className="mt-5 space-y-4 border-t border-line pt-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-ink-950">Localized Best-For pages</p><p className="text-xs text-slate-500">{localizedBestFors.length} existing pages for {language.native_name}.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">Canonical content_documents</span></div></div>
            {selectedDocs.filter((doc) => doc.content_type === 'localized-best-for').map((doc) => <LocalizedDocumentRow key={doc.id} doc={doc} mutate={mutate} countrySlug={languageCountrySlug || ''} languagePrefix={language.url_prefix || language.code} />)}
            {localizedBestFors.length === 0 && <p className="rounded-xl border border-dashed border-line bg-paper p-4 text-sm text-slate-500">No localized Best-For pages exist for this language yet. Add one below.</p>}
            {addableOwners.length > 0 && <div className="rounded-xl border border-dashed border-line bg-paper p-4"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Add localized Best-For</p><p className="mt-1 text-xs text-slate-500">Select the canonical global Best-For owner. The localized URL and title can be translated, but the country × intent ranking stays tied to the canonical owner.</p><div className="mt-3 flex flex-wrap gap-2">{addableOwners.map((owner) => <button key={owner.id} type="button" onClick={() => owner.slug && addTopic(owner.slug)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-emerald-400">+ {owner.title || owner.slug}</button>)}</div></div>}
          </div>}
        </div>;
      })}
    </div>
  </div>;
}

function LocalizedDocumentRow({ doc, mutate, countrySlug, languagePrefix }: { doc: ContentDocument; mutate: Mutate; countrySlug: string; languagePrefix: string }) {
  const [title, setTitle] = useState(doc.title || '');
  const [seoTitle, setSeoTitle] = useState(doc.seo_title || '');
  const [seoDescription, setSeoDescription] = useState(doc.seo_description || '');
  const [blocks, setBlocks] = useState<PageBlock[]>(() => {
    if (Array.isArray(doc.blocks) && doc.blocks.length) return doc.blocks as PageBlock[];
    return doc.html ? [{ type: 'richtext', html: doc.html } as PageBlock] : [];
  });
  const [published, setPublished] = useState(Boolean(doc.published));
  const [indexable, setIndexable] = useState(Boolean(doc.indexable));
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await mutate('/api/content-documents', 'PUT', { id: doc.id, title, seo_title: seoTitle || null, seo_description: seoDescription || null, blocks, html: blocksToHtml(blocks), published, indexable }, `${title || doc.slug} saved`);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${doc.title || doc.slug}?`)) return;
    await mutate('/api/content-documents', 'DELETE', { id: doc.id }, `${doc.title || doc.slug} deleted`);
  };

  const previewPath = `/${countrySlug}/${languagePrefix}/${doc.slug}?preview=1`;

  return <div className="rounded-xl border border-line bg-paper p-4">
    <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="font-semibold text-ink-950">{doc.title || doc.slug}</p><p className="text-xs text-slate-500">{doc.slug} · Canonical intent: {String(doc.settings?.intent_slug || doc.topic_slug || '—')} · {previewPath} · {doc.published ? 'Published' : 'Draft'}{doc.indexable ? ' · Indexable' : ' · Noindex'}</p></div><a href={previewPath} target="_blank" rel="noreferrer" className="rounded-lg border border-line bg-white p-2 text-slate-500 hover:bg-paper" title="Preview localized Best-For"><Eye size={14} /></a><button type="button" onClick={() => setExpanded(!expanded)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold">{expanded ? 'Close' : 'Edit'}</button><button type="button" onClick={remove} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"><Trash2 size={14} /> Delete</button></div>
    {expanded && <div className="mt-4 space-y-3"><input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm" placeholder="Title" /><input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm" placeholder="SEO title" /><textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className="min-h-20 w-full rounded-lg border border-line bg-white p-3 text-sm" placeholder="SEO description" /><PageBuilder value={blocks} onChange={setBlocks} /><div className="flex flex-wrap items-center gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published</label><label className="flex items-center gap-2"><input type="checkbox" checked={indexable} onChange={(e) => setIndexable(e.target.checked)} /> Indexable</label></div><div className="flex gap-2"><button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-ink-950 px-4 py-2 text-xs font-bold text-white"><Save size={14} /> {saving ? 'Saving…' : 'Save'}</button><button type="button" onClick={remove} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700"><Trash2 size={14} /> Delete</button></div></div>}
  </div>;
}

export default LocalizationManager;
