import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Broker, CountryPage } from '../lib/types';
import { fetchBrokers, fetchCountry } from '../lib/api';
import BrokerCard from '../components/BrokerCard';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildItemListJsonLd, countrySeo } from '../lib/seo';
import NotFound from './NotFound';

export default function CountryDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    Promise.all([fetchCountry(slug), fetchBrokers()])
      .then(([c, b]) => { setCountry(c); setBrokers(b); })
      .catch(() => setCountry(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const ranked = country
    ? country.recommended
        .map((r) => brokers.find((b) => b.slug === r.slug))
        .filter((b): b is Broker => Boolean(b))
    : [];
  const seo = country ? countrySeo(country, `/${country.slug}`) : null;

  useSEO(
    seo,
    seo && country
      ? [
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Countries', path: '/countries' },
            { name: country.name, path: `/${country.slug}` },
          ]),
          buildItemListJsonLd(
            `Recommended forex brokers in ${country.name}`,
            ranked.map((b) => ({ name: b.name, path: `/brokers/${b.slug}` })),
          ),
        ]
      : undefined,
  );

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-slate-500">Loading country…</div>;
  if (!country) return <NotFound />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="flex gap-1.5 text-xs text-slate-400">
        <Link to="/">Home</Link><span>/</span><Link to="/countries">Countries</Link><span>/</span><span className="text-ink-900">{country.name}</span>
      </nav>
      <header className="mt-6 rounded-3xl bg-ink-950 p-7 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">{country.flag} {country.name}</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Best Forex Brokers in {country.name}</h1>
        {country.description && <p className="mt-3 max-w-3xl text-slate-300">{country.description}</p>}
      </header>

      {ranked.length > 0 && (
        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">PipRank recommendations</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">Recommended forex brokers in {country.name}</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {ranked.map((broker, index) => <BrokerCard key={broker.slug} broker={broker} rank={index + 1} countrySlug={country.slug} />)}
          </div>
        </section>
      )}
    </div>
  );
}
