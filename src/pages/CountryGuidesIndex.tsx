import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Globe2, Target } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { ContentDocument, CountryPage } from '../lib/types';
import { fetchCountry } from '../lib/api';
import { fetchPublishedContentDocuments } from '../lib/canonicalContent';
import { useSEO } from '../hooks/useSEO';
import NotFound from './NotFound';

function localeOf(doc: ContentDocument) {
  return String(doc.settings?.locale || doc.settings?.language || doc.settings?.languageCode || '').trim().toLowerCase();
}

function localizedPath(doc: ContentDocument, countrySlug: string) {
  const locale = localeOf(doc);
  if (doc.content_type === 'localized-guide' && locale) return `/${countrySlug}/${locale}/guides/${doc.slug}`;
  if (doc.content_type === 'localized-best-for' && locale) return `/${countrySlug}/${locale}/${doc.slug}`;
  return `/${countrySlug}/guides`;
}

function localeLabel(locale: string) {
  const labels: Record<string, string> = {
    vi: 'Tiếng Việt',
    pt: 'Português',
    pt-br: 'Português (Brasil)',
    id: 'Bahasa Indonesia',
    th: 'ภาษาไทย',
    es: 'Español',
    de: 'Deutsch',
    fr: 'Français',
    tr: 'Türkçe',
    hi: 'हिन्दी',
    ur: 'اردو',
    ar: 'العربية',
  };
  return labels[locale] || locale.toUpperCase();
}

