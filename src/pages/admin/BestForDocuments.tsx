import { Eye, Pencil, Plus } from 'lucide-react';
import type { ContentDocument } from '../../lib/types';
import { BEST_FOR_CANONICAL } from '../../lib/seo';

type Props = {
  documents: ContentDocument[];
  countrySlug?: string;
  onNew: (countrySlug?: string) => void;
  onEdit: (document: ContentDocument) => void;
};

const GLOBAL = Object.values(BEST_FOR_CANONICAL);

export default function BestForDocuments({ documents, countrySlug, onNew, onEdit }: Props) {
  const expected = countrySlug ? GLOBAL.map((slug) => `country-best-for:${countrySlug}:${slug}`) : GLOBAL.map((slug) => `best-for:${slug}`);
  const rows = documents.filter((d) => d.content_type === (countrySlug ? 'country-best-for' : 'global-best-for') && (countrySlug ? d.country_slug === countrySlug : !d.country_slug));
  const missing = expected.filter((key) => !rows.some((d) => d.content_key === key));
  return <section className="rounded-2xl border border-line bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
      <div><h2 className="font-display text-lg font-bold text-ink-900">{countrySlug ? `Best-For — ${countrySlug}` : 'Global Best-For'}</h2><p className="mt-1 text-xs text-slate-500">Canonical content documents. Ranking data remains in the existing Best-For system.</p></div>
      <button onClick={() => onNew(countrySlug)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white"><Plus size={13}/> New page</button>
    </div>
    {missing.length > 0 && <p className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{missing.length} canonical category document{missing.length === 1 ? '' : 's'} are missing. Create one only after the ranking/content data is ready.</p>}
    <div className="divide-y divide-line">{rows.map((d) => <div key={d.id} className="flex items-center gap-3 px-5 py-3.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{d.title || d.slug}</p><p className="truncate text-xs text-slate-400">{countrySlug ? `/${countrySlug}/${d.slug}` : `/${d.slug}`} · {d.published ? 'Published' : 'Draft'} · {d.indexable ? 'Indexable' : 'Noindex'}</p></div><a href={countrySlug ? `/${countrySlug}/${d.slug}` : `/${d.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Preview"><Eye size={14}/></a><button onClick={() => onEdit(d)} className="rounded-lg p-2 text-slate-400 hover:bg-paper" title="Edit"><Pencil size={14}/></button></div>)}{!rows.length && <p className="p-5 text-sm text-slate-400">No canonical Best-For documents yet.</p>}</div>
  </section>;
}
