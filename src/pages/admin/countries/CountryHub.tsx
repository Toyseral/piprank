import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Search } from 'lucide-react';
import type { Broker, ContentDocument, CountryBestFor, CountryPage } from '../../../lib/types';
import CountryGuides from '../CountryGuides';

function HubMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink-900">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}

function EntityPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-xs font-medium text-slate-600">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Country Workspace owns the country hub and country guides.
 * Country Best-For pages are canonical content documents of their own; they
 * are listed here only as country-level links/references and are edited with
 * the same ContentDocumentEditor used by the Global Hub.
 */
function CountryHub({
  countries,
  brokers,
  countryBestFors: _countryBestFors,
  contentDocs,
  token,
  notify,
  onNewCountry,
  onEditCountry,
  onEditCountryBestFor: _onEditCountryBestFor,
  onNewCountryBestFor: _onNewCountryBestFor,
  onNewContentDoc,
  onEditContentDoc,
}: {
  countries: CountryPage[];
  brokers: Broker[];
  countryBestFors?: CountryBestFor[];
  contentDocs: ContentDocument[];
  token: string;
  notify: (msg: string) => void;
  onNewCountry: () => void;
  onEditCountry: (country: CountryPage) => void;
  onEditCountryBestFor?: (page: CountryBestFor) => void;
  onNewCountryBestFor?: (countrySlug: string) => void;
  onNewContentDoc?: (doc?: ContentDocument) => void;
  onEditContentDoc?: (doc: ContentDocument) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(() => countries[0]?.slug ?? '');
  useEffect(() => { if (!selectedSlug && countries[0]) setSelectedSlug(countries[0].slug); }, [countries, selectedSlug]);
  const filtered = countries.filter((country) => `${country.name} ${country.slug}`.toLowerCase().includes(query.toLowerCase()));
  const selected = countries.find((country) => country.slug === selectedSlug) ?? filtered[0] ?? countries[0];
  const guides = selected
    ? contentDocs.filter((doc) => doc.content_type === 'country-guide' && doc.country_slug === selected.slug)
    : [];
  const bestForPages = useMemo(() => selected
    ? contentDocs.filter((doc) => doc.content_type === 'country-best-for' && doc.country_slug === selected.slug)
    : [], [contentDocs, selected]);
  const publishedState = String((selected as any)?.publishing_state ?? ((selected as any)?.status ?? 'published'));

  const createBestFor = () => {
    if (!selected || !onNewContentDoc) return;
    onNewContentDoc(undefined);
    // The country context is carried by the hub selection. The editor creates
    // the canonical key/type from this selection in the parent handler.
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900">Countries</h2>
          <button onClick={onNewCountry} className="rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-bold text-white"><Plus size={13} className="inline"/> New</button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-paper px-3">
          <Search size={14} className="text-slate-400"/>
          <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search countries…" className="h-10 flex-1 bg-transparent text-sm outline-none"/>
        </div>
        <div className="mt-3 max-h-[560px] space-y-1 overflow-auto">
          {filtered.map((country)=><button key={country.id} onClick={()=>setSelectedSlug(country.slug)} className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${selected?.id===country.id?'bg-emerald-50 text-emerald-800':'hover:bg-paper'}`}>
            <span className="font-bold">{country.flag} {country.name}</span>
            <span className="block text-xs text-slate-400">/{country.slug}</span>
          </button>)}
        </div>
      </section>

      {selected&&<section className="space-y-5">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country Workspace</p>
              <h2 className="font-display text-2xl font-bold text-ink-900">{selected.flag} {selected.name}</h2>
              <p className="mt-1 text-sm text-slate-500">Manage the country hub, canonical guides and country-specific Best-For pages.</p>
            </div>
            <button onClick={()=>onEditCountry(selected)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white"><Pencil size={14}/> Edit country hub</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <HubMetric label="Publishing" value={publishedState} sub="draft · published · closed"/>
            <HubMetric label="Guides" value={String(guides.length)} sub="canonical country guides"/>
            <HubMetric label="Best-For" value={String(bestForPages.length)} sub="canonical country pages"/>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <EntityPanel title="SEO QA" items={[
            selected.seo_title?'SEO title present':'Missing SEO title',
            selected.seo_description?'Meta description present':'Missing meta description',
            (selected.seo_intro?.length||0)>0?'Intro present':'Missing SEO intro',
            (selected.seo_sections?.length||0)>0?'Structured sections present':'Missing sections',
            (selected.seo_faqs?.length||0)>0?'FAQs present':'Missing FAQs'
          ]}/>
          <EntityPanel title="Broker coverage" items={[
            `${selected.recommended.length} recommended brokers`,
            `${selected.unavailable.length} unavailable broker flags`,
            `${brokers.length} brokers in database`,
            'Use Broker Workspace for searchable eligibility states'
          ]}/>
        </div>

        <div className="rounded-2xl border border-line bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="font-display text-base font-bold text-ink-900">Country Best-For ({bestForPages.length})</p>
              <p className="mt-0.5 text-xs text-slate-400">Canonical pages owned by content_documents; intents remain ranking/config data.</p>
            </div>
            <button onClick={createBestFor} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white"><Plus size={13}/> New page</button>
          </div>
          <div className="divide-y divide-line">
            {bestForPages.map((page) => <div key={page.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">{page.title || page.content_key}</p>
                <p className="truncate text-xs text-slate-400">/{selected.slug}/{page.slug || page.content_key.replace(`country-best-for:${selected.slug}:`, '')}{page.published ? ' · Published' : ' · Draft'}</p>
              </div>
              {page.slug && <a href={`/${selected.slug}/${page.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Preview live page"><Eye size={14}/></a>}
              {onEditContentDoc && <button onClick={() => onEditContentDoc(page)} className="rounded-lg p-2 text-slate-400 hover:bg-paper hover:text-ink-900" title="Edit canonical page"><Pencil size={14}/></button>}
            </div>)}
            {!bestForPages.length && <p className="p-5 text-sm text-slate-400">No canonical country Best-For documents yet.</p>}
          </div>
        </div>

        <CountryGuides
          country={selected}
          countries={countries}
          brokers={brokers}
          token={token}
          notify={notify}
        />
      </section>}
    </div>
  );
}

export default CountryHub;
