import { Eye, Pencil, Plus } from 'lucide-react';
import type { ContentDocument } from '../../lib/types';

export default function GlobalHub({
  guides,
  bestForPages,
  onNewGuide,
  onEditGuide,
  onNewBestFor,
  onEditBestFor,
}: {
  guides: ContentDocument[];
  bestForPages: ContentDocument[];
  onNewGuide: () => void;
  onEditGuide: (g: ContentDocument) => void;
  onNewBestFor: () => void;
  onEditBestFor: (page: ContentDocument) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">Guides ({guides.length})</p>
          <button onClick={onNewGuide} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"><Plus size={13} /> New guide</button>
        </div>
        <div className="divide-y divide-line">
          {guides.map(g => <div key={g.id} className="flex items-center gap-3 px-5 py-3.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{g.title}</p><p className="truncate text-xs text-slate-400">/guides/{g.slug}{g.published ? ' · Published' : ' · Draft'}</p></div>{g.slug && <a href={`/guides/${g.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Preview live page"><Eye size={14} /></a>}<button onClick={() => onEditGuide(g)} className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Edit guide"><Pencil size={14} /></button></div>)}
          {!guides.length && <p className="p-5 text-sm text-slate-400">No guides yet.</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-display text-base font-bold text-ink-900">Best-For pages ({bestForPages.length})</p>
          <button onClick={onNewBestFor} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"><Plus size={13} /> New page</button>
        </div>
        <div className="divide-y divide-line">
          {bestForPages.map(page => <div key={page.id} className="flex items-center gap-3 px-5 py-3.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{page.title || page.content_key}</p><p className="text-xs text-slate-400">/{page.slug || page.content_key.replace(/^best-for:/, '')}{page.published ? ' · Published' : ' · Draft'}</p></div>{page.slug && <a href={`/${page.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Preview live page"><Eye size={14} /></a>}<button onClick={() => onEditBestFor(page)} className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Edit page"><Pencil size={14} /></button></div>)}
          {!bestForPages.length && <p className="p-5 text-sm text-slate-400">No canonical best-for documents yet.</p>}
        </div>
      </div>
    </div>
  );
}
