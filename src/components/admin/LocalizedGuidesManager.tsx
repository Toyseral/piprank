import { useMemo, useState } from 'react';
import { Eye, Loader2, Pencil, Plus, Save, X } from 'lucide-react';
import PageBuilder, { blocksToHtml, type PageBlock } from '../PageBuilder';
import type { ContentDocument, CountryLanguage, CountryPage } from '../../lib/types';

type Mutate = (path: string, method: string, body: unknown, msg: string) => Promise<void>;
type GuideDraft = Omit<ContentDocument, 'id' | 'updated_by' | 'created_at' | 'updated_at'>;

export default function LocalizedGuidesManager({ countries, languages, contentDocs, mutate, accessToken }: {
  countries: CountryPage[];
  languages: CountryLanguage[];
  contentDocs: ContentDocument[];
  mutate: Mutate;
  accessToken: string;
}) {
  const [countryId, setCountryId] = useState<number>(countries[0]?.id ?? 0);
  const country = countries.find((c) => c.id === countryId) ?? countries[0];
  const countryLanguages = languages.filter((l) => l.country_id === country?.id);
  const [languageId, setLanguageId] = useState<number>(countryLanguages[0]?.id ?? 0);
  const effectiveLanguageId = countryLanguages.some((l) => l.id === languageId) ? languageId : (countryLanguages[0]?.id ?? 0);
  const language = countryLanguages.find((l) => l.id === effectiveLanguageId);
  const guides = useMemo(() => contentDocs.filter((d) => d.content_type === 'localized-guide' && d.country_slug === country?.slug && String(d.settings?.languageCode || '').toLowerCase() === String(language?.code || '').toLowerCase()), [contentDocs, country?.slug, language?.code]);
  const [editing, setEditing] = useState<ContentDocument | GuideDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const blank = (): GuideDraft => ({
    content_key: `localized-guide:${country?.slug || ''}:${language?.code || ''}:new-guide`,
    content_type: 'localized-guide', country_slug: country?.slug || null, topic_slug: null, slug: '',
    title: '', excerpt: '', html: '', blocks: [], seo_title: '', seo_description: '', indexable: false, published: false,
    settings: { languageCode: language?.code || '' },
  });

  const save = async (doc: ContentDocument | GuideDraft) => {
    setSaving(true);
    try {
      const blocks = (doc.blocks || []) as PageBlock[];
      const slug = doc.slug || doc.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const id = 'id' in doc ? doc.id : undefined;
      await mutate('/api/content-documents', id ? 'PUT' : 'POST', {
        ...(id ? { id } : {}),
        content_key: `localized-guide:${country?.slug}:${language?.code}:${slug}`,
        content_type: 'localized-guide', country_slug: country?.slug, topic_slug: null, slug,
        title: doc.title, excerpt: doc.excerpt, html: blocksToHtml(blocks), blocks,
        seo_title: doc.seo_title || doc.title, seo_description: doc.seo_description || doc.excerpt,
        indexable: doc.indexable, published: doc.published,
        settings: { ...(doc.settings || {}), languageCode: language?.code || '' },
      }, id ? 'Localized guide saved' : 'Localized guide created');
      setEditing(null); setCreating(false);
    } finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <div className="grid gap-3 md:grid-cols-2">
      <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Country</span><select value={country?.id || 0} onChange={(e) => { setCountryId(Number(e.target.value)); setLanguageId(0); }} className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm">{countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}</select></label>
      <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Language</span><select value={effectiveLanguageId} onChange={(e) => setLanguageId(Number(e.target.value))} className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm" disabled={!countryLanguages.length}>{countryLanguages.map((l) => <option key={l.id} value={l.id}>{l.native_name} ({l.code})</option>)}</select></label>
    </div>

    {!language ? <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">Add a language for this country first.</div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-display text-lg font-bold text-ink-950">Local Guides</h3><p className="mt-1 text-xs text-slate-500">Editorial guides for {country?.name}, written for {language.native_name}.</p></div>
        <button type="button" onClick={() => { setEditing(blank()); setCreating(true); }} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white"><Plus size={14}/> New guide</button>
      </div>
      <div className="space-y-2">
        {guides.map((doc) => <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-950">{doc.title || doc.slug}</p><p className="mt-0.5 text-[11px] text-slate-400">{doc.slug || 'No slug'} · {doc.published ? 'Published' : 'Draft'} · {doc.indexable ? 'Indexable' : 'Noindex'}</p></div>{doc.slug && <a href={`/${country?.slug}/${language.url_prefix}/guides/${doc.slug}?preview=1`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Preview"><Eye size={14}/></a>}<button onClick={() => setEditing({ ...doc, blocks: Array.isArray(doc.blocks) ? doc.blocks : [] })} className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Edit"><Pencil size={14}/></button></div>)}
        {!guides.length && <div className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-slate-500">No localized guides yet for this language.</div>}
      </div>
    </>}

    {editing && <LocalizedGuideEditor doc={editing} creating={creating} saving={saving} onChange={setEditing} onSave={() => save(editing)} onClose={() => { setEditing(null); setCreating(false); }} />}
  </div>;
}

function LocalizedGuideEditor({ doc, creating, saving, onChange, onSave, onClose }: { doc: ContentDocument | GuideDraft; creating: boolean; saving: boolean; onChange: (doc: ContentDocument | GuideDraft) => void; onSave: () => void; onClose: () => void }) {
  const blocks = (doc.blocks || []) as PageBlock[];
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-950/50 p-4 sm:p-8"><div className="mx-auto max-w-5xl rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-7"><div><h3 className="font-display text-lg font-bold text-ink-950">{creating ? 'New localized guide' : 'Edit localized guide'}</h3><p className="text-xs text-slate-500">Same title, SEO and visual block workflow as the editorial guide system.</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-paper"><X size={18}/></button></div><div className="space-y-5 p-5 sm:p-7">
    <div className="grid gap-3 md:grid-cols-2"><input value={doc.title} onChange={(e) => onChange({ ...doc, title: e.target.value })} placeholder="Guide title" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"/><input value={doc.slug || ''} onChange={(e) => onChange({ ...doc, slug: e.target.value })} placeholder="guide-slug" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"/></div>
    <textarea value={doc.excerpt} onChange={(e) => onChange({ ...doc, excerpt: e.target.value })} placeholder="Short excerpt / introduction" rows={3} className="w-full rounded-xl border border-line bg-paper p-3 text-sm"/>
    <div className="grid gap-3 md:grid-cols-2"><input value={doc.seo_title || ''} onChange={(e) => onChange({ ...doc, seo_title: e.target.value })} placeholder="SEO title" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"/><input value={doc.seo_description || ''} onChange={(e) => onChange({ ...doc, seo_description: e.target.value })} placeholder="Meta description" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm"/></div>
    <PageBuilder value={blocks} onChange={(next) => onChange({ ...doc, blocks: next })} />
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4"><div className="flex gap-4 text-xs font-semibold text-slate-600"><label className="flex items-center gap-2"><input type="checkbox" checked={doc.indexable} onChange={(e) => onChange({ ...doc, indexable: e.target.checked })}/> Indexable</label><label className="flex items-center gap-2"><input type="checkbox" checked={doc.published} onChange={(e) => onChange({ ...doc, published: e.target.checked })}/> Published</label></div><button onClick={onSave} disabled={saving || !doc.title.trim()} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save guide</button></div>
  </div></div></div>;
}