function BestForCard({ doc, countrySlug }: { doc: ContentDocument; countrySlug: string }) {
  return (
    <Link
      to={`/${countrySlug}/${doc.slug}`}
      className="group rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-soft"
    >
      <Target size={18} className="text-emerald-700" />
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Best for</p>
      <h3 className="mt-2 font-display text-xl font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h3>
      {doc.excerpt && <p className="mt-2 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}
      <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
        Explore broker picks <ArrowRight size={13} />
      </span>
    </Link>
  );
}

function GuideCard({ doc, countrySlug }: { doc: ContentDocument; countrySlug: string }) {
  return (
    <Link
      to={`/${countrySlug}/guides/${doc.slug}`}
      className="group rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-soft"
    >
      <BookOpen size={18} className="text-emerald-700" />
      <h3 className="mt-4 font-display text-xl font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h3>
      {doc.excerpt && <p className="mt-2 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}
      <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
        Read guide <ArrowRight size={13} />
      </span>
    </Link>
  );
}

function LocalizedGuideCard({ doc, countrySlug }: { doc: ContentDocument; countrySlug: string }) {
  return (
    <Link
      to={localizedPath(doc, countrySlug)}
      className="group rounded-2xl border border-line bg-paper p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-soft"
    >
      <div className="flex items-center gap-2 text-emerald-700">
        <Globe2 size={17} />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{localeLabel(localeOf(doc))}</span>
      </div>
      <h3 className="mt-3 font-display text-lg font-bold text-ink-950 group-hover:text-emerald-700">{doc.title}</h3>
      {doc.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{doc.excerpt}</p>}
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
        Read localized guide <ArrowRight size={13} />
      </span>
    </Link>
  );
}

export default function CountryGuidesIndex() {
  const { countrySlug = '' } = useParams<{ countrySlug: string }>();
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [guides, setGuides] = useState<ContentDocument[]>([]);
  const [bestFor, setBestFor] = useState<ContentDocument[]>([]);
  const [localizedGuides, setLocalizedGuides] = useState<ContentDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchCountry(countrySlug),
      fetchPublishedContentDocuments({ type: 'country-guide', country: countrySlug }),
      fetchPublishedContentDocuments({ type: 'country-best-for', country: countrySlug }),
      fetchPublishedContentDocuments({ type: 'localized-guide', country: countrySlug }),
    ]).then(([c, countryGuideDocs, bestForDocs, localizedGuideDocs]) => {
      setCountry(c);
      setGuides(countryGuideDocs.filter((doc) => doc.content_type === 'country-guide'));
      setBestFor(bestForDocs.filter((doc) => doc.content_type === 'country-best-for'));
      setLocalizedGuides(localizedGuideDocs.filter((doc) => doc.content_type === 'localized-guide'));
    }).catch(() => {
      setCountry(null);
      setGuides([]);
      setBestFor([]);
      setLocalizedGuides([]);
    }).finally(() => setLoading(false));
  }, [countrySlug]);

  const localizedGroups = useMemo(() => {
    const groups = new Map<string, ContentDocument[]>();
    for (const doc of localizedGuides) {
      const locale = localeOf(doc);
      if (!locale) continue;
      const group = groups.get(locale) || [];
      group.push(doc);
      groups.set(locale, group);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [localizedGuides]);

  const hasContent = guides.length > 0 || bestFor.length > 0 || localizedGuides.length > 0;

  useSEO(country ? {
    title: `${country.name} Forex Guides, Best Brokers & Trading Resources | PipRank`,
    description: `Explore forex broker guides, best-for broker picks and localized trading resources for traders in ${country.name}.`,
    path: `/${country.slug}/guides`,
    type: 'website',
  } : null);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-24 text-center text-sm text-slate-500">Loading country resources…</div>;
  if (!country) return <NotFound />;

  return (
    <main className="bg-paper">
      <section className="border-b border-line bg-ink-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-18">
          <Link to={`/${country.slug}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-white">
            <ArrowLeft size={13} /> Back to {country.name}
          </Link>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{country.flag} {country.name} forex resources</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Forex guides and broker picks for {country.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Practical, country-specific research, broker recommendations by trading goal, and localized resources to help traders in {country.name} make informed broker decisions.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="mb-10 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
            {guides.length > 0 && <a href="#guides" className="rounded-full border border-line bg-white px-3 py-2 hover:border-emerald-300 hover:text-emerald-700">Guides</a>}
            {bestFor.length > 0 && <a href="#best-for" className="rounded-full border border-line bg-white px-3 py-2 hover:border-emerald-300 hover:text-emerald-700">Best For</a>}
            {localizedGuides.length > 0 && <a href="#localized-guides" className="rounded-full border border-line bg-white px-3 py-2 hover:border-emerald-300 hover:text-emerald-700">Localized Guides</a>}
          </div>

          {guides.length > 0 && (
            <section id="guides" className="scroll-mt-20">
              <div className="flex items-end justify-between gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Country guides</p>
                  <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950">Forex guides for {country.name}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Country-specific guides covering broker selection, regulation, costs and practical trading considerations.</p>
                </div>
              </div>
              <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {guides.map((doc) => <GuideCard key={doc.content_key} doc={doc} countrySlug={country.slug} />)}
              </div>
            </section>
          )}

          {bestFor.length > 0 && (
            <section id="best-for" className="mt-16 scroll-mt-20 border-t border-line pt-14">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Choose by trading goal</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950">Best forex brokers in {country.name} by need</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Explore the canonical country Best-For pages for beginners, low spreads, MT5, gold, scalping, Islamic trading and other specific needs.</p>
              <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {bestFor.map((doc) => <BestForCard key={doc.content_key} doc={doc} countrySlug={country.slug} />)}
              </div>
            </section>
          )}

          {localizedGuides.length > 0 && (
            <section id="localized-guides" className="mt-16 scroll-mt-20 border-t border-line pt-14">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Localized content</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950">Forex guides in local languages</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">When localized guides exist, they are surfaced here while the individual localized pages remain the canonical content owners.</p>
              <div className="mt-8 space-y-10">
                {localizedGroups.map(([locale, docs]) => (
                  <div key={locale}>
                    <h3 className="font-display text-xl font-bold text-ink-950">{localeLabel(locale)}</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {docs.map((doc) => <LocalizedGuideCard key={doc.content_key} doc={doc} countrySlug={country.slug} />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!hasContent && (
            <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center">
              <p className="font-display text-xl font-bold text-ink-950">Country resources are being prepared.</p>
              <p className="mt-2 text-sm text-slate-500">Return to the {country.name} broker hub for rankings and broker reviews.</p>
              <Link to={`/${country.slug}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white">
                Back to {country.name} <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
