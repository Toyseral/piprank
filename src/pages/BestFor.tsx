import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  Gauge,
  GraduationCap,
  MonitorSmartphone,
  Percent,
  Timer,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Broker, ContentDocument, CountryBestFor, CountryPage, Intent } from '../lib/types';
import { fetchBrokers, fetchContentDocument, fetchCountries, fetchCountry, fetchCountryBestFor, fetchCountryBestFors, fetchCountryIntentRankings, fetchIntent } from '../lib/api';
import { useGeo } from '../lib/GeoContext';
import { track } from '../lib/track';

// Kept in sync with INTENT_TO_TOPIC in scripts/prerender.mjs,
// SUPERSEDED_INTENTS in scripts/generate-sitemap.mjs, and
// SUPERSEDED_INTENT_SLUGS in src/pages/Admin.tsx.
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
import { ButtonLink, btnCls } from '../components/Button';
import BrokerCard from '../components/BrokerCard';
import Monogram from '../components/Monogram';
import Stars from '../components/Stars';
import VisitButton from '../components/VisitButton';
import Reveal from '../components/Reveal';
import { blocksToHtml } from '../components/PageBuilder';
import { fmtMoney } from '../lib/format';
import { useSEO } from '../hooks/useSEO';
import { buildBreadcrumbJsonLd, buildFAQPageJsonLd, buildItemListJsonLd, intentSeo, countryBestForSeo, type SeoInput } from '../lib/seo';
import { allInCost, healthScore, scoreColors, tierBest } from '../lib/score';
import NotFound from './NotFound';

const ICONS: Record<string, LucideIcon> = {
  beginners: GraduationCap,
  'low-spread': Percent,
  mt5: MonitorSmartphone,
  ecn: Zap,
  'copy-trading': Copy,
  scalping: Timer,
  'swing-trading': Waves,
  'high-leverage': Gauge,
};

function reasonFor(slug: string, b: Broker): string {
  switch (slug) {
    case 'low-spread':
      return `${b.spread_eurusd}p EUR/USD · ${allInCost(b)} pips all-in per lot`;
    case 'scalping':
      return `Scalping allowed · ${b.execution_ms}ms execution · ${b.spread_eurusd}p spread`;
    case 'copy-trading':
      return b.copy_trading
        ? 'Native copy-trading platform with verified strategy stats'
        : 'Copy via third-party signal marketplaces';
    case 'mt5':
      return `Full MT5 suite · ${b.assets.forex} forex pairs · ${b.uptime}% uptime`;
    case 'ecn':
      return b.commission_value === 0
        ? 'ECN-style pricing folded into the spread'
        : `Raw ECN pricing · $${b.commission_value.toFixed(2)}/lot commission`;
    case 'beginners':
      return `${fmtMoney(b.min_deposit)} minimum · free demo · ${b.support_channels.length} support channels`;
    case 'swing-trading':
      return `Built for multi-day holds · ${b.max_leverage} leverage · ${b.uptime}% uptime`;
    case 'high-leverage':
      return `Up to ${b.max_leverage} leverage · ${fmtMoney(b.min_deposit)} minimum deposit`;
    default:
      return b.tagline;
  }
}

