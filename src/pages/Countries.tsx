import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Globe2, MapPin, ShieldCheck } from 'lucide-react';
import { GEO_OPTIONS, getGeo, setGeoPreference } from '../lib/geo';
import type { Broker, CountryPage } from '../lib/types';
import { fetchBrokers, fetchCountries } from '../lib/api';
import Monogram from '../components/Monogram';
import Reveal from '../components/Reveal';
import { useSEO } from '../hooks/useSEO';
import { staticPageSeo, buildBreadcrumbJsonLd, buildWebPageJsonLd, buildItemListJsonLd } from '../lib/seo';

export default function Countries() {
  const navigate = useNavigate();
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchCountries(), fetchBrokers()])
      .then(([c, b]) => {
        setCountries(c);
        setBrokers(b);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const bySlug = useMemo(() => new Map(brokers.map((b) => [b.slug, b])), [brokers]);

  useSEO(staticPageSeo.countries, [
    buildWebPageJsonLd(staticPageSeo.countries),
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Countries', path: '/countries' },
    ]),
    buildItemListJsonLd(
      'Forex brokers by country',
      countries.map((c) => ({ name: c.name, path: `/countries/${c.slug}` })),
    ),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
          <Globe2 size={14} /> Localised picks
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900">
          Best forex brokers by <em className="serif-accent text-emerald-700">country</em>
        </h1>
        <p className="mt-3 text-slate-500">
          Regulation, leverage caps and funding rails change at every border. These guides rank brokers by what
          actually matters where you live — licences, local funding and tax treatment.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <MapPin size={15} className="text-emerald-600" />
          <span className="text-xs font-semibold text-slate-500">Where are you trading from?</span>
          <select
            defaultValue={getGeo()?.slug ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setGeoPreference(v);
              navigate(`/countries/${v}`);
            }}
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink-900 outline-none transition focus:border-emerald-500"
          >
            <option value="">Choose your country…</option>
            {GEO_OPTIONS.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.flag} {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-line bg-white" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {countries.map((c, i) => {
            const recs = c.recommended
              .map((r) => bySlug.get(r.slug))
              .filter((b): b is Broker => !!b)
              .slice(0, 3);
            const regulator = c.facts.find((f) => f.label.toLowerCase().includes('regulator'));
            return (
              <Reveal key={c.slug} delay={Math.min(i, 4) * 0.05}>
                <Link
                  to={`/countries/${c.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-soft-lg"
                >
                  <span className="text-4xl">{c.flag}</span>
                  <p className="mt-4 font-display text-lg font-bold text-ink-900">{c.name}</p>
                  {regulator && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <ShieldCheck size={12} className="text-emerald-600" />
                      {regulator.value}
                    </p>
                  )}
                  <div className="mt-4 flex items-center">
                    {recs.map((b, bi) => (
                      <div key={b.slug} style={{ marginLeft: bi === 0 ? 0 : -8 }} className="rounded-xl ring-2 ring-white">
                        <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={26} />
                      </div>
                    ))}
                    <span className="ml-2.5 text-xs font-semibold text-slate-400">Top picks inside</span>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-bold text-emerald-700">
                    See rankings <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
