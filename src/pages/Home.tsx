import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Copy,
  FlaskConical,
  Gauge,
  GraduationCap,
  Landmark,
  Layers,
  MonitorSmartphone,
  Percent,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Broker, CountryPage, Guide, Intent } from '../lib/types';
import { fetchBrokers, fetchCountries, fetchGuides, fetchIntents } from '../lib/api';
import { useGeo } from '../lib/GeoContext';
import BrokerCard from '../components/BrokerCard';
import { ButtonLink } from '../components/Button';
import { useSEO } from '../hooks/useSEO';
import { SITE_NAME } from '../lib/seo';
import Monogram from '../components/Monogram';
import Reveal from '../components/Reveal';
import SectionHead from '../components/SectionHead';

const INTENT_ICONS: Record<string, LucideIcon> = {
  beginners: GraduationCap,
  'low-spread': Percent,
  mt5: MonitorSmartphone,
  ecn: Zap,
  'copy-trading': Copy,
  scalping: Timer,
  'swing-trading': Waves,
  'high-leverage': Gauge,
};

const TOOLS = [
  { tab: 'position', icon: Target, name: 'Position Size', blurb: 'Exact lot size for your risk and stop loss.' },
  { tab: 'pip', icon: Percent, name: 'Pip Value', blurb: 'What each pip is worth in your account currency.' },
  { tab: 'margin', icon: Landmark, name: 'Margin', blurb: 'Required margin before you open the trade.' },
  { tab: 'profit', icon: TrendingUp, name: 'Profit & Loss', blurb: 'Project P&L from entry, exit and size.' },
  { tab: 'compound', icon: Layers, name: 'Compounding', blurb: 'See where steady returns take your account.' },
];

const STEPS = [
  { icon: FlaskConical, title: 'Real-money accounts', text: 'We open and fund live accounts with every broker — no demos, no sponsored access.' },
  { icon: Timer, title: 'Measured, not claimed', text: 'Spreads, execution speed, slippage and withdrawal times are measured over 5+ trading days.' },
  { icon: ShieldCheck, title: 'Licence verification', text: 'Every licence number is checked against the regulator’s public register, twice a year.' },
  { icon: RefreshCw, title: 'Refreshed monthly', text: 'Health scores re-compute as new withdrawal, uptime and complaint data lands.' },
];

