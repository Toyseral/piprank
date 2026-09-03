import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Info, Scale, Slash, ShieldCheck, Sparkles } from 'lucide-react';
import type { Broker, CountryBestFor, CountryPage, LocalizedSeoPage } from '../lib/types';
import { fetchBrokers, fetchCountry, fetchCountryBestFors, fetchLocalizedSeoPagesForCountry } from '../lib/api';
import { englishHreflangForCountry } from '../lib/localization';
import { track } from '../lib/track';
import BrokerCard from '../components/BrokerCard';
import { ButtonLink } from '../components/Button';
import Monogram from '../components/Monogram';
import Reveal from '../components/Reveal';
import NotFound from './NotFound';
import { fmtMoney } from '../lib/format';
import { allInCost, INTENT_LABELS, scoreColors } from '../lib/score';
import { countrySeoTopics, rankCountryTopicBrokers } from '../data/countrySeoTopics';
import { useSEO } from '../hooks/useSEO';
import { countrySeo, buildBreadcrumbJsonLd, buildWebPageJsonLd, buildItemListJsonLd, buildFAQPageJsonLd } from '../lib/seo';
import { useGeo } from '../lib/GeoContext';
import { countryGuidePath, countryHubPath, countryRankingPath, localizedCountryHubPath } from '../lib/countryRoutes';

function faqFallback(country: CountryPage | null, ranked: { broker: Broker; note: string }[], brokers: Broker[]) {
  if (!country) return [];
  return [
    { q: `What are the best forex brokers in ${country.name}?`, a: ranked.length ? `PipRank currently recommends ${ranked.slice(0, 3).map((x) => x.broker.name).join(', ')} based on the broker data and country availability in our database.` : `PipRank evaluates broker availability and trading features for ${country.name}.` },
    { q: `How should I choose a forex broker in ${country.name}?`, a: `Compare the legal entity serving you, regulation, trading costs, platform, minimum deposit, withdrawal terms and the features that matter to your trading style. Broker availability can differ by country.` },
    { q: `Are all forex brokers available in ${country.name}?`, a: `No. Broker availability varies by country and legal entity. Confirm current onboarding eligibility directly with the broker before depositing.` },
  ];
}

function bestFor(brokers: Broker[], predicate: (b: Broker) => boolean) {
  return brokers.filter(predicate).sort((a, b) => b.rating - a.rating).slice(0, 3);
}

// Kept in sync with the 10-intent list in scripts/prerender.mjs,
// scripts/generate-sitemap.mjs, src/pages/Admin.tsx (SUPERSEDED_INTENT_SLUGS)
// and the matching redirects in vercel.json.
const LEGACY_TOPIC_TO_NEW: Record<string, string> = {
  beginners: 'forex-brokers-for-beginners',
  'low-spread': 'low-spread-forex-brokers',
  mt5: 'mt5-forex-brokers',
  gold: 'gold-forex-brokers',
  scalping: 'forex-brokers-for-scalping',
  islamic: 'islamic-forex-brokers',
  ecn: 'ecn-forex-brokers',
  'copy-trading': 'copy-trading-forex-brokers',
  'swing-trading': 'forex-brokers-for-swing-trading',
  'high-leverage': 'high-leverage-forex-brokers',
};


