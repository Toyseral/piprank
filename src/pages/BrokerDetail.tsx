import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  FlaskConical,
  Landmark,
  Loader2,
  MapPin,
  MessageSquare,
  Scale,
  ShieldCheck,
  ThumbsUp,
  X,
} from 'lucide-react';
import type { Broker, BrokerContent, BrokerCountryAvailability, BrokerCountryVerification, PlatformDetail, Review, ContentDocument } from '../lib/types';
import { createReview, fetchBroker, fetchBrokerAvailability, fetchBrokerContent, fetchBrokers, fetchBrokerVerification, fetchReviews, fetchContentDocument, voteHelpful } from '../lib/api';
import { blocksToHtml, hasVisualContent } from '../components/PageBuilder';
import { track } from '../lib/track';
import { getSupabase } from '../lib/supabase-lazy';
import { useSEO } from '../hooks/useSEO';
import { brokerSeo, buildBreadcrumbJsonLd, buildWebPageJsonLd, buildFAQPageJsonLd, absoluteUrl } from '../lib/seo';
import BrokerCard from '../components/BrokerCard';
import HealthRing from '../components/HealthRing';
import Monogram from '../components/Monogram';
import Stars from '../components/Stars';
import VisitButton from '../components/VisitButton';
import { btnCls } from '../components/Button';
import { fmtHours, fmtMoney, ratingWord, timeAgo } from '../lib/format';
import { allInCost, healthScore, pipRankBreakdown, pipRankScore, scoreColors, tierLabel } from '../lib/score';
import { reviewerFor } from '../lib/team';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'fees', label: 'Fees & spreads' },
  { id: 'regulation', label: 'Regulation' },
  { id: 'platforms', label: 'Platforms' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'funding', label: 'Deposits & withdrawals' },
  { id: 'community', label: 'Community' },
  { id: 'faq', label: 'FAQ' },
];

const HEALTH_LABELS: [keyof Broker['health'], string][] = [
  ['regulation', 'Regulation quality'],
  ['withdrawals', 'Withdrawal reliability'],
  ['execution', 'Execution quality'],
  ['longevity', 'Years in business'],
  ['support', 'Customer support'],
  ['sentiment', 'User sentiment'],
];