export default function Home() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { country: activeGeo } = useGeo();
  const location = useLocation();

  // Smooth-scroll to an in-page anchor (e.g. /#categories) since client-side
  // route changes don't trigger the browser's native hash-scroll behaviour.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace(/^#/, '');
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, loading]);

  useEffect(() => {
    Promise.all([fetchBrokers(), fetchIntents(), fetchGuides(), fetchCountries()])
      .then(([b, i, g, c]) => {
        setBrokers(b);
        setIntents(i);
        setGuides(g);
        setCountries(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useSEO({
    title: 'PipRank — Best Forex Brokers 2026: Reviews, Comparison & Free Trading Tools',
    description:
      'Compare the best forex brokers of 2026 with real-money tested spreads, fees and withdrawal times. PipRank scores 12 brokers on 96 data points — find your match in 60 seconds.',
    path: '/',
    type: 'website',
  }, {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: 'Independent forex broker reviews, comparisons and trading tools, scored on real-money test data.',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: '/brokers?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  });


  const localizedCountry = useMemo(
    () => activeGeo ? countries.find((c) => c.slug === activeGeo.slug) ?? null : null,
    [activeGeo, countries]
  );

  const localizedBrokers = useMemo(() => {
    if (!localizedCountry) return brokers;
    const order = new Map((localizedCountry.recommended ?? []).map((r, i) => [r.slug, i]));
    if (!order.size) return [];
    return brokers
      .filter((b) => order.has(b.slug))
      .sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));
  }, [brokers, localizedCountry]);

  const displayBrokers = localizedCountry ? localizedBrokers : brokers;

  const ticker = useMemo(
    () => [...displayBrokers].sort((a, b) => a.spread_eurusd - b.spread_eurusd).slice(0, 10),
    [displayBrokers]
  );

  const topPairs = useMemo(() => {
    if (brokers.length < 3) return [];
    const [a, b, c] = brokers;
    return [
      { x: a, y: b },
      { x: a, y: c },
      { x: b, y: c },
    ];
  }, [brokers]);

  return (
    <div>
      {/* ============================= HERO ============================= */}
      <section className="relative overflow-hidden bg-ink-950">
        <div className="absolute inset-0 bg-grid-dark" />
        <img
          src="/images/hero-terminal.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-ink-950/30" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
        <div className="absolute -left-32 -top-28 h-[440px] w-[440px] rounded-full bg-emerald-500/15 blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-emerald-400/[0.07] blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 backdrop-blur-sm sm:px-3.5 sm:text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Independent data · Refreshed monthly
            </div>
            <h1 className="mt-6 font-display text-[36px] font-bold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Find the <em className="serif-accent text-emerald-300">best forex broker</em> for you.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              Answer a few quick questions in 60 seconds and get personalised broker recommendations — matched
              to the way you trade, your budget, and your country.
            </p>

            <div className="mt-8">
              <ButtonLink
                variant="primary"
                size="lg"
                icon={Sparkles}
                to="/quiz"
                className="w-full shadow-[0_16px_40px_-10px_rgba(53,163,113,0.55)] sm:w-auto sm:px-8"
              >
                Find My Broker
              </ButtonLink>
            </div>

          </motion.div>
        </div>

        {/* Spread ticker */}
        {!loading && ticker.length > 0 && (
          <div className="relative border-t border-white/10 bg-white/[0.04] py-3.5 backdrop-blur">
            <div className="overflow-hidden">
              <div className="flex w-max animate-marquee gap-10">
                {[...ticker, ...ticker].map((b, i) => (
                  <Link
                    key={`${b.slug}-${i}`}
                    to={`/brokers/${b.slug}`}
                    className="group flex items-center gap-2.5 whitespace-nowrap text-xs"
                  >
                    <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={20} className="rounded-md" />
                    <span className="font-semibold text-slate-300 transition group-hover:text-white">
                      {b.name}
                    </span>
                    <span className="tnum font-bold text-emerald-300">EUR/USD {b.spread_eurusd}p</span>
                    <span className="h-1 w-1 rounded-full bg-slate-600" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>


      {/* ============================= TOP BROKERS ============================= */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead
              eyebrow={localizedCountry ? `${localizedCountry.flag} Recommended for ${localizedCountry.name}` : 'Top rated this month'}
              title={
                <>
                  {localizedCountry ? <>Best <em className="serif-accent text-emerald-700">forex brokers in {localizedCountry.name}</em></> : <>Highest-rated <em className="serif-accent text-emerald-700">forex brokers</em> right now</>}
                </>
              }
              subtitle={localizedCountry ? `Recommendations are tailored to traders in ${localizedCountry.name}, using the brokers PipRank currently identifies as available there.` : 'Ranked by our composite of editorial rating, trust score and measured performance.'}
            />
            <ButtonLink variant="outline" size="md" icon={ArrowRight} iconRight to="/brokers">
              View all brokers
            </ButtonLink>
          </div>
        </Reveal>

        {error && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            {error} — please refresh to try again.
          </div>
        )}

        {loading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
            ))}
          </div>
        ) : localizedCountry && !localizedBrokers.length ? (
          <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
            <h3 className="font-display text-xl font-bold text-ink-950">Country-specific recommendations are being finalized</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900">
              PipRank only shows a broker here after its availability for {localizedCountry.name} has been verified. You can still browse the {localizedCountry.name} country guide while recommendations are being finalized.
            </p>
            <Link to={`/countries/${localizedCountry.slug}`} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800">
              Explore {localizedCountry.name} broker information <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {displayBrokers.slice(0, 6).map((b, i) => (
              <Reveal key={b.slug} delay={i * 0.06}>
                <BrokerCard broker={b} rank={localizedCountry ? i + 1 : undefined} countrySlug={localizedCountry?.slug} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* ============================= INTENTS ============================= */}
      <section id="categories" className="relative scroll-mt-24 overflow-hidden border-y border-line bg-white">
        <div className="absolute inset-0 bg-grid-light opacity-60" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal>
            <SectionHead
              eyebrow="Best broker for…"
              title={
                <>
                  Best brokers for <em className="serif-accent text-emerald-700">every trading style</em>
                </>
              }
              subtitle="Every list is re-ranked monthly from the same underlying dataset — no sponsored placements."
            />
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {intents.map((intent, i) => {
              const Icon = INTENT_ICONS[intent.icon] ?? GraduationCap;
              return (
                <Reveal key={intent.slug} delay={i * 0.05}>
                  <Link
                    to={`/best/${intent.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-paper/80 p-5 backdrop-blur-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:bg-white hover:shadow-soft-lg"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-emerald-400 transition group-hover:bg-emerald-500 group-hover:text-ink-950">
                      <Icon size={19} />
                    </div>
                    <p className="mt-4 font-display text-sm font-bold text-ink-900">{intent.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {intent.intro[0]}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-bold text-emerald-700">
                      See rankings <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================= COUNTRIES ============================= */}
      {!loading && countries.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHead
                eyebrow="Trade from anywhere"
                title={
                  <>
                    Best forex brokers by <em className="serif-accent text-emerald-700">country</em>
                  </>
                }
                subtitle="Regulation, leverage caps and funding rails change at every border. Start with a guide built for where you live."
              />
              <ButtonLink variant="outline" size="md" icon={ArrowRight} iconRight to="/countries">
                All countries
              </ButtonLink>
            </div>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {countries.map((c, i) => (
              <Reveal key={c.slug} delay={Math.min(i, 4) * 0.05}>
                <Link
                  to={`/countries/${c.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-soft-lg"
                >
                  <span className="text-3xl">{c.flag}</span>
                  <p className="mt-3 font-display text-sm font-bold text-ink-900">{c.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{c.subtitle}</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-bold text-emerald-700">
                    See rankings <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ============================= COMPARE TEASER ============================= */}
      <section className="relative overflow-hidden bg-ink-950">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-emerald-500/15 blur-[130px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <SectionHead
                dark
                eyebrow="Head to head"
                title={
                  <>
                    Compare <em className="serif-accent text-emerald-300">forex brokers</em> side by side
                  </>
                }
                subtitle="Spreads, fees, execution speed, regulation, platforms, funding — every metric side by side with the winner called on each row."
              />
              <ButtonLink variant="white" size="lg" icon={Scale} to="/compare" className="mt-7">
                Build a comparison
              </ButtonLink>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="px-2 pb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                  Popular matchups
                </p>
                <div className="space-y-2">
                  {loading
                    ? [0, 1, 2].map((i) => (
                        <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
                      ))
                    : topPairs.map(({ x, y }) => (
                        <Link
                          key={`${x.slug}-${y.slug}`}
                          to={`/compare?a=${x.slug}&b=${y.slug}`}
                          className="group flex items-center gap-3 rounded-xl border border-white/10 bg-ink-900/60 px-3.5 py-3 transition hover:border-emerald-500/40 hover:bg-ink-800 sm:px-4 sm:py-3.5"
                        >
                          <span className="flex shrink-0 -space-x-2.5">
                            <Monogram name={x.name} logoUrl={x.logo_url} color={x.brand_color} size={30} className="rounded-lg ring-2 ring-ink-900" />
                            <Monogram name={y.name} logoUrl={y.logo_url} color={y.brand_color} size={30} className="rounded-lg ring-2 ring-ink-900" />
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-semibold leading-tight text-white">
                              {x.name}
                              <span className="tnum mx-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">vs</span>
                              {y.name}
                            </span>
                            <span className="tnum mt-0.5 block truncate text-[11px] font-semibold leading-tight text-slate-500">
                              {x.rating.toFixed(1)}★ vs {y.rating.toFixed(1)}★ · {x.spread_eurusd}p vs {y.spread_eurusd}p
                            </span>
                          </span>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 transition group-hover:bg-emerald-500 group-hover:text-ink-950">
                            <ArrowRight size={14} />
                          </span>
                        </Link>
                      ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================= QUIZ BAND ============================= */}
      <section className="border-b border-line bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50 p-8 shadow-soft sm:p-10 lg:grid-cols-[1.3fr_1fr]">
            <Reveal>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Personalised in 60 seconds
              </p>
              <h2 className="mt-2.5 font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
                Answer 6 questions. Get your{' '}
                <em className="serif-accent text-emerald-700">top 3</em> brokers.
              </h2>
              <p className="mt-3 max-w-lg text-slate-500">
                Our matcher scores every broker against your experience, trading style, budget and platform
                preference — then explains exactly why each match made the cut.
              </p>
              <ButtonLink variant="dark" size="lg" icon={Sparkles} to="/quiz" className="mt-6">
                Start the quiz
              </ButtonLink>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="relative space-y-3">
                {['Style fit', 'Cost fit', 'Platform fit'].map((l, i) => (
                  <div
                    key={l}
                    className="flex items-center justify-between rounded-2xl border border-line bg-white/80 px-5 py-4 shadow-soft backdrop-blur-sm"
                    style={{ transform: `translateX(${i * 14}px)` }}
                  >
                    <span className="text-sm font-semibold text-ink-900">{l}</span>
                    <span className="tnum font-display text-lg font-bold text-emerald-600">
                      {96 - i * 4}%
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================= TOOLS ============================= */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <SectionHead
            eyebrow="Free trading calculators"
            title={
              <>
                Free <em className="serif-accent text-emerald-700">forex calculators</em> — no signup
              </>
            }
            subtitle="The same calculators our analysts run before every test trade."
          />
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TOOLS.map((tool, i) => (
            <Reveal key={tool.tab} delay={i * 0.05}>
              <Link
                to={`/tools?tab=${tool.tab}`}
                className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-soft-lg"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-500 group-hover:text-ink-950">
                  <tool.icon size={19} />
                </div>
                <p className="mt-4 font-display text-sm font-bold text-ink-900">{tool.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{tool.blurb}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================= GUIDES ============================= */}
      <section className="relative overflow-hidden border-y border-line bg-white">
        <div className="absolute inset-0 bg-grid-light opacity-60" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHead
                eyebrow="PipRank Guides"
                title={
                  <>
                    Forex <em className="serif-accent text-emerald-700">trading guides</em> that actually teach
                  </>
                }
                subtitle="Long-form guides written by our research desk — beginner to advanced."
              />
              <ButtonLink variant="outline" size="md" icon={ArrowRight} iconRight to="/guides">
                All guides
              </ButtonLink>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {(loading ? [] : guides.slice(0, 3)).map((g, i) => (
              <Reveal key={g.slug} delay={i * 0.07}>
                <Link to={`/guides/${g.slug}`} className="group block">
                  <div className="overflow-hidden rounded-2xl border border-line shadow-soft">
                    <img
                      src={g.image}
                      alt={g.title}
                      className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-ink-900 px-2.5 py-1 font-bold text-white">{g.category}</span>
                    <span className="text-slate-400">{g.minutes} min read · {g.level}</span>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold leading-snug text-ink-900 transition group-hover:text-emerald-700">
                    {g.title}
                  </h3>
                </Link>
              </Reveal>
            ))}
            {loading &&
              [0, 1, 2].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-2xl border border-line bg-white/70" />
              ))}
          </div>
        </div>
      </section>

      {/* ============================= METHODOLOGY ============================= */}
      <section id="methodology" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <SectionHead
            eyebrow="How we test"
            title={
              <>
                How we <em className="serif-accent text-emerald-700">test</em> forex brokers
              </>
            }
            subtitle="Every number on PipRank traces back to a measurement we made with our own money."
          />
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.06}>
              <div className="relative h-full overflow-hidden rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5">
                <span className="tnum absolute -right-1 -top-3 font-display text-6xl font-bold text-emerald-600/10">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-emerald-400">
                  <step.icon size={20} />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================= FINAL QUIZ CTA ============================= */}
      <section className="relative overflow-hidden bg-ink-950">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute left-1/2 top-0 h-64 w-[680px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[130px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-300">
                <Sparkles size={13} /> 60 seconds · six questions
              </p>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Stop scrolling. Get your{' '}
                <em className="serif-accent text-emerald-300">top 3 brokers</em>.</h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
                Answer six quick questions and the matcher scores every broker in our index against your
                location, style, budget and platform — with the reasoning shown.
              </p>
              <div className="mt-8 flex justify-center">
                <ButtonLink variant="primary" size="lg" icon={Sparkles} to="/quiz">
                  Take the broker quiz
                </ButtonLink>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Then put your matches side by side in the comparison table.
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
