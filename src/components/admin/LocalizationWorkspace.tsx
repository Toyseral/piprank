import { useState } from 'react';
import { BookOpen, Languages, ListChecks } from 'lucide-react';
import type { ContentDocument, CountryLanguage, CountryPage, LocalizedSeoPage } from '../../lib/types';
import LocalizationManager from './LocalizationManager';
import LocalizedGuidesManager from './LocalizedGuidesManager';

type Mutate = (path: string, method: string, body: unknown, msg: string) => Promise<void>;

export default function LocalizationWorkspace({ countries, languages, pages, contentDocs, mutate, accessToken }: {
  countries: CountryPage[];
  languages: CountryLanguage[];
  pages: LocalizedSeoPage[];
  contentDocs: ContentDocument[];
  mutate: Mutate;
  accessToken: string;
}) {
  const [section, setSection] = useState<'guides' | 'best-for'>('guides');
  return <div className="space-y-6">
    <div className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Localization</p><h1 className="mt-1 font-display text-2xl font-bold text-ink-950">Local content</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Create and manage translated guides and country Best-For pages without changing the existing Country Hub or Global Hub workflows.</p></div>
        <Languages className="hidden text-emerald-600 sm:block" size={28}/>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-paper p-1.5">
        <button onClick={() => setSection('guides')} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${section === 'guides' ? 'bg-white text-ink-950 shadow-sm' : 'text-slate-500 hover:text-ink-950'}`}><BookOpen size={15}/> Local Guides</button>
        <button onClick={() => setSection('best-for')} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${section === 'best-for' ? 'bg-white text-ink-950 shadow-sm' : 'text-slate-500 hover:text-ink-950'}`}><ListChecks size={15}/> Local Best-For</button>
      </div>
    </div>
    {section === 'guides' ? <LocalizedGuidesManager countries={countries} languages={languages} contentDocs={contentDocs} mutate={mutate} accessToken={accessToken}/> : <LocalizationManager countries={countries} languages={languages} pages={pages} mutate={mutate} accessToken={accessToken}/>} 
  </div>;
}