export default function BrokerDetail() {
  const { slug, countrySlug } = useParams<{ slug: string; countrySlug?: string }>();
  const navigate = useNavigate();
  const [broker, setBroker] = useState<Broker | null>(null);
  const [all, setAll] = useState<Broker[]>([]);
  const [availability, setAvailability] = useState<BrokerCountryAvailability[]>([]);
  const [verifications, setVerifications] = useState<BrokerCountryVerification[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [extras, setExtras] = useState<BrokerContent | null>(null);
  const [richProfile, setRichProfile] = useState<ContentDocument | null>(null);
  const [platformTab, setPlatformTab] = useState(0);
  const [auth, setAuth] = useState<{ email: string; token: string } | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [stickyShown, setStickyShown] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [stickyClosed, setStickyClosed] = useState(() => {
    try {
      return sessionStorage.getItem(`piprank_sticky_${slug}`) === '1';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState(0);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [voted, setVoted] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('piprank_voted') ?? '[]');
    } catch {
      return [];
    }
  });
  // review form
  const [form, setForm] = useState({ author: '', country: '', rating: 5, title: '', body: '' });
  const [formErr, setFormErr] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formDone, setFormDone] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    setFormDone(false);
    setExtras(null);
    setAvailability([]);
    setPlatformTab(0);
    fetchBroker(slug)
      .then((b) => {
        setBroker(b);
        fetchReviews(b.id).then(setReviews).catch(() => {});
        fetchBrokerContent(b.id).then(setExtras).catch(() => setExtras(null));
        fetchContentDocument(`broker:${b.slug}:main`).then(content => setRichProfile(content?.published ? content : null)).catch(() => setRichProfile(null));
        fetchBrokers().then(setAll).catch(() => {});
        if (countrySlug) {
          fetchBrokerAvailability(b.id).then(setAvailability).catch(() => setAvailability([]));
          fetchBrokerVerification(b.id, countrySlug).then(setVerifications).catch(() => setVerifications([]));
        } else {
          setAvailability([]);
          setVerifications([]);
        }
        track('broker_view', { broker: b.slug, name: b.name });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Broker not found'))
      .finally(() => setLoading(false));
  }, [slug, countrySlug]);

  // Full page metadata (title, description, canonical, OG, Twitter, JSON-LD).
  // useSEO is a no-op while seoInput is null (loading / not found); the
  // previous page's tags simply remain until this resolves, then update.
  const reviewer = useMemo(() => reviewerFor(broker?.slug ?? slug ?? ''), [broker, slug]);
  const profileSettings = (richProfile?.settings ?? {}) as Record<string, any>;
  const seoInput = broker ? { ...brokerSeo(broker), title: richProfile?.seo_title || brokerSeo(broker).title, description: richProfile?.seo_description || brokerSeo(broker).description } : null;
  useSEO(
    seoInput,
    broker
      ? [
          { ...buildWebPageJsonLd(seoInput!), author: { '@type': 'Person', name: reviewer.penName, jobTitle: reviewer.role, url: absoluteUrl(`/authors#${reviewer.slug}`) } },
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Brokers', path: '/brokers' },
            { name: broker.name, path: `/brokers/${broker.slug}` },
          ]),
          ...((profileSettings.faqs?.length || broker.faqs?.length || extras?.faqs?.length) ? [buildFAQPageJsonLd((profileSettings.faqs?.length ? profileSettings.faqs : [...(broker.faqs ?? []), ...(extras?.faqs ?? [])]).map((f:any) => ({ question: f.q, answer: f.a })))] : []),
        ]
      : undefined,
  );

  // Identity for the verified-review badge. Deferred until the browser is idle
  // (or after a short fallback delay) so the Supabase client — only needed for
  // this optional feature — doesn't compete with initial page-load resources.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      const supabase = await getSupabase();
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setAuth(data.session ? { email: data.session.user.email ?? '', token: data.session.access_token } : null);
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
        setAuth(s ? { email: s.user.email ?? '', token: s.access_token } : null);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    };

    const ric = (window as any).requestIdleCallback as ((cb: () => void) => number) | undefined;
    const handle = ric ? ric(init) : window.setTimeout(init, 1500);

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (ric && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  // Sticky mobile CTA: appears once the hero scrolls out of view; stays closed if dismissed.
  useEffect(() => {
    const onScroll = () => {
      setStickyShown(window.scrollY > 560);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Active-tab tracking: highlights the tab whose section is currently in view.
  useEffect(() => {
    if (!broker) return;
    const sections = TABS.map((t) => document.getElementById(t.id)).filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveTab(visible[0].target.id);
      },
      { rootMargin: '-112px 0px -70% 0px', threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [broker]);

  const closeSticky = () => {
    setStickyClosed(true);
    try {
      sessionStorage.setItem(`piprank_sticky_${slug}`, '1');
    } catch {
      /* private mode */
    }
  };

  const alternatives = useMemo(() => {
    if (!broker) return [];
    const rel = all.filter(
      (o) => o.slug !== broker.slug && o.best_for.some((s) => broker.best_for.includes(s))
    );
    const pool = rel.length >= 3 ? rel : [...rel, ...all.filter((o) => o.slug !== broker.slug && !rel.includes(o))];
    return pool.slice(0, 3);
  }, [all, broker]);

  const medianSpread = useMemo(() => {
    if (all.length === 0) return 0;
    const s = [...all].map((b) => b.spread_eurusd).sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  }, [all]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-6 h-56 animate-pulse rounded-3xl border border-line bg-white" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
            <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
          </div>
          <div className="h-96 animate-pulse rounded-2xl border border-line bg-white" />
        </div>
      </div>
    );
  }

  if (error || !broker) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <p className="font-display text-4xl font-bold text-ink-900">Broker not found</p>
        <p className="mt-3 text-slate-500">{error || "We couldn't find that broker in our database."}</p>
        <Link
          to="/brokers"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white"
        >
          <ArrowLeft size={15} /> Browse all brokers
        </Link>
      </div>
    );
  }

  const hs = healthScore(broker);
  const tone = scoreColors(broker.trust_score);
  const tierOneCount = broker.regulations.filter((r) => r.tier === 1).length;

  const helpful = async (id: number) => {
    if (voted.includes(id)) return;
    try {
      const updated = await voteHelpful(id);
      setReviews((rs) => rs.map((r) => (r.id === id ? updated : r)));
      const next = [...voted, id];
      setVoted(next);
      localStorage.setItem('piprank_voted', JSON.stringify(next));
    } catch {
      /* silent — vote stays unregistered */
    }
  };

  const submitReview = async (e: FormEvent) => {
    e.preventDefault();
    setFormErr('');
    if (form.author.trim().length < 2) return setFormErr('Please add your name.');
    if (form.title.trim().length < 4) return setFormErr('Please give your review a short title.');
    if (form.body.trim().length < 20) return setFormErr('Tell us a bit more — at least 20 characters.');
    setFormBusy(true);
    try {
      const created = await createReview(
        {
          broker_id: broker.id,
          author: form.author.trim(),
          country: form.country.trim() || 'Not specified',
          rating: form.rating,
          title: form.title.trim(),
          body: form.body.trim(),
        },
        auth?.token
      );
      setReviews((rs) => [created, ...rs]);
      setForm({ author: '', country: '', rating: 5, title: '', body: '' });
      setFormDone(true);
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Could not post your review.');
    } finally {
      setFormBusy(false);
    }
  };

  const boolIcon = (ok: boolean) =>
    ok ? (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check size={12} strokeWidth={3} />
      </span>
    ) : (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <X size={12} strokeWidth={3} />
      </span>
    );

  const platformContent: PlatformDetail[] = broker.platforms.map(
    (name) =>
      extras?.platforms?.find((p) => p.name === name) ?? {
        name,
        summary: `${name} is available at ${broker.name} with the broker's standard pricing and conditions.`,
        features: [],
      }
  );
  const activePlatform = platformContent[Math.min(platformTab, platformContent.length - 1)] ?? platformContent[0];
  const countryAvailabilityBadge = countrySlug
    ? verifications.find(
        (verification) =>
          verification.country_slug === countrySlug &&
          verification.availability_verified &&
          availability.some(
            (entry) => entry.country_slug === countrySlug && entry.status === 'available'
          )
      )
    : null;


  const accountRows = extras?.accounts?.length
    ? extras.accounts
    : broker.account_types.map((n) => ({
        name: n,
        spread_from: `${broker.spread_eurusd} pips`,
        commission: broker.commission,
        min_deposit: fmtMoney(broker.min_deposit),
        best_for: 'Standard conditions',
      }));

  const assetBars = [
    { label: 'Forex pairs', value: broker.assets.forex },
    { label: 'Stock CFDs', value: broker.assets.stocks },
    { label: 'Crypto', value: broker.assets.crypto },
    { label: 'Commodities', value: broker.assets.commodities },
    { label: 'Indices', value: broker.assets.indices },
  ];
  const maxAsset = Math.max(...assetBars.map((a) => a.value), 1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Link to="/" className="transition hover:text-ink-900">Home</Link>
        <span>/</span>
        <Link to="/brokers" className="transition hover:text-ink-900">Brokers</Link>
        <span>/</span>
        <span className="text-ink-900">{broker.name}</span>
      </nav>

      {/* ============ HEADER CARD ============ */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-line bg-white shadow-soft">
        <div className="relative overflow-hidden bg-ink-950 px-6 py-8 sm:px-8">
          <div className="absolute inset-0 bg-grid-dark" />
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-500/20 blur-[110px]" />
          <div className="relative flex flex-wrap items-start gap-5">
            <Monogram
              name={broker.name}
              logoUrl={broker.logo_url}
              color={broker.brand_color}
              size={72}
              className="rounded-2xl ring-2 ring-white/20 shadow-lg shadow-black/30"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {broker.name} <span className="font-medium text-slate-400">Review</span>
                </h1>
                {tierOneCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                    <ShieldCheck size={13} /> Tier-1 regulated
                  </span>
                )}
                {countryAvailabilityBadge?.country_name && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-200">
                    <BadgeCheck size={13} /> {countryAvailabilityBadge.country_name} availability verified
                  </span>
                )}
              </div>
              <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-400">
                {broker.tagline}
                <span className="hidden items-center gap-1 sm:inline-flex">
                  · <MapPin size={12} /> {broker.headquarters} · est. {broker.founded}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/20">PipRank Score {pipRankScore(broker)}/100</span>
                <Stars value={broker.rating} size={16} />
                <span className="tnum font-display text-xl font-bold text-white">{broker.rating.toFixed(1)}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${tone.bg} ${tone.border} ${tone.text}`}>
                  {ratingWord(broker.rating)}
                </span>
              </div>
              <div className="mt-4 sm:max-w-xs">
                <VisitButton broker={broker} className="w-full" />
              </div>
            </div>
          </div>

          <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-6 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { l: 'Trust score', v: `${broker.trust_score}/100` },
              { l: 'Min deposit', v: fmtMoney(broker.min_deposit) },
              { l: 'EUR/USD spread', v: `${broker.spread_eurusd} pips` },
              { l: 'Commission', v: broker.commission_value === 0 ? 'None' : `$${broker.commission_value}/lot` },
              { l: 'Platforms', v: broker.platforms.slice(0, 2).join(' · ') || '—' },
              { l: 'Withdrawal', v: `~${fmtHours(broker.withdrawal_hours)}` },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.l}</p>
                <p className="tnum mt-1 font-display text-lg font-bold text-emerald-300">{s.v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* tab bar */}
        <div className="flex gap-1 overflow-x-auto border-b border-line bg-white px-4 py-2 scrollbar-none sm:px-6">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              aria-current={activeTab === t.id ? 'true' : undefined}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                activeTab === t.id
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-800'
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>

      <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 sm:p-6" aria-labelledby="why-piprank-recommends">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Decision summary</p><h2 id="why-piprank-recommends" className="mt-1 font-display text-xl font-bold text-ink-900">Why PipRank recommends {broker.name}</h2></div>
          <p className="tnum font-display text-2xl font-bold text-emerald-700">{pipRankScore(broker)}<span className="text-xs font-semibold text-slate-400">/100</span></p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(pipRankBreakdown(broker)).map(([label, value]) => <div key={label} className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-emerald-100"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="tnum mt-0.5 font-display text-lg font-bold text-ink-900">{value}</p></div>)}
        </div>
        {extras?.why_recommend?.length ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{extras.why_recommend.slice(0,4).map((p,i)=><li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600"/>{p}</li>)}</ul> : <p className="mt-4 text-sm leading-relaxed text-slate-600">{broker.tagline}. PipRank's score combines trust, broker health, trading costs, accessibility and overall rating to summarize decision fit.</p>}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* ================= MAIN COLUMN ================= */}
        <div className="min-w-0 space-y-10">
          {/* OVERVIEW */}
          <section id="overview" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-ink-900">Our {broker.name} review</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Monogram name={reviewer.penName} color={reviewer.color} size={22} />
              <span>
                Reviewed by{' '}
                <Link to={`/authors#${reviewer.slug}`} className="font-semibold text-ink-900 hover:text-emerald-700">
                  {reviewer.penName}
                </Link>
                , {reviewer.role}
              </span>
              {broker.updated_at && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Updated {timeAgo(broker.updated_at)}</span>
                </>
              )}
            </div>
            <div className="prose-sm mt-4 space-y-4 text-[15px] leading-relaxed text-slate-600">
              {broker.review.map((p, i) => (<p key={i}>{p}</p>))}
              {extras?.overview?.map((p, i) => <p key={`extra-overview-${i}`}>{p}</p>)}
              {richProfile?.published && richProfile.html ? <div className="mt-5 prose prose-slate max-w-none prose-headings:font-display prose-img:rounded-2xl prose-table:w-full prose-th:border prose-th:border-line prose-th:bg-paper prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-line prose-td:px-3 prose-td:py-2" dangerouslySetInnerHTML={{__html: (hasVisualContent(richProfile.blocks) ? blocksToHtml(richProfile.blocks as any) : richProfile.html)}} /> : null}
              {Array.isArray(profileSettings.internalLinks) && profileSettings.internalLinks.length > 0 && <div className="mt-8 border-t border-line pt-6"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Related PipRank pages</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{profileSettings.internalLinks.map((link:any,i:number)=><Link key={i} to={link.href} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-900 hover:border-emerald-300 hover:bg-emerald-50">{link.label}</Link>)}</div></div>}
            </div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">What we like</p>
                <ul className="mt-3 space-y-2.5">
                  {broker.pros.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm text-slate-700">
                      <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-600">Watch out for</p>
                <ul className="mt-3 space-y-2.5">
                  {broker.cons.map((c) => (
                    <li key={c} className="flex gap-2.5 text-sm text-slate-700">
                      <X size={16} className="mt-0.5 shrink-0 text-rose-500" strokeWidth={3} />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* QUICK VERDICT */}
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">PipRank verdict</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">Is {broker.name} right for you?</h2>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PipRank score</p>
                <p className="tnum mt-0.5 font-display text-2xl font-bold text-emerald-700">{broker.trust_score}/100</p>
              </div>
            </div>
            <div className="mt-4 max-w-3xl space-y-3 text-[15px] leading-relaxed text-slate-700">
              <p>{broker.tagline}. {broker.best_for?.length ? `PipRank lists ${broker.name} for ${broker.best_for.slice(0, 3).join(', ')}.` : `Review the costs, regulation, platforms and account features below before deciding.`}</p>
              {extras?.verdict?.map((p, i) => <p key={`verdict-${i}`}>{p}</p>)}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {broker.best_for.slice(0, 6).map((item) => (
                <div key={item} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-emerald-100">Best for {item}</div>
              ))}
            </div>
            <div className="mt-5">
              <VisitButton broker={broker} className="w-full" />
            </div>
          </section>

          {extras?.why_recommend?.length ? <section className="rounded-3xl border border-line bg-white p-6 sm:p-8"><h2 className="font-display text-2xl font-bold text-ink-900">Why PipRank recommends {broker.name}</h2><div className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">{extras.why_recommend.map((p,i)=><p key={i}>{p}</p>)}</div></section> : null}
          {extras?.avoid_if?.length ? <section className="rounded-3xl border border-rose-200 bg-rose-50/50 p-6 sm:p-8"><h2 className="font-display text-2xl font-bold text-ink-900">Consider alternatives if…</h2><ul className="mt-4 space-y-2.5">{extras.avoid_if.map((p,i)=><li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700"><X size={15} className="mt-0.5 shrink-0 text-rose-500"/>{p}</li>)}</ul></section> : null}

          {/* WHO SHOULD CHOOSE */}
          <section className="rounded-3xl border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-ink-900">Who should choose {broker.name}?</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                <h3 className="font-display text-lg font-bold text-ink-900">A good fit if you need</h3>
                <ul className="mt-3 space-y-2.5">
                  {broker.pros.slice(0, 5).map((p) => <li key={p} className="flex gap-2 text-sm leading-relaxed text-slate-700"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />{p}</li>)}
                </ul>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
                <h3 className="font-display text-lg font-bold text-ink-900">Consider alternatives if</h3>
                <ul className="mt-3 space-y-2.5">
                  {broker.cons.slice(0, 5).map((c) => <li key={c} className="flex gap-2 text-sm leading-relaxed text-slate-700"><X size={15} className="mt-0.5 shrink-0 text-rose-500" />{c}</li>)}
                </ul>
              </div>
            </div>
          </section>

          {/* FEES */}
          <section id="fees" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl font-bold text-ink-900">Fees & spread analysis</h2>{extras?.fees_detail?.length ? <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">{extras.fees_detail.map((p,i)=><p key={i}>{p}</p>)}</div> : null}
              <span className="tnum text-sm font-bold text-emerald-600">
                All-in EUR/USD cost: {allInCost(broker)} pips / lot
              </span>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-line">
              {[
                { l: 'EUR/USD typical spread', v: `${broker.spread_eurusd} pips`, note: `Category median: ${medianSpread} pips` },
                { l: 'Commission (per lot, round trip)', v: broker.commission_value === 0 ? 'None — spread-only pricing' : `$${broker.commission_value.toFixed(2)}` },
                { l: 'All-in cost per standard lot', v: `${allInCost(broker)} pips ≈ $${(allInCost(broker) * 10).toFixed(2)}`, hot: true },
                { l: 'Minimum deposit', v: fmtMoney(broker.min_deposit) },
                { l: 'Withdrawal fee', v: broker.withdrawal_fee === 0 ? 'Free (most methods)' : `$${broker.withdrawal_fee} on some methods` },
                { l: 'Inactivity fee', v: broker.inactivity_fee },
                { l: 'Account types', v: broker.account_types.join(', ') },
              ].map((row, i) => (
                <div
                  key={row.l}
                  className={`flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
                    i % 2 === 0 ? 'bg-paper/70' : 'bg-white'
                  } ${row.hot ? 'border-l-4 border-l-emerald-500' : ''}`}
                >
                  <span className="text-sm font-medium text-slate-500">{row.l}</span>
                  <span className="text-sm font-bold text-ink-900">
                    {row.v}
                    {row.note && <span className="ml-2 text-xs font-medium text-slate-400">{row.note}</span>}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* REGULATION */}
          <section id="regulation" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-ink-900">Regulation & safety</h2>{extras?.regulation_detail?.length ? <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">{extras.regulation_detail.map((p,i)=><p key={i}>{p}</p>)}</div> : null}
            <div className="mt-5 overflow-hidden rounded-2xl border border-line">
              <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-line bg-ink-950 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 sm:grid-cols-[1fr_1fr_auto]">
                <span>Regulator</span>
                <span className="hidden sm:block">Jurisdiction</span>
                <span>Licence tier</span>
              </div>
              {broker.regulations.map((r) => (
                <div
                  key={r.body}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 px-5 py-3.5 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <span className="flex items-center gap-2.5">
                    <Landmark size={16} className="shrink-0 text-slate-400" />
                    <span>
                      <span className="block text-sm font-bold text-ink-900">{r.body}</span>
                      <span className="text-xs text-slate-400 sm:hidden">{r.country}</span>
                    </span>
                  </span>
                  <span className="hidden text-sm text-slate-500 sm:block">{r.country}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      r.tier === 1
                        ? 'bg-emerald-100 text-emerald-700'
                        : r.tier === 2
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tierLabel(r.tier)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { l: 'Negative balance protection', ok: broker.nbp },
                { l: 'Segregated client funds', ok: broker.segregated },
                { l: 'Hedging allowed', ok: broker.hedging },
                { l: 'Scalping allowed', ok: broker.scalping },
              ].map((f) => (
                <div key={f.l} className="flex items-center gap-2.5 rounded-xl border border-line bg-paper px-3.5 py-3">
                  {boolIcon(f.ok)}
                  <span className="text-xs font-semibold leading-tight text-slate-600">{f.l}</span>
                </div>
              ))}
            </div>
          </section>

          {/* PLATFORMS */}
          <section id="platforms" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-ink-900">
              Trading platforms at {broker.name}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {broker.copy_trading && (
                <span className="rounded-xl bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-700">
                  Copy trading built in
                </span>
              )}
              {broker.islamic_account && (
                <span className="rounded-xl bg-violet-100 px-3.5 py-2 text-xs font-bold text-violet-700">
                  Islamic / swap-free accounts
                </span>
              )}
            </div>

            {/* platform tab bar */}
            <div className="mt-5 flex gap-1 overflow-x-auto border-b border-line scrollbar-none">
              {platformContent.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => setPlatformTab(i)}
                  className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold transition ${
                    i === platformTab
                      ? 'border-emerald-600 text-ink-900'
                      : 'border-transparent text-slate-400 hover:text-ink-900'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* active platform panel */}
            {activePlatform && (
              <div className="mt-5 rounded-2xl border border-line bg-paper p-5 sm:p-6">
                <h3 className="font-display text-lg font-bold text-ink-900">
                  {broker.name} on {activePlatform.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{activePlatform.summary}</p>
                {activePlatform.features.length > 0 && (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                    {activePlatform.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-semibold leading-snug text-slate-700 ring-1 ring-line">
                        <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { l: 'Median execution', v: `${broker.execution_ms} ms` },
                { l: 'Platform uptime (90d)', v: `${broker.uptime}%` },
                { l: 'Tradable symbols', v: Object.values(broker.assets).reduce((a, b) => a + b, 0).toLocaleString() },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-paper p-4 text-center">
                  <p className="tnum font-display text-xl font-bold text-ink-900 sm:text-2xl">{s.v}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              {assetBars.map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs font-semibold text-slate-500">{bar.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${Math.max(4, (bar.value / maxAsset) * 100)}%` }}
                    />
                  </div>
                  <span className="tnum w-12 text-right text-xs font-bold text-ink-900">{bar.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ACCOUNT TYPES */}
          <section id="accounts" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2.5">
              <Landmark size={20} className="text-emerald-600" />
              <h2 className="font-display text-2xl font-bold text-ink-900">Account types</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Every retail account on offer, with the real pricing profile for each.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {accountRows.map((a) => (
                <div key={a.name} className="rounded-2xl border border-line bg-paper p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-base font-bold text-ink-900">{a.name}</p>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                      {a.best_for}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {[
                      ['Spread from', a.spread_from],
                      ['Min deposit', a.min_deposit],
                      ['Commission', a.commission],
                    ].map(([l, v]) => (
                      <div key={l} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">{l}</span>
                        <span className="tnum text-right text-sm font-bold text-ink-900">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* DEPOSITS & WITHDRAWALS */}
          <section id="funding" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2.5">
              <FlaskConical size={20} className="text-emerald-600" />
              <h2 className="font-display text-2xl font-bold text-ink-900">
                Deposits & withdrawals, lab-tested
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Measured by our desk over a 5-trading-day cycle with a standard live account.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {broker.testing.map((t) => (
                <div key={t.label} className="rounded-2xl border border-line bg-paper p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t.label}</p>
                  <p className="tnum mt-1 font-display text-2xl font-bold text-ink-900">{t.result}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-7">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                Deposits & withdrawals by method
              </p>
              {extras?.payments?.length ? (
                <div className="mt-3 overflow-x-auto overflow-y-hidden rounded-2xl border border-line">
                  <div className="min-w-[520px]">
                  <div className="grid grid-cols-[1.1fr_1fr_1.2fr_auto] gap-2 border-b border-line bg-ink-950 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:px-5">
                    <span>Method</span>
                    <span>Deposit</span>
                    <span>Withdrawal</span>
                    <span className="text-right">Fee</span>
                  </div>
                  {extras.payments.map((p, i) => (
                    <div
                      key={p.method}
                      className={`grid grid-cols-[1.1fr_1fr_1.2fr_auto] items-center gap-2 px-4 py-3.5 sm:px-5 ${
                        i % 2 === 0 ? 'bg-paper/60' : 'bg-white'
                      }`}
                    >
                      <span className="text-xs font-bold text-ink-900 sm:text-sm">{p.method}</span>
                      <span className="tnum text-xs text-slate-600">{p.deposit}</span>
                      <span className="tnum text-xs text-slate-600">{p.withdrawal}</span>
                      <span className="text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            p.fee.toLowerCase().includes('free')
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {p.fee}
                        </span>
                      </span>
                    </div>
                  ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {broker.payments.map((p) => (
                    <span key={p} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600">
                      {p}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Deposits: {broker.deposit_time} · Measured average withdrawal: ~{fmtHours(broker.withdrawal_hours)}
                {broker.bonus ? ` · Active promotion: ${broker.bonus}` : ''}
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-ink-900">{broker.name} FAQs</h2>
            <div className="mt-5 space-y-2.5">
              {(Array.isArray(profileSettings.faqs) && profileSettings.faqs.length ? profileSettings.faqs : broker.faqs).map((f:any, i:number) => (
                <div key={f.q} className="overflow-hidden rounded-2xl border border-line">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-bold text-ink-900">{f.q}</span>
                    <ChevronDown
                      size={17}
                      className={`shrink-0 text-slate-400 transition ${openFaq === i ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaq === i && (
                    <p className="border-t border-line bg-paper px-5 py-4 text-sm leading-relaxed text-slate-600">
                      {f.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

{/* COMMUNITY */}
          <section id="community" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <button
              type="button"
              onClick={() => setReviewsExpanded((v) => !v)}
              className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
              aria-expanded={reviewsExpanded}
            >
              <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold text-ink-900">
                <MessageSquare size={20} className="text-emerald-600" />
                Trader reviews <span className="tnum text-slate-400">({reviews.length})</span>
              </h2>
              <ChevronDown
                size={20}
                className={`shrink-0 text-slate-400 transition ${reviewsExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {reviewsExpanded && (
            <>
            <div className="mt-5 space-y-4">
              {reviews.length === 0 && (
                <p className="rounded-2xl border border-dashed border-line bg-paper p-6 text-center text-sm text-slate-500">
                  No community reviews yet — be the first to share your experience.
                </p>
              )}
              {reviews.map((r) => (
                <article key={r.id} className="rounded-2xl border border-line bg-paper/60 p-5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">
                      {r.author.trim()[0]?.toUpperCase()}
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                        {r.author}
                        {r.verified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                            <BadgeCheck size={10} /> Verified trader
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {r.country} · {timeAgo(r.created_at)}
                      </p>
                    </div>
                    <Stars value={r.rating} size={13} />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-ink-900">{r.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{r.body}</p>
                  <button
                    onClick={() => helpful(r.id)}
                    disabled={voted.includes(r.id)}
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      voted.includes(r.id)
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-line bg-white text-slate-500 hover:border-emerald-400 hover:text-emerald-700'
                    }`}
                  >
                    <ThumbsUp size={12} />
                    Helpful <span className="tnum">({r.helpful})</span>
                  </button>
                </article>
              ))}
            </div>

            {/* form */}
            <div className="mt-6 rounded-2xl border border-line bg-paper p-5 sm:p-6">
              <p className="font-display text-lg font-bold text-ink-900">Share your experience</p>

              {/* verified-identity strip */}
              {auth ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck size={14} className="text-emerald-600" />
                    Posting as verified account {auth.email} — your review gets the Verified trader badge
                  </span>
                  <button
                    onClick={() => getSupabase().then((sb) => sb.auth.signOut())}
                    className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-line bg-white p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-ink-900">
                    <BadgeCheck size={14} className="text-emerald-600" />
                    Sign in for the Verified trader badge
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Optional — links your review to an account so readers know it isn&apos;t a drive-by.
                  </p>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      className="h-10 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500"
                    />
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Password (6+ chars)"
                      className="h-10 rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={async () => {
                        setAuthBusy(true);
                        setAuthErr('');
                        const email = authForm.email.trim();
                        const password = authForm.password;
                        const sb = await getSupabase();
                        const { error: err } =
                          authMode === 'signin'
                            ? await sb.auth.signInWithPassword({ email, password })
                            : await sb.auth.signUp({ email, password });
                        if (err) setAuthErr(err.message);
                        setAuthBusy(false);
                      }}
                      className={btnCls('dark', 'sm', 'h-10')}
                    >
                      {authBusy && <Loader2 size={13} className="animate-spin" />}
                      {authMode === 'signin' ? 'Sign in' : 'Create account'}
                    </button>
                  </div>
                  {authErr && <p className="mt-2 text-xs font-medium text-rose-600">{authErr}</p>}
                  <button
                    type="button"
                    onClick={() => setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
                    className="mt-2 text-[11px] font-semibold text-slate-500 underline-offset-2 hover:underline"
                  >
                    {authMode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
                  </button>
                </div>
              )}
              {formDone ? (
                <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <Check size={16} /> Thanks — your review is live below.
                </p>
              ) : (
                <form onSubmit={submitReview} className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input
                      value={form.author}
                      onChange={(e) => setForm({ ...form, author: e.target.value })}
                      placeholder="Your name"
                      className="h-11 rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-emerald-500"
                    />
                    <input
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      placeholder="Country (optional)"
                      className="h-11 rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-emerald-500"
                    />
                    <select
                      value={form.rating}
                      onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                      className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} star{n === 1 ? '' : 's'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder={'Review title — e.g. "Fast withdrawals, sharp spreads"'}
                    className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-emerald-500"
                  />
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder="How were the spreads, platform and payouts? (min 20 characters)"
                    rows={4}
                    className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-500"
                  />
                  {formErr && <p className="text-sm font-medium text-rose-600">{formErr}</p>}
                  <button type="submit" disabled={formBusy} className={btnCls('dark', 'md')}>
                    {formBusy && <Loader2 size={15} className="animate-spin" />}
                    Post review
                  </button>
                </form>
              )}
            </div>
            </>
            )}
          </section>


          {/* METHODOLOGY */}
          <section id="methodology" className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-ink-900">How PipRank evaluates {broker.name}</h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-600">
              PipRank separates broker facts from its own analysis. The profile considers regulation, withdrawal reliability, execution, longevity, customer support and user sentiment, alongside trading costs and platform features.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HEALTH_LABELS.map(([key, label]) => (
                <div key={key} className="rounded-2xl border border-line bg-paper p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
                  <p className="tnum mt-1 font-display text-xl font-bold text-ink-900">{broker.health[key]}/100</p>
                </div>
              ))}
            </div>
            <Link to="/methodology" className="mt-5 inline-flex text-sm font-bold text-emerald-700 underline-offset-2 hover:underline">Read the full PipRank methodology →</Link>
          </section>

          {/* ALTERNATIVES */}
          <section>
            <h2 className="font-display text-2xl font-bold text-ink-900">
              Alternatives to {broker.name}
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {alternatives.map((b) => (
                <BrokerCard key={b.slug} broker={b} />
              ))}
            </div>
          </section>
        </div>

        {/* ================= SIDEBAR ================= */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-soft">
            <div className="flex items-center gap-4">
              <HealthRing score={hs} size={76} label="Health" />
              <div>
                <p className="font-display text-lg font-bold leading-tight text-ink-900">
                  Broker Health Score
                </p>
                <p className="mt-0.5 text-xs leading-snug text-slate-500">
                  Weighted from 6 measured factors, recomputed monthly
                </p>
              </div>
            </div>
            <Link
              to={`/methodology?from=${broker.slug}`}
              className="mt-2 block text-right text-[11px] font-semibold text-emerald-700 underline-offset-2 transition hover:underline"
            >
              How is this computed? →
            </Link>
            <div className="mt-3 space-y-2.5">
              {HEALTH_LABELS.map(([key, label]) => (
                <div key={key} className="flex items-center gap-2.5">
                  <span className="w-32 shrink-0 text-[11px] font-semibold text-slate-500">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${broker.health[key]}%`,
                        background: scoreColors(broker.health[key]).hex,
                      }}
                    />
                  </div>
                  <span className="tnum w-7 text-right text-[11px] font-bold text-ink-900">
                    {broker.health[key]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <VisitButton broker={broker} className="w-full" />
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-ink-950 p-6">
            <p className="font-display text-base font-bold text-white">Compare {broker.name} with…</p>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) navigate(`/compare?a=${broker.slug}&b=${e.target.value}`);
              }}
              className="mt-3 h-11 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-medium text-white outline-none"
            >
              <option value="" disabled className="text-ink-900">
                Choose a rival broker
              </option>
              {all
                .filter((o) => o.slug !== broker.slug)
                .map((o) => (
                  <option key={o.slug} value={o.slug} className="text-ink-900">
                    {o.name}
                  </option>
                ))}
            </select>
            {all.length > 1 && (
              <nav aria-label="Popular comparisons" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {[...all]
                  .filter((o) => o.slug !== broker.slug)
                  .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                  .slice(0, 3)
                  .map((o) => {
                    const [x, y] = [broker.slug, o.slug].sort();
                    return (
                      <Link key={o.slug} to={`/compare/${x}-vs-${y}`} className="text-teal-400 underline decoration-teal-400/30 underline-offset-2 hover:text-teal-300">
                        {broker.name} vs {o.name}
                      </Link>
                    );
                  })}
              </nav>
            )}
            <div className="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-sm">
              {[
                ['Founded', String(broker.founded)],
                ['Headquarters', broker.headquarters],
                ['Max leverage', broker.max_leverage],
                ['Support', broker.support_channels.join(' · ')],
              ].map(([l, v]) => (
                <div key={l} className="flex items-start justify-between gap-3">
                  <span className="text-xs text-slate-500">{l}</span>
                  <span className="text-right text-xs font-semibold text-slate-200">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ============ STICKY MOBILE CTA BAR ============ */}
      <AnimatePresence>
        {stickyShown && !stickyClosed && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-[70] lg:hidden"
          >
            <div className="border-t border-line bg-white/95 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2.5 shadow-soft-lg backdrop-blur-md">
              <div className="mx-auto flex max-w-3xl items-center gap-2.5">
                <Monogram name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={32} className="rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold leading-tight text-ink-900">{broker.name}</p>
                  <div className="flex items-center gap-1">
                    <Stars value={broker.rating} size={10} />
                    <span className="tnum text-[10px] font-bold text-slate-500">
                      {broker.trust_score}/100 trust
                    </span>
                  </div>
                </div>
                <div className="ml-auto flex-1">
                  <VisitButton broker={broker} compact className="w-full" />
                </div>
                <button
                  onClick={closeSticky}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-paper hover:text-ink-900"
                  aria-label="Close quick action bar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