export default function CountryDetail() {
  const { slug } = useParams<{ slug: string }>();
  const countryPath = countryHubPath(slug ?? '');
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [bestForPages, setBestForPages] = useState<CountryBestFor[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [localizedAlts, setLocalizedAlts] = useState<LocalizedSeoPage[]>([]);
  const { setCountry: setGeoCountry } = useGeo();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setMissing(false);
    Promise.all([fetchCountry(slug), fetchBrokers(), fetchCountryBestFors(slug), fetchLocalizedSeoPagesForCountry(slug).catch(() => [])])
      .then(([c, b, pages, locs]) => {
        setCountry(c);
        setGeoCountry(c.slug);
        setBrokers(b);
        setBestForPages(pages);
        setLocalizedAlts(
          (Array.isArray(locs) ? locs : []).filter(
            (r) => r.published && r.indexable && r.topic_key === 'all' && r.url_prefix && r.slug,
          ),
        );
        track('country_view', { country: c.slug });
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [slug, setGeoCountry]);

  const seoInput = country
    ? {
        ...countrySeo(country, countryPath),
        alternates: [
          { hreflang: englishHreflangForCountry(country.slug), path: countryPath },
          { hreflang: 'x-default', path: countryPath },
          ...localizedAlts.map((r) => ({
            hreflang: r.locale || r.language_code || 'und',
            path: `/countries/${country.slug}/${r.url_prefix}/${r.slug}`,
          })),
        ],
      }
    : null;
  useSEO(
    seoInput,
    country
      ? [
          buildWebPageJsonLd(seoInput!),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Countries', path: '/countries' },
            { name: country.name, path: countryPath },
          ]),
          buildItemListJsonLd(
            `Recommended forex brokers in ${country.name}`,
            country.recommended
              .map((r) => brokers.find((b) => b.slug === r.slug))
              .filter((b): b is Broker => Boolean(b))
              .map((b) => ({ name: b.name, path: `/brokers/${b.slug}` })),
          ),
          buildFAQPageJsonLd([
            {
              question: `What are the best forex brokers in ${country.name}?`,
              answer: country.recommended.length
                ? `PipRank currently recommends ${country.recommended.slice(0, 3).map((r) => brokers.find((b) => b.slug === r.slug)?.name).filter(Boolean).join(', ')} based on the country recommendations in our database. Compare the full broker profiles and confirm current terms before opening an account.`
                : `PipRank evaluates broker availability and trading features for ${country.name}. Review the current broker information on this page before opening an account.`,
            },
            {
              question: `How should I choose a forex broker in ${country.name}?`,
              answer: `Compare the legal entity serving you, regulation, trading costs, platform, minimum deposit, withdrawal terms and the features that matter to your trading style. Country availability can differ even when the broker brand is the same.`,
            },
            {
              question: `Are all forex brokers available in ${country.name}?`,
              answer: `No. Broker availability varies by country and legal entity. PipRank flags brokers that do not currently onboard retail residents of ${country.name} in its dataset, but you should always confirm availability directly with the broker before depositing.`,
            },
            {
              question: `What should I check before depositing with a forex broker?`,
              answer: `Confirm the exact legal entity you will contract with, the regulator responsible for that entity, current fees and spreads, withdrawal methods, account requirements and the broker's current terms.`,
            },
          ]),
        ]
      : undefined,
  );

  const ranked = useMemo(() => {
    if (!country) return [];
    return country.recommended
      .map((r) => ({ broker: brokers.find((b) => b.slug === r.slug), note: r.note }))
      .filter((x): x is { broker: Broker; note: string } => !!x.broker);
  }, [country, brokers]);

  const unavailable = useMemo(() => {
    if (!country) return [];
    return country.unavailable
      .map((s) => brokers.find((b) => b.slug === s))
      .filter((b): b is Broker => !!b);
  }, [country, brokers]);

  const bestCategories = useMemo(() => {
    if (!country) return [];
    const available = ranked.map((x) => x.broker);
    const candidates = [
      { slug: 'beginners', title: 'Best for beginners', test: (b: Broker) => b.best_for.includes('beginners') },
      { slug: 'low-spread', title: 'Best for low spreads', test: (_b: Broker) => true },
      { slug: 'mt5', title: 'Best MT5 broker', test: (b: Broker) => b.platforms.some((p) => p.toLowerCase() === 'mt5') },
      { slug: 'scalping', title: 'Best for scalping', test: (b: Broker) => b.scalping },
      { slug: 'gold', title: 'Best for gold trading', test: (b: Broker) => b.assets.commodities > 0 },
      { slug: 'islamic', title: 'Best Islamic / swap-free option', test: (b: Broker) => b.islamic_account },
      { slug: 'copy-trading', title: 'Best for copy trading', test: (b: Broker) => b.copy_trading },
    ];
    return candidates
      .map((c) => ({ ...c, brokers: c.slug === 'low-spread' ? [...available].sort((a, b) => allInCost(a) - allInCost(b)).slice(0, 3) : available.filter(c.test).sort((a, b) => b.rating - a.rating).slice(0, 3) }))
      .filter((c) => c.brokers.length > 0);
  }, [country, brokers]);

  const countryFaq = country?.seo_faqs?.length ? country.seo_faqs.filter((f) => f?.q && f?.a) : faqFallback(country, ranked, brokers);
  const countrySeoIntro = country?.seo_intro?.length ? country.seo_intro : country?.intro ?? [];
  const countrySeoSections = country?.seo_sections ?? [];

  if (missing) return <NotFound />;

  if (loading || !country)
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="h-52 animate-pulse rounded-3xl border border-line bg-white" />
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl border border-line bg-white" />
          ))}
        </div>
      </div>
    );

  const visibleCompare = ranked.slice(0, 4);

  const matrixTopics = country ? countrySeoTopics.filter((topic) => rankCountryTopicBrokers(brokers, country, topic).length >= (topic.minBrokers ?? 1)).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 16) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Link to="/" className="transition hover:text-ink-900">Home</Link>
        <span>/</span>
        <Link to="/countries" className="transition hover:text-ink-900">Countries</Link>
        <span>/</span>
        <span className="text-ink-900">{country.name}</span>
      </nav>

      <header className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-[110px]" />
        <div className="relative">
          <span className="text-5xl" aria-hidden="true">{country.flag}</span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Forex Trading in {country.name} <span className="text-slate-500">(2026)</span>
          </h1>
          <p className="mt-2 text-sm font-semibold text-emerald-300">{country.subtitle}</p>
          {countrySeoIntro.map((p, i) => (
            <p key={i} className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">{p}</p>
          ))}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={countryRankingPath(country.slug)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-ink-950 transition hover:bg-emerald-300">
              See best forex brokers <ArrowRight size={16} />
            </Link>
            <a href="#comparison" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10">
              Compare brokers <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </header>

      {countrySeoSections.length > 0 && (
        <section aria-labelledby="country-seo-sections" className="mt-8 space-y-5">
          <h2 id="country-seo-sections" className="sr-only">About forex trading and brokers in {country.name}</h2>
          {countrySeoSections.map((section, i) => (
            <article key={`${section.heading}-${i}`} className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-xl font-bold text-ink-950">{section.heading}</h2>
              {section.body?.map((paragraph, pi) => (
                <p key={pi} className="mt-3 text-sm leading-7 text-slate-600">{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                  {section.bullets.map((bullet, bi) => <li key={bi}>{bullet}</li>)}
                </ul>
              ) : null}
            </article>
          ))}
        </section>
      )}

      <section aria-labelledby="country-facts" className="mt-6">
        <h2 id="country-facts" className="sr-only">Forex trading facts for {country.name}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {country.facts.map((f) => (
            <div key={f.label} className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{f.label}</p>
              <p className="mt-1.5 text-sm font-bold leading-snug text-ink-900">{f.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="top-brokers" className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">PipRank recommendations</p>
            <h2 id="top-brokers" className="mt-1 font-display text-2xl font-bold text-ink-950">Top Forex Brokers in {country.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              These recommendations reflect the brokers currently available in our {country.name} dataset. Compare the full broker profiles and confirm current terms before opening an account.
            </p>
          </div>
          <Link to={countryRankingPath(country.slug)} className="hidden text-sm font-bold text-emerald-700 sm:block">View full ranking →</Link>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {ranked.map(({ broker, note }, i) => (
            <Reveal key={broker.slug} delay={Math.min(i, 5) * 0.05}>
              <BrokerCard broker={broker} rank={i + 1} note={note} countrySlug={country.slug} />
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-labelledby="country-guides" className="mt-12">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Local trading guidance</p>
        <h2 id="country-guides" className="mt-1 font-display text-2xl font-bold text-ink-950">Popular Guides for {country.name}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ['Forex Trading Cost', 'forex-trading-cost'],
            ['How to Choose a Forex Broker', 'how-to-choose-a-forex-broker'],
            ['Forex Regulation', 'forex-regulation'],
            ['Forex Payment Methods', 'forex-payment-methods'],
          ].map(([title, guideSlug]) => (
            <Link key={guideSlug} to={countryGuidePath(country.slug, guideSlug)} className="rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300">
              <span className="text-sm font-bold text-ink-900">{title} in {country.name}</span><span className="mt-2 block text-xs font-semibold text-emerald-700">Read guide →</span>
            </Link>
          ))}
        </div>
      </section>

      {country.slug === 'vietnam' && (
        <section className="mt-10 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Tiếng Việt</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink-950">Đọc bằng tiếng Việt</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Explore PipRank's Vietnam forex content in Vietnamese.</p>
          <Link to={localizedCountryHubPath(country.slug, 'vi')} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-800">Xem phiên bản tiếng Việt <ArrowRight size={16} /></Link>
        </section>
      )}

      {country.slug === 'ghana' && (
        <section aria-labelledby="ghana-guides" className="mt-12">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Ghana forex education</p>
          <h2 id="ghana-guides" className="mt-1 font-display text-2xl font-bold text-ink-950">Guides for Ghanaian Forex Traders</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">Country-specific guides on Ghana broker availability, regulation, platforms, spreads, funding and getting started.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['Is Forex Trading Legal in Ghana?', 'is-forex-trading-legal-in-ghana'],
              ['How to Choose a Forex Broker in Ghana', 'how-to-choose-a-forex-broker-in-ghana'],
              ['Forex Broker Regulation in Ghana', 'forex-broker-regulation-in-ghana'],
            ].map(([title, topicSlug]) => (
              <Link key={topicSlug} to={`/ghana/guides/${topicSlug}`} className="rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300">
                <span className="text-sm font-bold text-ink-900">{title}</span>
                <span className="mt-2 block text-xs font-semibold text-emerald-700">Read guide →</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-emerald-700">
            <Link to="/ghana/mt5-forex-brokers">Best MT5 brokers in Ghana →</Link>
            <Link to="/ghana/forex-brokers-for-beginners">Best brokers for beginners in Ghana →</Link>
            <Link to="/ghana/low-minimum-deposit-forex-brokers">Lowest minimum deposit brokers in Ghana →</Link>
          </div>
        </section>
      )}

      {country.slug === 'malaysia' && (
        <section aria-labelledby="malaysia-guides" className="mt-12">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Malaysia forex education</p>
          <h2 id="malaysia-guides" className="mt-1 font-display text-2xl font-bold text-ink-950">Guides for Malaysian Forex Traders</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">Practical guides on broker regulation, trading platforms, spreads, minimum deposits and getting started in Malaysia.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['Is Forex Trading Legal in Malaysia?', 'is-forex-trading-legal-in-malaysia'],
              ['How to Choose a Forex Broker in Malaysia', 'how-to-choose-a-forex-broker-in-malaysia'],
              ['Forex Broker Regulation in Malaysia Explained', 'forex-broker-regulation-in-malaysia'],
            ].map(([title, topicSlug]) => (
              <Link key={topicSlug} to={`/malaysia/guides/${topicSlug}`} className="rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300">
                <span className="text-sm font-bold text-ink-900">{title}</span>
                <span className="mt-2 block text-xs font-semibold text-emerald-700">Read guide →</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-emerald-700">
            <Link to="/malaysia/mt5-forex-brokers">Best MT5 brokers in Malaysia →</Link>
            <Link to="/malaysia/forex-brokers-for-beginners">Best brokers for beginners in Malaysia →</Link>
            <Link to="/malaysia/low-minimum-deposit-forex-brokers">Lowest minimum deposit brokers in Malaysia →</Link>
          </div>
        </section>
      )}

      {visibleCompare.length >= 2 && (
        <section id="comparison" aria-labelledby="comparison-heading" className="mt-10 scroll-mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">At a glance</p>
              <h2 id="comparison-heading" className="mt-1 font-display text-2xl font-bold text-ink-950">Forex Broker Comparison in {country.name}</h2>
            </div>
            {visibleCompare.length === 2 && (
              <Link to={`/compare?a=${visibleCompare[0].broker.slug}&b=${visibleCompare[1].broker.slug}`} className="hidden text-sm font-bold text-emerald-700 sm:block">
                Full head-to-head →
              </Link>
            )}
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Comparison of recommended forex brokers available in {country.name}</caption>
              <thead className="bg-paper text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-4 py-3">Broker</th>
                  <th className="px-4 py-3">PipRank rating</th>
                  <th className="px-4 py-3">Min. deposit</th>
                  <th className="px-4 py-3">EUR/USD spread</th>
                  <th className="px-4 py-3">Max leverage</th>
                  <th className="px-4 py-3">Platforms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleCompare.map(({ broker }) => (
                  <tr key={broker.slug} className="hover:bg-paper/60">
                    <th className="px-4 py-4 font-bold text-ink-900"><Link className="hover:text-emerald-700" to={`/brokers/${broker.slug}`}>{broker.name}</Link></th>
                    <td className="px-4 py-4 font-semibold">{broker.rating.toFixed(1)}/5</td>
                    <td className="px-4 py-4">{fmtMoney(broker.min_deposit)}</td>
                    <td className="px-4 py-4">{broker.spread_eurusd} pips</td>
                    <td className="px-4 py-4">{broker.max_leverage}</td>
                    <td className="px-4 py-4">{broker.platforms.slice(0, 3).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {bestCategories.length > 0 && (
        <section aria-labelledby="best-for" className="mt-12">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Choose by trading need</p>
          <h2 id="best-for" className="mt-1 font-display text-2xl font-bold text-ink-950">Which Forex Broker Is Best for You?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
            The best broker depends on how you trade. PipRank highlights the strongest matches for common trading priorities using the broker data available for comparison.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {bestCategories.map((cat) => (
              <div key={cat.slug} className="rounded-2xl border border-line bg-white p-5">
                <h3 className="font-display text-base font-bold text-ink-900">{cat.title}</h3>
                <div className="mt-3 space-y-2">
                  {cat.brokers.map((b, i) => {
                    const tone = scoreColors(b.trust_score);
                    return (
                      <div key={b.slug} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2.5">
                        <Link to={`/brokers/${b.slug}`} className="font-semibold text-ink-900 hover:text-emerald-700">
                          {i + 1}. {b.name}
                        </Link>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${tone.bg} ${tone.text}`}>Trust {b.trust_score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {countrySeoSections.length > 0 && (
        <section aria-labelledby="country-seo" className="mt-12">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Country-specific guide</p>
          <h2 id="country-seo" className="mt-1 font-display text-2xl font-bold text-ink-950">Forex Trading in {country.name}</h2>
          <div className="mt-5 space-y-6">
            {countrySeoSections.map((section, i) => (
              <section key={`${section.heading}-${i}`} className="rounded-2xl border border-line bg-white p-5">
                <h3 className="font-display text-lg font-bold text-ink-900">{section.heading}</h3>
                {(section.body ?? []).map((p, j) => <p key={j} className="mt-3 text-sm leading-relaxed text-slate-600">{p}</p>)}
                {section.bullets?.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{section.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul> : null}
              </section>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="regulation" className="mt-12 rounded-3xl border border-line bg-white p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={22} />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Before you deposit</p>
            <h2 id="regulation" className="mt-1 font-display text-2xl font-bold text-ink-950">Regulation and Broker Availability in {country.name}</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
              <p>
                A forex broker's brand name does not tell you which legal entity you will contract with. Regulation, leverage, account protections, products and onboarding rules can vary by entity and country.
              </p>
              <p>
                Before funding an account, check the exact legal entity named in the broker's current terms, the regulator responsible for that entity, the available account type and the withdrawal conditions that apply to you.
              </p>
              {unavailable.length > 0 && (
                <p>
                  PipRank currently flags {unavailable.map((b) => b.name).join(', ')} as unavailable to retail residents of {country.name} in our dataset. Availability can change, so verify directly with the broker before relying on this information.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="methodology" className="mt-12">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Our methodology</p>
        <h2 id="methodology" className="mt-1 font-display text-2xl font-bold text-ink-950">How PipRank Evaluates Forex Brokers</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ['Regulation & trust', 'We examine the regulatory information and trust signals available for each broker.'],
            ['Trading costs & execution', 'We compare spreads, commissions, execution and account requirements where data is available.'],
            ['Trader fit', 'We consider platforms, account features and trading preferences so the best choice is not identical for every trader.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-line bg-white p-5">
              <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">
          See the full <Link to="/methodology" className="font-bold text-emerald-700 hover:text-emerald-800">PipRank broker scoring methodology</Link>.
        </p>
      </section>

      <section aria-labelledby="faq" className="mt-12">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Questions traders ask</p>
        <h2 id="faq" className="mt-1 font-display text-2xl font-bold text-ink-950">Forex Brokers in {country.name}: FAQs</h2>
        <div className="mt-5 divide-y divide-line rounded-2xl border border-line bg-white">
          {countryFaq.map((item) => (
            <details key={item.q} className="group p-5">
              <summary className="cursor-pointer list-none pr-8 font-semibold text-ink-900 marker:hidden">
                {item.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {bestForPages.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Best for</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink-900">Find the best broker for your trading style</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {bestForPages.map((page) => (
              <Link
                key={page.id}
                to={LEGACY_TOPIC_TO_NEW[page.slug] ? `/${country.slug}/${LEGACY_TOPIC_TO_NEW[page.slug]}` : `/countries/${country.slug}/best/${page.slug}`}
                className="group rounded-xl border border-line bg-paper p-4 transition hover:border-emerald-400 hover:bg-emerald-50/40"
              >
                <p className="text-sm font-bold text-ink-900">{page.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{page.intro?.[0] ?? page.title}</p>
                <span className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-emerald-700">
                  <span className="inline-flex items-center gap-1">Compare options <ArrowRight size={12} className="transition group-hover:translate-x-0.5" /></span>
                  {page.slug && <Link to={`/best/${page.slug}`} className="text-slate-500 hover:text-ink-900">Global version</Link>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {matrixTopics.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-white p-6" aria-labelledby="localized-searches">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Explore by trading need</p>
          <h2 id="localized-searches" className="mt-1 font-display text-xl font-bold text-ink-900">Forex broker searches for {country.name}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">Explore country-specific broker comparisons across instruments, platforms, trading styles and costs. Each page uses the {country.name} broker recommendation set before applying its specific criteria.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matrixTopics.map((topic) => (
              <Link key={topic.slug} to={`/${country.slug}/${topic.slug}`} className="group rounded-xl border border-line bg-paper p-4 transition hover:border-emerald-400 hover:bg-emerald-50/40">
                <p className="text-sm font-bold text-ink-900">{topic.title} in {country.name}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Compare options <ArrowRight size={12} className="transition group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {unavailable.length > 0 && (
        <section aria-labelledby="unavailable" className="mt-10 rounded-2xl border border-dashed border-line bg-white/50 p-6">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Slash size={13} /> Rated here, but doesn't onboard {country.name} retail residents
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unavailable.map((b) => (
              <Link key={b.slug} to={`/brokers/${b.slug}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-semibold text-slate-400 line-through decoration-slate-300 transition hover:border-ink-900 hover:text-ink-900 hover:no-underline">
                <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={18} className="rounded-md opacity-60" />
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-900">
          Entity availability, product range and leverage differ by country even within one brand. Always confirm which legal entity you'll be contracted to — and which regulator protects you — before funding. Tax notes are general information, not tax advice; consult a local professional.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link to="/countries" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-ink-900">
          <ArrowRight size={14} className="rotate-180" /> All country guides
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/quiz" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800">
          <Info size={14} /> Get a personal broker match
        </Link>
      </div>
    </div>
  );
}
