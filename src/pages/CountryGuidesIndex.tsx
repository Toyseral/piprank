import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { ContentDocument, CountryPage } from '../lib/types';
import { fetchCountry } from '../lib/api';
import { fetchPublishedContentDocuments } from '../lib/canonicalContent';
import { useSEO } from '../hooks/useSEO';
import NotFound from './NotFound';

export default function CountryGuidesIndex() {
  const { countrySlug = '' } = useParams<{ countrySlug: string }>();
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [guides, setGuides] = useState<ContentDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchCountry(countrySlug),
      fetchPublishedContentDocuments({ type: 'country-guide', country: countrySlug }),
    ]).then(([c, docs]) => {
      setCountry(c);
      setGuides(docs.filter((doc) => doc.content_type === 'country-guide'));
    }).catch(() => {
      setCountry(null);
      setGuides([]);
    }).finally(() => setLoading(false));
  }, [countrySlug]);

  useSEO(country ? {
    title: `${country.name} Forex Broker Guides | PipRank`,
    description: `Country-specific forex broker guides for traders in ${country.name}, including broker selection, regulation, costs and trading considerations.`,
    path: `/${country.slug}/guides`,
    type: 'website',
  } : null);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-24 text-center text-sm text-slate-500">Loading guides…</div>;
  if (!country) return <NotFound />;

  return (
    <main className="bg-paper">
      <section className="border-b border-line bg-ink-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-18">
          <Link to={`/${country.slug}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-white"><ArrowLeft size={13}/> Back to {country.name}</Link>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{country.flag} {country.name} forex guides</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold tracking-tight sm:text-5xl">Forex broker guides for {country.name}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Practical, country-specific guides to help traders in {country.name} understand broker availability, regulation, costs and the factors that affect their choice.</p>
        </div>
      </section>
      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          {guides.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {guides.map((doc) => (
                <Link key={doc.content_key} to={`/${country.slug}/guides/${doc.slug}`} className="group rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-soft">
                  <BookOpen size={18} className="text-emerald-700"/>
                  <h2 className="mt-4 font-display text-xl font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h2>
                  {doc.excerpt && <p className="mt-2 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Read guide <ArrowRight size={13}/></span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center">
              <p className="font-display text-xl font-bold text-ink-950">Country guides are being prepared.</p>
              <p className="mt-2 text-sm text-slate-500">Return to the {country.name} broker hub for rankings and broker reviews.</p>
              <Link to={`/${country.slug}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white">Back to {country.name} <ArrowRight size={14}/></Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
