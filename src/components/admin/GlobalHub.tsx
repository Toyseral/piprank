import { FileText, Globe2 } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage } from '../../lib/types';
import PageManager from '../PageManager';

type Props = {
  countries: CountryPage[];
  brokers: Broker[];
  contentDocs: ContentDocument[];
  token: string;
  onSave: (fields: Record<string, unknown>, isNew: boolean) => Promise<void>;
  onDelete: (doc: ContentDocument) => void;
};

/**
 * Global editorial hub. This deliberately lives inside the existing Admin
 * architecture and reuses PageManager/PageBuilder; there is no /content route.
 */
export default function GlobalHub({ countries, brokers, contentDocs, token, onSave, onDelete }: Props) {
  const globalDocs = contentDocs.filter((doc) => !doc.country_slug && doc.content_type !== 'author');

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Globe2 size={20} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Global content</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink-950">SEO & guides</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Manage global editorial pages from the same CMS and visual PageBuilder used elsewhere in the admin.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5"><FileText size={13}/> {globalDocs.length} global documents</span>
          <span className="rounded-full bg-paper px-3 py-1.5">Visual editor</span>
        </div>
      </div>
      <PageManager
        countries={countries}
        brokers={brokers}
        contentDocs={globalDocs}
        token={token}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