export default function BestFor() {
  const { slug, countrySlug } = useParams<{ slug: string; countrySlug: string }>();
  const [intent, setIntent] = useState<Intent | CountryBestFor | null>(null);
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [countries, setCountries] = useState<CountryPage[]>([]);
  const [countryBestForPages, setCountryBestForPages] = useState<CountryBestFor[]>([]);
  const [countryRankingIds, setCountryRankingIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const { country: activeGeo } = useGeo();
  const [localizedCountry, setLocalizedCountry] = useState<CountryPage | null>(null);
  const [richContent, setRichContent] = useState<ContentDocument | null>(null);

  useEffect(() => {
    if (countrySlug || !activeGeo) { setLocalizedCountry(null); return; }
    fetchCountry(activeGeo.slug).then(setLocalizedCountry).catch(() => setLocalizedCountry(null));
  }, [activeGeo, countrySlug]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setMissing(false);
    setError('');
    setRichContent(null);

    const request = countrySlug
      ? Promise.all([
          fetchCountryBestFor(countrySlug, slug),
          fetchCountry(countrySlug),
          fetchBrokers(),
          fetchCountries(),
          fetchCountryBestFors(countrySlug),
          fetchCountryIntentRankings(countrySlug, slug).catch(() => []),
        ])
      : Promise.all([
          fetchIntent(slug),
          Promise.resolve(null),
          fetchBrokers(),
          fetchCountries(),
          Promise.resolve([] as CountryBestFor[]),
          Promise.resolve([] as any[]),
        ]);

    request
      .then(([i, c, b, countryRows, countryBestForRows, rankingRows]) => {
        setIntent(i as Intent | CountryBestFor);
        setCountry(c as CountryPage | null);
        setBrokers(b);
        setCountries(countryRows ?? []);
        setCountryBestForPages(countryBestForRows ?? []);
        setCountryRankingIds((rankingRows ?? []).map((r: any) => Number(r.broker_id)));
        document.title = `${i.title} | PipRank`;
        track('intent_view', { intent: i.slug, country: countrySlug ?? 'global' });
        const richKey = countrySlug ? `best-for:${countrySlug}:${i.slug}` : `best-for:${i.slug}`;
        fetchContentDocument(richKey).then((content) => setRichContent(content?.published ? content : null)).catch(() => setRichContent(null));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Unable to load this page');
        setMissing(true);
      })
      .finally(() => setLoading(false));

    return () => {
      document.title = 'PipRank — Forex Broker Reviews, Comparison & Trading Tools';
    };
  }, [slug, countrySlug]);

  const ranked = useMemo(() => {
    if (!intent) return [];
    const recommendationCountry = countrySlug ? country : localizedCountry;
    const countryRecommended = recommendationCountry?.recommended?.map((r) => r.slug) ?? [];
    // Explicit country URLs and automatically localized users both use only
    // country-specific recommendations. If none exist, keep the global page honest.
    const hasCountryContext = Boolean(countrySlug || localizedCountry);
    const pool = hasCountryContext
      ? brokers.filter((b) => countryRecommended.includes(b.slug))
      : brokers;
    const intentPool = countrySlug && countryRankingIds.length
      ? pool.filter((b) => countryRankingIds.includes(b.id))
      : pool.filter((b) => b.best_for.includes(intent.slug));
    return intentPool.sort((a, b) => {
        const ari = countryRankingIds.indexOf(a.id);
        const bri = countryRankingIds.indexOf(b.id);
        if (ari >= 0 && bri >= 0) return ari - bri;
        const ai = countryRecommended.indexOf(a.slug);
        const bi = countryRecommended.indexOf(b.slug);
        if (ai >= 0 && bi >= 0) return ai - bi;
        return b.rating - a.rating || b.trust_score - a.trust_score;
      });
  }, [brokers, intent, country, localizedCountry, countrySlug, countryRankingIds]);

  const rest = useMemo(() => {
    if (!intent || countrySlug) return [];
    return brokers.filter((b) => !b.best_for.includes(intent.slug)).slice(0, 4);
  }, [brokers, intent, countrySlug]);

  const seoInput: SeoInput | null = intent
    ? (countrySlug ? countryBestForSeo(countrySlug, intent) : intentSeo(intent))
    : null;
  const seoJsonLd = intent && seoInput ? [
    buildBreadcrumbJsonLd(countrySlug ? [
      { name: 'Home', path: '/' },
      { name: 'Countries', path: '/countries' },
      { name: country?.name ?? countrySlug, path: `/${countrySlug}` },
      { name: intent.title, path: seoInput.path },
    ] : [{ name: 'Home', path: '/' }, { name: 'Best Forex Brokers', path: '/best' }, { name: intent.title, path: seoInput.path }]),
    buildItemListJsonLd(intent.title, ranked.slice(0, 10).map((b) => ({ name: b.name, path: `/brokers/${b.slug}` }))),
    ...('faqs' in intent && intent.faqs?.length ? [buildFAQPageJsonLd(intent.faqs.map((f) => ({ question: f.q, answer: f.a })))] : []),
  ] : undefined;
  useSEO(seoInput, seoJsonLd);

  if (missing) return <NotFound />;

  if (loading || !intent)
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="h-48 animate-pulse rounded-3xl border border-line bg-white" />
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl border border-line bg-white" />
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      </div>
    );

  const Icon = ICONS[intent.icon] ?? GraduationCap;
  const sections = Array.isArray(intent.sections) ? intent.sections : [];
  const faqs = Array.isArray(intent.faqs) ? intent.faqs : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* header */}
      <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 sm:p-10">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-[110px]" />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-ink-950 shadow-lg shadow-emerald-500/30">
            <Icon size={24} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
            {country ? `${country.flag} ${country.name}` : localizedCountry ? `${localizedCountry.flag} Localized for ${localizedCountry.name}` : 'PipRank'}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {intent.title}
          </h1>
          {intent.intro.map((p, i) => (
            <p key={i} className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">
              {p}
            </p>
          ))}
        </div>
      </div>

      {/* decision-path links */}
      <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5" aria-labelledby="next-step">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your next step</p>
            <h2 id="next-step" className="mt-1 font-display text-lg font-bold text-ink-900">Choose the broker that fits you best</h2>
          </div>
          {ranked[0] && (
            <Link to={`/brokers/${ranked[0].slug}`} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-ink-800">
              Read the top pick <ArrowRight size={15} />
            </Link>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {country && <Link to={`/${country.slug}`} className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-400">All {country.name} brokers</Link>}
          <Link to={`/best/${intent.slug}`} className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-400">Global {intent.title}</Link>
          {countrySlug && countryBestForPages.filter((x) => x.slug !== intent.slug).slice(0, 6).map((x) => <Link key={x.slug} to={LEGACY_TOPIC_TO_NEW[x.slug] ? `/${countrySlug}/${LEGACY_TOPIC_TO_NEW[x.slug]}` : `/countries/${countrySlug}/best/${x.slug}`} className="rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-400">More: {x.title}</Link>)}
        </div>
      </section>

      {/* criteria */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">How we ranked this list</p>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {intent.criteria.map((c) => (
            <li key={c} className="flex gap-2.5 text-sm text-slate-600">
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
              {c}
            </li>
          ))}
        </ul>
      </div>

      {/* ranking — same card design as the homepage */}
      {(countrySlug || localizedCountry) && ranked.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-6" aria-labelledby="country-best-for-pending">
          <h2 id="country-best-for-pending" className="font-display text-xl font-bold text-ink-950">Country-specific recommendations are being finalized</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">PipRank does not display global broker rankings on this country page until country-specific broker eligibility and recommendations have been configured.</p>
          <Link to={`/${countrySlug}`} className="mt-4 inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-800">See all {country?.name ?? countrySlug} broker information →</Link>
        </section>
      ) : (
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {ranked.map((b, i) => (
          <Reveal key={b.slug} delay={Math.min(i, 5) * 0.05}>
            <BrokerCard broker={b} rank={i + 1} note={reasonFor(intent.slug, b)} intent={intent.slug} countrySlug={countrySlug ?? localizedCountry?.slug} />
          </Reveal>
        ))}
      </div>
      )}

      {richContent?.published && (richContent.html || (Array.isArray(richContent.blocks) && richContent.blocks.length)) ? (
        <div className="prose prose-slate mt-10 max-w-none prose-headings:font-display prose-img:rounded-2xl prose-table:w-full prose-th:border prose-th:border-line prose-th:bg-paper prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-line prose-td:px-3 prose-td:py-2" dangerouslySetInnerHTML={{ __html: Array.isArray(richContent.blocks) && richContent.blocks.length ? blocksToHtml(richContent.blocks as any) : richContent.html }} />
      ) : (
        'sections' in intent && Array.isArray(intent.sections) && intent.sections.length > 0 && (
          <div className="mt-10 space-y-6">
            {intent.sections.map((section, i) => (
              <section key={`${section.heading}-${i}`} className="rounded-2xl border border-line bg-white p-6">
                <h2 className="font-display text-xl font-bold text-ink-900">{section.heading}</h2>
                {section.body?.map((p, pi) => <p key={pi} className="mt-3 text-sm leading-7 text-slate-600">{p}</p>)}
                {section.bullets?.length ? <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{section.bullets.map((b, bi) => <li key={bi}>{b}</li>)}</ul> : null}
              </section>
            ))}
          </div>
        )
      )}

      {'faqs' in intent && Array.isArray(intent.faqs) && intent.faqs.length > 0 && (
        <section className="mt-10 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-display text-xl font-bold text-ink-900">Frequently Asked Questions</h2>
          <div className="mt-4 divide-y divide-line">
            {intent.faqs.map((faq, i) => (
              <details key={`${faq.q}-${i}`} className="py-4">
                <summary className="cursor-pointer text-sm font-bold text-ink-900">{faq.q}</summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {!countrySlug && countries.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-white p-6" aria-labelledby="country-variants">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Local versions</p>
          <h2 id="country-variants" className="mt-1 font-display text-xl font-bold text-ink-900">Best {intent.title.toLowerCase()} by country</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {countries.slice(0, 12).map((c) => <Link key={c.slug} to={`/${c.slug}`} className="rounded-full border border-line bg-paper px-3.5 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-ink-900">{c.name}</Link>)}
          </div>
        </section>
      )}

      {/* also reviewed */}
      {rest.length > 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-line p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Also reviewed, but didn't make this list
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rest.map((b) => (
              <Link
                key={b.slug}
                to={`/brokers/${b.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-ink-900 hover:text-ink-900"
              >
                <Monogram name={b.name} logoUrl={b.logo_url} color={b.brand_color} size={18} className="rounded-md" />
                {b.name}
                <ArrowRight size={11} className="text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
