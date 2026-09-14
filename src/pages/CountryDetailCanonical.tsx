import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, ShieldCheck, Sparkles } from 'lucide-react';
import type { Broker, ContentDocument, CountryPage } from '../lib/types';
import { fetchBrokers, fetchCountry } from '../lib/api';
import BrokerCard from '../components/BrokerCard';
import Reveal from '../components/Reveal';
import Monogram from '../components/Monogram';
import { useSEO } from '../hooks/useSEO';
import { countrySeo, buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd } from '../lib/seo';
import { useGeo } from '../lib/GeoContext';
import NotFound from './NotFound';

async function fetchCanonicalDocuments(countrySlug: string, type: 'country-guide' | 'country-best-for') {
  const params = new URLSearchParams({ country: countrySlug, type });
  const response = await fetch(`/api/content-documents?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to load ${type} documents`);
  const data = await response.json().catch(() => []);
  return (Array.isArray(data) ? data : []).filter(
    (doc: ContentDocument) => doc.content_type === type && doc.country_slug === countrySlug && doc.published !== false,
  ) as ContentDocument[];
}

export default function CountryDetailCanonical() {
  const { slug = '' } = useParams<{ slug: string }>();
  const location = useLocation();
  const { setCountry: setGeoCountry } = useGeo();
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [guides, setGuides] = useState<ContentDocument[]>([]);
  const [bestFor, setBestFor] = useState<ContentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!slug) {
      setMissing(true);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setMissing(false);
    Promise.all([
      fetchCountry(slug),
      fetchBrokers(),
      fetchCanonicalDocuments(slug, 'country-guide'),
      fetchCanonicalDocuments(slug, 'country-best-for'),
    ])
      .then(([c, b, g, bf]) => {
        if (!active) return;
        setCountry(c);
        setGeoCountry(c.slug);
        setBrokers(b);
        setGuides(g);
        setBestFor(bf);
      })
      .catch(() => {
        if (active) setMissing(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug, setGeoCountry]);

  const ranked = useMemo(() => {
    if (!country) return [];
    const brokerMap = new Map(brokers.map((broker) => [broker.slug, broker]));
    return country.recommended
      .map((item) => ({ broker: brokerMap.get(item.slug), note: item.note }))
      .filter((item): item is { broker: Broker; note: string } => Boolean(item.broker));
  }, [country, brokers]);

  const seo = country
    ? countrySeo(country, `/${country.slug}`)
    : null;

  useSEO(
    missing
      ? { title: 'Country not found | PipRank', description: 'The requested country page does not exist.', path: location.pathname, noindex: true }
      : seo,
    country && seo
      ? [
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Countries', path: '/countries' },
            { name: country.name, path: `/${country.slug}` },
          ]),
          buildItemListJsonLd(
            `Recommended forex brokers in ${country.name}`,
            ranked.slice(0, 10).map(({ broker }) => ({ name: broker.name, path: `/brokers/${broker.slug}` })),
          ),
          buildFAQPageJsonLd([
            {
              question: `What are the best forex brokers in ${country.name}?`,
              answer: ranked.length ? `PipRank currently recommends ${ranked.slice(0, 3).map(({ broker }) => broker.name).join(', ')} based on the country recommendation data.` : `PipRank evaluates broker availability and trading features for ${country.name}.`,
            },
            {
              question: `Are all forex brokers available in ${country.name}?`,
              answer: `No. Broker availability varies by country and legal entity. Confirm current onboarding eligibility directly with the broker before depositing.`,
            },
          ]),
        ]
      : undefined,
  );

  if (missing) return <NotFound />;
  if (loading || !country) return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-52 animate-pulse rounded-3xl border border-line bg-white" /><div className="mt-8 h-64 animate-pulse rounded-3xl border border-line bg-white" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Link to="/" className="hover:text-ink-900">Home</Link><span>/</span>
        <Link to="/countries" className="hover:text-ink-900">Countries</Link><span>/</span>
        <span className="text-ink-900">{country.name}</span>
      </nav>

      <header className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="relative">
          <span className="text-5xl" aria-hidden="true">{country.flag}</span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Best Forex Brokers in {country.name} <span className="text-slate-500">(2026)</span></h1>
          <p className="mt-2 text-sm font-semibold text-emerald-300">{country.subtitle}</p>
          {(country.seo_intro?.length ? country.seo_intro : country.intro ?? []).slice(0, 3).map((paragraph, index) => <p key={index} className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{paragraph}</p>)}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/quiz" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-ink-950"><Sparkles size={16} /> Find my best broker</Link>
            <a href="#brokers" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white">Compare brokers <ArrowRight size={15} /></a>
          </div>
        </div>
      </header>

      <section id="brokers" aria-labelledby="top-brokers" className="mt-10">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">PipRank recommendations</p>
        <h2 id="top-brokers" className="mt-1 font-display text-2xl font-bold text-ink-950">Top Forex Brokers in {country.name}</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {ranked.map(({ broker, note }, index) => <Reveal key={broker.slug} delay={Math.min(index, 5) * 0.05}><BrokerCard broker={broker} rank={index + 1} note={note} countrySlug={country.slug} /></Reveal>)}
        </div>
      </section>

      {bestFor.length > 0 && <section aria-labelledby="country-best-for" className="mt-12 rounded-2xl border border-line bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Best for</p>
        <h2 id="country-best-for" className="mt-1 font-display text-xl font-bold text-ink-900">Find the best broker for your trading style</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {bestFor.map((doc) => <Link key={doc.content_key} to={`/${country.slug}/${doc.slug}`} className="group rounded-xl border border-line bg-paper p-4 transition hover:border-emerald-400 hover:bg-emerald-50/40">
            <p className="text-sm font-bold text-ink-900">{doc.title}</p>
            {doc.excerpt && <p className="mt-1 text-xs leading-relaxed text-slate-500">{doc.excerpt}</p>}
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Compare options <ArrowRight size={12} /></span>
          </Link>)}
        </div>
      </section>}

      {guides.length > 0 && <section aria-labelledby="country-guides" className="mt-12 rounded-2xl border border-line bg-white p-6">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700"><BookOpen size={14} /> Country guides</p>
        <h2 id="country-guides" className="mt-1 font-display text-xl font-bold text-ink-900">Forex guides for {country.name}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {guides.map((doc) => <Link key={doc.content_key} to={`/${country.slug}/guides/${doc.slug}`} className="group rounded-xl border border-line bg-paper p-4 transition hover:border-emerald-400 hover:bg-emerald-50/40">
            <p className="text-sm font-bold text-ink-900">{doc.title}</p>
            {doc.excerpt && <p className="mt-1 text-xs leading-relaxed text-slate-500">{doc.excerpt}</p>}
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Read guide <ArrowRight size={12} /></span>
          </Link>)}
        </div>
      </section>}

      <section aria-labelledby="country-facts" className="mt-12">
        <h2 id="country-facts" className="font-display text-2xl font-bold text-ink-950">Forex trading facts for {country.name}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {country.facts.map((fact) => <div key={fact.label} className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{fact.label}</p><p className="mt-1.5 text-sm font-bold leading-snug text-ink-900">{fact.value}</p></div>)}
        </div>
      </section>

      <section aria-labelledby="regulation" className="mt-12 rounded-3xl border border-line bg-white p-6 sm:p-8">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={22} /><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Before you deposit</p><h2 id="regulation" className="mt-1 font-display text-2xl font-bold text-ink-950">Regulation and Broker Availability in {country.name}</h2><p className="mt-4 text-sm leading-relaxed text-slate-600">A forex broker's brand name does not tell you which legal entity you will contract with. Regulation, leverage, account protections, products and onboarding rules can vary by entity and country. Confirm the current legal entity, regulator and account terms before funding.</p></div></div>
      </section>

      <section aria-labelledby="recommended" className="mt-12 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center gap-3"><div className="flex -space-x-2">{ranked.slice(0, 3).map(({ broker }) => <Monogram key={broker.slug} name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={28} className="ring-2 ring-white" />)}</div><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Next step</p><p className="text-sm font-semibold text-ink-900">Compare the brokers above or use the broker matcher.</p></div></div>
      </section>

      <div className="mt-10 flex flex-wrap gap-4 text-sm font-semibold"><Link to="/countries" className="text-slate-500 hover:text-ink-900">← All countries</Link><Link to="/quiz" className="text-emerald-700 hover:text-emerald-800">Find my broker →</Link></div>
    </div>
  );
}
