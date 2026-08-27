import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { Broker } from '../lib/types';
import { fetchBrokers, fetchCountry } from '../lib/api';
import { useGeo } from '../lib/GeoContext';
import BrokerCard from '../components/BrokerCard';
import Reveal from '../components/Reveal';
import { tierBest } from '../lib/score';
import { useSEO } from '../hooks/useSEO';
import { staticPageSeo, buildBreadcrumbJsonLd, buildWebPageJsonLd } from '../lib/seo';

type SortKey = 'rating' | 'trust' | 'spread' | 'deposit' | 'withdrawal';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'rating', label: 'Top rated' },
  { key: 'trust', label: 'Highest trust score' },
  { key: 'spread', label: 'Lowest EUR/USD spread' },
  { key: 'deposit', label: 'Lowest minimum deposit' },
  { key: 'withdrawal', label: 'Fastest withdrawals' },
];

const PLATFORM_FILTERS = ['MT4', 'MT5', 'cTrader'];
const FEATURE_FILTERS = [
  { key: 'copy_trading', label: 'Copy trading' },
  { key: 'islamic_account', label: 'Islamic (swap-free)' },
  { key: 'scalping', label: 'Scalping allowed' },
  { key: 'demo_account', label: 'Demo account' },
  { key: 'bonus', label: 'Offers a bonus' },
] as const;

const DEPOSIT_CAPS = [
  { value: 0, label: 'Any minimum' },
  { value: 50, label: 'Up to $50' },
  { value: 100, label: 'Up to $100' },
  { value: 250, label: 'Up to $250' },
  { value: 1000, label: 'Up to $1,000' },
];

export default function Brokers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [sort, setSort] = useState<SortKey>('rating');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [tier1, setTier1] = useState(false);
  const [cap, setCap] = useState(0);
  const { country: activeGeo } = useGeo();
  const [localizedCountry, setLocalizedCountry] = useState<import('../lib/types').CountryPage | null>(null);

  useEffect(() => {
    fetchBrokers()
      .then(setBrokers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load brokers'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeGeo) { setLocalizedCountry(null); return; }
    fetchCountry(activeGeo.slug).then(setLocalizedCountry).catch(() => setLocalizedCountry(null));
  }, [activeGeo]);

  useSEO(staticPageSeo.brokers, [
    buildWebPageJsonLd(staticPageSeo.brokers),
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Brokers', path: '/brokers' },
    ]),
  ]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const recommendedOrder = new Map((localizedCountry?.recommended ?? []).map((r, i) => [r.slug, i]));
    const source = localizedCountry ? brokers.filter((b) => recommendedOrder.has(b.slug)) : brokers;
    let list = source.filter((b) => {
      if (query && !b.name.toLowerCase().includes(query) && !b.tagline.toLowerCase().includes(query))
        return false;
      if (platforms.length && !platforms.every((p) => b.platforms.includes(p))) return false;
      if (tier1 && tierBest(b) !== 1) return false;
      if (cap > 0 && b.min_deposit > cap) return false;
      for (const f of features) {
        if (f === 'bonus' && !b.bonus) return false;
        if (f !== 'bonus' && !(b as unknown as Record<string, boolean>)[f]) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'trust':
          return b.trust_score - a.trust_score;
        case 'spread':
          return a.spread_eurusd - b.spread_eurusd;
        case 'deposit':
          return a.min_deposit - b.min_deposit;
        case 'withdrawal':
          return a.withdrawal_hours - b.withdrawal_hours;
        default:
          return b.rating - a.rating;
      }
    });
    if (localizedCountry && recommendedOrder.size) {
      list.sort((a, b) => (recommendedOrder.get(a.slug) ?? 99) - (recommendedOrder.get(b.slug) ?? 99));
    }
    return list;
  }, [brokers, localizedCountry, q, sort, platforms, features, tier1, cap]);

  const toggleStr = (list: string[], set: (v: string[]) => void, value: string) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const reset = () => {
    setQ('');
    setSort('rating');
    setPlatforms([]);
    setFeatures([]);
    setTier1(false);
    setCap(0);
    setSearchParams({});
  };

  const activeFilters = platforms.length + features.length + (tier1 ? 1 : 0) + (cap > 0 ? 1 : 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">{localizedCountry ? `${localizedCountry.flag} Brokers for ${localizedCountry.name}` : 'Broker directory'}</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900">
          {localizedCountry ? <>Best <em className="serif-accent text-emerald-700">forex brokers in {localizedCountry.name}</em></> : <>The <em className="serif-accent text-emerald-700">best forex brokers</em> of 2026</>}
        </h1>
        <p className="mt-3 text-slate-500">
          {localizedCountry ? `Showing brokers PipRank currently recommends for traders in ${localizedCountry.name}.` : 'Every broker scored on 96 live-tested data points — filter by regulation, costs or platform and every card updates instantly.'}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-8 rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-paper px-3.5 transition focus-within:border-emerald-500">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or specialty…"
              className="h-full w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium text-ink-900 outline-none lg:w-56"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
              className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-medium text-ink-900 outline-none lg:w-44"
            >
              {DEPOSIT_CAPS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SlidersHorizontal size={15} className="mr-1 text-slate-400" />
          <button
            onClick={() => setTier1((v) => !v)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              tier1
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-line bg-white text-slate-600 hover:border-emerald-400'
            }`}
          >
            Tier-1 regulated
          </button>
          {PLATFORM_FILTERS.map((p) => (
            <button
              key={p}
              onClick={() => toggleStr(platforms, setPlatforms, p)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                platforms.includes(p)
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-line bg-white text-slate-600 hover:border-ink-900'
              }`}
            >
              {p}
            </button>
          ))}
          {FEATURE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleStr(features, setFeatures, f.key)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                features.includes(f.key)
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-line bg-white text-slate-600 hover:border-ink-900'
              }`}
            >
              {f.label}
            </button>
          ))}
          {activeFilters > 0 && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              <RotateCcw size={12} /> Reset ({activeFilters})
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        <span className="tnum font-bold text-ink-900">{results.length}</span> broker
        {results.length === 1 ? '' : 's'} match
      </p>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error} — please refresh to try again.
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-white p-14 text-center">
          <p className="font-display text-xl font-bold text-ink-900">
            {localizedCountry ? `Country-specific recommendations for ${localizedCountry.name} are being finalized` : 'No brokers match those filters'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {localizedCountry
              ? `PipRank does not substitute global rankings for ${localizedCountry.name} until broker availability has been verified.`
              : 'Try widening the deposit cap or removing a platform filter.'}
          </p>
          <button
            onClick={reset}
            className="mt-5 rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-700"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((b, i) => (
            <Reveal key={b.slug} delay={Math.min(i, 5) * 0.05}>
              <BrokerCard broker={b} rank={localizedCountry ? i + 1 : undefined} countrySlug={localizedCountry?.slug} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
