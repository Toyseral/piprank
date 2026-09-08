import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus } from 'lucide-react';
import type { ContentDocument, CountryLanguage, CountryPage } from '../../lib/types';
import GuideEditor from './GuideEditor';

type Mutate = (path: string, method: string, body: unknown, msg: string) => Promise<void>;
type GuideDraft = ContentDocument & { id: 0 };

export default function LocalizedGuidesManager({ countries, languages, contentDocs, mutate, accessToken }: {
  countries: CountryPage[];
  languages: CountryLanguage[];
  contentDocs: ContentDocument[];
  mutate: Mutate;
  accessToken: string;
}) {
  const [countryId, setCountryId] = useState<number>(countries[0]?.id ?? 0);
  const country = countries.find(c => c.id === countryId) ?? countries[0];
  const countryLanguages = languages.filter(l => l.country_id === country?.id);
  const [languageId, setLanguageId] = useState<number>(countryLanguages[0]?.id ?? 0);
  const effectiveLanguageId = countryLanguages.some(l => l.id === languageId) ? languageId : (countryLanguages[0]?.id ?? 0);
  const language = countryLanguages.find(l => l.id === effectiveLanguageId);
  const guides = useMemo(() => contentDocs.filter(d => d.content_type === 'localized-guide' && d.country_slug === country?.slug && String(d.settings?.languageCode || '').toLowerCase() === String(language?.code || '').toLowerCase()), [contentDocs, country?.slug, language?.code]);
  const [editing, setEditing] = useState<ContentDocument | GuideDraft | null>(null);

  const blank = (): GuideDraft => ({
    id: 0,
    content_key: '', content_type: 'localized-guide', country_slug: country?.slug || null, topic_slug: null, slug: '',
    title: '', excerpt: '', html: '', blocks: [], seo_title: '', seo_description: '', indexable: false, published: false,
    settings: { languageCode: language?.code || '' }, updated_by: null, created_at: '', updated_at: ''
  });

  const save = async (fields: Record<string, unknown>, isNew: boolean) => {
    const settings = (fields.settings || {}) as Record<string, unknown>;
    await mutate('/api/content-documents', isNew ? 'POST' : 'PUT', {
      ...fields,
      ...(isNew ? {} : { id: editing?.id }),
      content_type: 'localized-guide',
      country_slug: country?.slug || null,
      topic_slug: null,
      content_key: fields.content_key,
      settings: { ...settings, languageCode: language?.code || '', languagePrefix: language?.url_prefix || '' },
    }, isNew ? 'Localized guide created' : 'Localized guide saved');
    setEditing(null);
  };

  return <div className="space-y-5">
    <div className="grid gap-3 md:grid-cols-2">
      <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Country</span><select value={country?.id || 0} onChange={e => { setCountryId(Number(e.target.value)); setLanguageId(0); }} className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm">{countries.map(c => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}</select></label>
      <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Language</span><select value={effectiveLanguageId} onChange={e => setLanguageId(Number(e.target.value))} className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm" disabled={!countryLanguages.length}>{countryLanguages.map(l => <option key={l.id} value={l.id}>{l.native_name} ({l.code})</option>)}</select></label>
    </div>

    {!language ? <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">Add a language for this country first.</div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold text-ink-950">Local Guides</h3><p className="mt-1 text-xs text-slate-500">Editorial guides for {country?.name}, written for {language.native_name}.</p></div><button type="button" onClick={() => setEditing(blank())} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white"><Plus size={14}/> New guide</button></div>
      <div className="space-y-2">{guides.map(doc => <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-950">{doc.title || doc.slug}</p><p className="mt-0.5 text-[11px] text-slate-400">{doc.slug || 'No slug'} · {doc.published ? 'Published' : 'Draft'} · {doc.indexable ? 'Indexable' : 'Noindex'}</p></div>{doc.slug && <a href={`/${country?.slug}/${language.url_prefix}/guides/${doc.slug}?preview=1`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Preview"><Eye size={14}/></a>}<button onClick={() => setEditing({ ...doc, blocks: Array.isArray(doc.blocks) ? doc.blocks : [] })} className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Edit"><Pencil size={14}/></button></div>)}{!guides.length && <div className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-slate-500">No localized guides yet for this language.</div>}</div>
    </>}

    {editing && <GuideEditor document={editing} context="localized" countries={countries} token={accessToken} countrySlug={country?.slug || ''} languageCode={language?.code || ''} languagePrefix={language?.url_prefix || ''} onClose={() => setEditing(null)} onSave={save} />}
  </div>;
}
