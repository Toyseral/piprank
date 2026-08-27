import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  BadgePercent,
  BookOpen,
  CalendarRange,
  Check,
  Copy,
  Crown,
  Gauge,
  GraduationCap,
  Landmark,
  MapPin,
  MonitorSmartphone,
  Moon,
  RotateCcw,
  Scale,
  Server,
  Sparkles,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Broker, CountryPage } from '../lib/types';
import { fetchBrokers, fetchCountry } from '../lib/api';
import { GEO_OPTIONS, getGeo, setGeoPreference } from '../lib/geo';
import { useGeo } from '../lib/GeoContext';
import { track } from '../lib/track';
import { ButtonLink, btnCls } from '../components/Button';
import HealthRing from '../components/HealthRing';
import Monogram from '../components/Monogram';
import Stars from '../components/Stars';
import VisitButton from '../components/VisitButton';
import { allInCost, healthScore, pipRankBreakdown, pipRankScore } from '../lib/score';
import { fmtMoney } from '../lib/format';

type Answers = {
  country: string;
  experience: string;
  style: string;
  platform: string;
  priority: string;
  prefs: string[]; // multi-select: islamic | copy | lowdeposit | highleverage | vps
};

interface Option {
  value: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  flag?: string;
}

interface Question {
  key: keyof Answers;
  label: string;
  title: string;
  subtitle: string;
  /** shown in a small info box — explains why the answer changes the result */
  why: string;
  options: Option[]; // country step gets options injected at runtime
  multi?: boolean;
}

const QUESTIONS: Question[] = [
  {
    key: 'country',
    label: 'Country',
    title: 'Where are you trading from?',
    subtitle: 'Tap your country — we only match brokers that can legally onboard you.',
    why: 'One broker can be brilliant in London and unavailable in Lagos. Regulation, leverage and funding rails all change at the border — so this answer rules brokers in or out entirely.',
    options: [],
  },
  {
    key: 'experience',
    label: 'Experience',
    title: 'How experienced are you?',
    subtitle: 'Be honest — it changes what "safe" and "easy" mean for you.',
    why: 'Beginners get bonus weighting on education, demos and negative-balance protection. Advanced traders get credit toward ECN execution and pro tooling instead.',
    options: [
      { value: 'beginner', label: "I'm just starting", hint: 'New to forex or still on demo', icon: GraduationCap },
      { value: 'intermediate', label: 'I trade a little', hint: 'Live account, small size, still learning', icon: TrendingUp },
      { value: 'advanced', label: 'I trade seriously', hint: 'Consistent live trading, real volume', icon: Crown },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    title: 'How do you like to trade?',
    subtitle: 'Your holding period decides what actually costs you money.',
    why: 'A scalper bleeds on spread and milliseconds; a swing trader bleeds on overnight swaps. The single biggest matching factor there is.',
    options: [
      { value: 'scalping', label: 'Scalping', hint: 'Seconds to minutes, dozens of trades a day', icon: Zap },
      { value: 'day', label: 'Day trading', hint: 'Minutes to hours, flat by the close', icon: TrendingUp },
      { value: 'swing', label: 'Swing trading', hint: 'Positions held for days or weeks', icon: CalendarRange },
      { value: 'copy', label: 'Copy trading', hint: 'Mirror proven traders automatically', icon: Copy },
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    title: 'Which platform do you want?',
    subtitle: 'EAs, layouts and muscle memory don’t transfer — get this right now.',
    why: 'Moving platforms later means rewriting EAs and re-learning charting. If you have no preference, we match on price and safety instead.',
    options: [
      { value: 'MT4', label: 'MetaTrader 4', hint: 'The EA workhorse — old but everywhere', icon: MonitorSmartphone },
      { value: 'MT5', label: 'MetaTrader 5', hint: 'More markets, more timeframes, faster tester', icon: MonitorSmartphone },
      { value: 'cTrader', label: 'cTrader', hint: 'Modern UI with real depth-of-market', icon: Zap },
      { value: 'any', label: 'No preference', hint: 'Whichever platform the winner runs', icon: MonitorSmartphone },
    ],
  },
  {
    key: 'priority',
    label: 'Priority',
    title: "What's your main priority?",
    subtitle: 'The tiebreaker when two brokers are otherwise equal.',
    why: 'Your top-weighted factor. Two brokers can be statistically tied — this one decides your personal winner.',
    options: [
      { value: 'lowcost', label: 'Lowest costs', hint: 'Tight spreads, low commission, no fee creep', icon: BadgePercent },
      { value: 'platform', label: 'Platform & tools', hint: 'Charting, automation, app quality', icon: MonitorSmartphone },
      { value: 'education', label: 'Education & support', hint: 'Courses, hand-holding, fast humans', icon: BookOpen },
      { value: 'leverage', label: 'High leverage', hint: 'Max exposure on a smaller balance', icon: Gauge },
    ],
  },
  {
    key: 'prefs',
    label: 'Extras',
    title: 'Any optional requirements?',
    subtitle: 'Pick all that apply — or skip. Each one boosts brokers that offer it.',
    why: 'Applied as boosts rather than hard filters — except where religion or strategy makes them non-negotiable.',
    options: [
      { value: 'islamic', label: 'Islamic account', hint: 'Certified swap-free trading', icon: Moon },
      { value: 'copy', label: 'Copy trading', hint: 'Built-in, with verified trader stats', icon: Copy },
      { value: 'lowdeposit', label: 'Low minimum deposit', hint: 'Start under $50', icon: Landmark },
      { value: 'highleverage', label: 'High leverage', hint: '1:500 or more where offered', icon: Gauge },
      { value: 'vps', label: 'Free VPS hosting', hint: 'Run EAs 24/7 without your laptop', icon: Server },
    ],
    multi: true,
  },
];

const STEP_COLS = ['Where', 'Level', 'Style', 'Platform', 'Priority', 'Extras'];

// Curated: brokers in our dataset that provide free/discounted VPS hosting for algo traders
const VPS_HOSTS = new Set(['ic-markets', 'pepperstone', 'fp-markets', 'fxpro', 'exness', 'thinkmarkets', 'tmgm', 'vantage']);

function scoreBroker(b: Broker, a: Answers): { score: number; reasons: string[] } {
  let s = 44 + b.rating * 4 + b.trust_score * 0.14;
  const reasons: string[] = [];

  // trading style
  if (a.style === 'scalping') {
    if (b.scalping) { s += 12; reasons.push('Scalping fully allowed'); } else s -= 18;
    if (b.spread_eurusd <= 0.2) { s += 6; reasons.push(`Raw ${b.spread_eurusd}p EUR/USD spread`); }
    if (b.execution_ms <= 35) { s += 4; reasons.push(`${b.execution_ms}ms median execution`); }
  } else if (a.style === 'day') {
    if (b.spread_eurusd <= 0.3) { s += 6; reasons.push(`Tight ${b.spread_eurusd}p spreads all session`); } else s += 1;
  } else if (a.style === 'swing') {
    if (b.best_for.includes('swing-trading')) { s += 8; reasons.push('Strong multi-day conditions'); }
  } else if (a.style === 'copy') {
    if (b.copy_trading) { s += 14; reasons.push('Native copy-trading platform'); } else s -= 12;
  }

  // platform
  if (a.platform !== 'any') {
    if (b.platforms.includes(a.platform)) { s += 9; reasons.push(`${a.platform} supported`); } else s -= 8;
  }

  // main priority
  if (a.priority === 'lowcost') {
    const cost = allInCost(b);
    s += Math.max(0, 13 - cost * 6);
    reasons.push(`${cost} pips all-in per EUR/USD lot`);
  } else if (a.priority === 'platform') {
    s += b.platforms.length * 3;
    reasons.push(`${b.platforms.length} platforms incl. ${b.platforms[0]}`);
  } else if (a.priority === 'education') {
    if (b.best_for.includes('beginners')) { s += 10; reasons.push('Dedicated beginner education'); }
    if (b.demo_account) { s += 3; reasons.push('Free unlimited demo account'); }
  } else if (a.priority === 'leverage') {
    s += b.leverage_value >= 1000 ? 12 : b.leverage_value >= 500 ? 10 : b.leverage_value >= 400 ? 6 : 2;
    reasons.push(`Leverage up to ${b.max_leverage}`);
  }

  // optional preferences — each is a direct boost
  const prefs = a.prefs ?? [];
  if (prefs.includes('islamic')) {
    if (b.islamic_account) { s += 10; reasons.push('Certified swap-free account'); } else s -= 8;
  }
  if (prefs.includes('copy') && a.style !== 'copy') {
    if (b.copy_trading) { s += 10; reasons.push('Built-in copy trading'); } else s -= 6;
  }
  if (prefs.includes('lowdeposit')) {
    if (b.min_deposit <= 50) { s += 8; reasons.push(`Start with ${fmtMoney(Math.max(b.min_deposit, 1)) || '$0'}`); }
    else if (b.min_deposit > 250) s -= 6;
  }
  if (prefs.includes('highleverage') && a.priority !== 'leverage') {
    if (b.leverage_value >= 500) { s += 8; reasons.push(`Leverage up to ${b.max_leverage}`); }
  }
  if (prefs.includes('vps')) {
    if (VPS_HOSTS.has(b.slug)) { s += 8; reasons.push('Free VPS for 24/7 EAs'); }
  }

  // experience multipliers
  if (a.experience === 'beginner') {
    if (b.best_for.includes('beginners')) { s += 7; reasons.unshift('Beginner-friendly onboarding'); }
    if (b.demo_account) s += 2;
  } else if (a.experience === 'advanced') {
    if (b.best_for.includes('ecn')) { s += 6; reasons.push('True ECN execution model'); }
  }

  return { score: s, reasons };
}

const LOADER_LINES = [
  'Checking eligibility in your country…',
  'Scoring all brokers against your style…',
  'Ranking your top matches…',
];

export default function Quiz() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [done, setDone] = useState(false);
  const [geoSlug, setGeoSlug] = useState<string>(getGeo()?.slug ?? '');
  const [country, setCountry] = useState<CountryPage | null>(null);
  const [loaderLine, setLoaderLine] = useState(0);
  const { country: activeGeo } = useGeo();

  useEffect(() => {
    document.title = 'Forex Broker Quiz — Find Your Perfect Broker in 60 Seconds | PipRank';
    fetchBrokers()
      .then(setBrokers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
    track('quiz_start', { detected_geo: getGeo()?.slug ?? null });
    return () => {
      document.title = 'PipRank — Best Forex Brokers 2026: Reviews, Comparison & Free Trading Tools';
    };
  }, []);

  useEffect(() => {
    if (activeGeo && !geoSlug) setGeoSlug(activeGeo.slug);
  }, [activeGeo, geoSlug]);

  useEffect(() => {
    if (!geoSlug) {
      setCountry(null);
      return;
    }
    fetchCountry(geoSlug)
      .then(setCountry)
      .catch(() => setCountry(null));
  }, [geoSlug]);

  // loader line rotation
  useEffect(() => {
    if (!analyzing) return;
    const t = setInterval(() => setLoaderLine((l) => Math.min(l + 1, LOADER_LINES.length - 1)), 420);
    return () => clearInterval(t);
  }, [analyzing]);

  const questions = useMemo<Question[]>(() => {
    const detected = activeGeo ?? getGeo();
    return QUESTIONS.map((q) =>
      q.key === 'country'
        ? {
            ...q,
            options: [
              ...GEO_OPTIONS.map((g) => ({
                value: g.slug,
                label: g.name,
                hint: g.slug === detected?.slug ? 'Auto-detected ✓' : 'Localised matches',
                icon: MapPin,
                flag: g.flag,
              })),
              { value: 'global', label: 'Somewhere else', hint: 'Global shortlist', icon: MapPin, flag: '🌐' },
            ],
          }
        : q
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGeo]);

  const results = useMemo(() => {
    if (!done) return [];
    const a = answers as Answers;
    const recNotes = new Map((country?.recommended ?? []).map((r) => [r.slug, r.note]));
    const recRank = new Map((country?.recommended ?? []).map((r, i) => [r.slug, i]));
    // Hard rule: with a country selected, only locally-eligible brokers can be recommended.
    const blocked = new Set(country?.unavailable ?? []);
    const pool = country
      ? brokers.filter((b) => recNotes.has(b.slug))
      : brokers.filter((b) => !blocked.has(b.slug));
    return pool
      .map((b) => {
        const { score, reasons } = scoreBroker(b, a);
        const rank = country ? (recRank.get(b.slug) ?? 99) : 99;
        const adjusted = score + (country ? Math.max(6, 14 - rank * 2) : 0);
        return {
          broker: b,
          score: adjusted,
          pct: Math.max(41, Math.min(99, Math.round(adjusted))),
          reasons: country ? [`${country.flag} Eligible & vetted for ${country.name}`, ...reasons] : reasons,
        };
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, 3);
  }, [done, answers, brokers, country]);

  // results_view — feeds the recommendation-presentation effectiveness metric
  useEffect(() => {
    if (done && results.length > 0) {
      track('results_view', { matches: results.map((r) => r.broker.slug), country: country?.slug ?? null });
      // personalization memory — the winner follows up later via the site nudge
      try {
        localStorage.setItem(
          'piprank_match',
          JSON.stringify({ slug: results[0].broker.slug, pct: results[0].pct, at: Date.now() })
        );
      } catch {
        /* private mode */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const choose = (q: Question, value: string) => {
    if (q.multi) {
      const cur = (answers.prefs ?? []) as string[];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      setAnswers((prev) => ({ ...prev, prefs: next }));
      track('quiz_answer', { step, key: q.key, value, multi: true });
      return;
    }
    if (q.key === 'country') {
      const v = value === 'global' ? '' : value;
      setGeoSlug(v);
      setGeoPreference(v || null);
    }
    setAnswers((prev) => ({ ...prev, [q.key]: value }));
    track('quiz_answer', { step, key: q.key, value });
    const nextStep = step + 1;
    setTimeout(() => {
      if (nextStep === questions.length) {
        track('quiz_complete', { answers: { ...answers, [q.key]: value } });
        setAnalyzing(true);
        setLoaderLine(0);
        setTimeout(() => { setAnalyzing(false); setDone(true); }, 1400);
      } else {
        track('quiz_step', { step: nextStep, key: questions[nextStep].key });
        setStep(nextStep);
      }
    }, 260);
  };

  const finishMulti = () => {
    track('quiz_complete', { answers });
    setAnalyzing(true);
    setLoaderLine(0);
    setTimeout(() => { setAnalyzing(false); setDone(true); }, 1400);
  };

  const restart = () => {
    setAnswers({});
    setStep(0);
    setDone(false);
  };

  if (loading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <div className="h-[420px] animate-pulse rounded-3xl border border-line bg-white" />
      </div>
    );

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      </div>
    );

  const q = questions[Math.min(step, questions.length - 1)];
  const multiSelected = (answers.prefs ?? []) as string[];

  const profileChips: [string, string][] = [];
  if (country) profileChips.push(['country', `${country.flag} ${country.name}`]);
  const expMap: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  if (answers.experience) profileChips.push(['exp', expMap[answers.experience]]);
  const styleMap: Record<string, string> = { scalping: '⚡ Scalping', day: 'Day trading', swing: 'Swing', copy: 'Copy trading' };
  if (answers.style) profileChips.push(['style', styleMap[answers.style]]);
  if (answers.platform && answers.platform !== 'any') profileChips.push(['platform', answers.platform]);
  for (const p of multiSelected) {
    const m: Record<string, string> = { islamic: '☪️ Swap-free', copy: 'Copy trading', lowdeposit: 'Low deposit', highleverage: 'High leverage', vps: 'VPS' };
    if (m[p]) profileChips.push([`pref-${p}`, m[p]]);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      {!done && !analyzing && (
        <>
          {/* stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {questions.map((s, i) => {
                const isDone = i < step;
                const isActive = i === step;
                return (
                  <div key={s.key} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                    <button
                      onClick={() => i < step && setStep(i)}
                      disabled={!isDone}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold transition ${
                        isActive
                          ? 'bg-ink-950 text-white shadow-soft ring-4 ring-emerald-500/25'
                          : isDone
                            ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                            : 'border border-line bg-white text-slate-400'
                      }`}
                      aria-label={`Step ${i + 1}: ${s.label}`}
                    >
                      {isDone ? <Check size={13} strokeWidth={3} /> : i + 1}
                    </button>
                    {i < questions.length - 1 && (
                      <div className={`h-0.5 flex-1 rounded-full transition ${isDone ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700">
                Step {step + 1}: {STEP_COLS[step]}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">~60 seconds total</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-ink-900"
              >
                <ArrowLeft size={15} /> Back
              </button>
            ) : (
              <span />
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-3 py-1 text-[11px] font-bold text-emerald-300">
              <Sparkles size={11} /> Smart matching live
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 26, scale: 0.99 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -26, scale: 0.99 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-9"
            >
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{q.title}</h1>
              <p className="mt-2 text-sm text-slate-500">{q.subtitle}</p>

              {q.key === 'country' ? (
                <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                  {q.options.map((opt) => {
                    const selected = answers[q.key] === opt.value;
                    return (
                      <motion.button
                        key={opt.value}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => choose(q, opt.value)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-center transition ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30'
                            : 'border-line bg-paper hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-white hover:shadow-soft'
                        }`}
                      >
                        <span className="text-3xl leading-none">{opt.flag}</span>
                        <span className="text-sm font-bold leading-tight text-ink-900">{opt.label}</span>
                        <span className="text-[11px] leading-snug text-slate-400">{opt.hint}</span>
                      </motion.button>
                    );
                  })}
                </div>
              ) : q.multi ? (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2.5">
                    {q.options.map((opt) => {
                      const selected = multiSelected.includes(opt.value);
                      return (
                        <motion.button
                          key={opt.value}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => choose(q, opt.value)}
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30'
                              : 'border-line bg-paper hover:border-emerald-400 hover:bg-white'
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              selected ? 'bg-emerald-500 text-white' : 'bg-ink-900 text-emerald-400'
                            }`}
                          >
                            <opt.icon size={15} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-ink-900">{opt.label}</p>
                            <p className="text-[11px] text-slate-500">{opt.hint}</p>
                          </div>
                          {selected && <Check size={16} className="ml-1 text-emerald-600" strokeWidth={3} />}
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <button onClick={finishMulti} className={btnCls('dark', 'md')}>
                      See my matches
                    </button>
                    <button onClick={finishMulti} className={btnCls('ghost', 'md')}>
                      Skip — none of these
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                  {q.options.map((opt) => {
                    const selected = answers[q.key] === opt.value;
                    return (
                      <motion.button
                        key={opt.value}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => choose(q, opt.value)}
                        className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30'
                            : 'border-line bg-paper hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-white hover:shadow-soft'
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                            selected ? 'bg-emerald-500 text-white' : 'bg-ink-900 text-emerald-400'
                          }`}
                        >
                          <opt.icon size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-ink-900">{opt.label}</p>
                          <p className="mt-0.5 text-xs leading-snug text-slate-500">{opt.hint}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* why this matters */}
              <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-paper px-4 py-3">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                <p className="text-xs leading-relaxed text-slate-500">
                  <span className="font-bold text-ink-900">Why we ask:</span> {q.why}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {/* analyzing interstitial */}
      {analyzing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl bg-ink-950 px-8 py-16 text-center"
        >
          <div className="absolute inset-0 bg-grid-dark" />
          <div className="relative">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                className="inline-block"
              >
                <Scale size={26} />
              </motion.span>
            </div>
            <p className="font-display text-2xl font-bold text-white">Crunching your profile…</p>
            <div className="mx-auto mt-5 max-w-xs space-y-2">
              {LOADER_LINES.map((l, i) => (
                <motion.p
                  key={l}
                  initial={{ opacity: 0.25 }}
                  animate={{ opacity: i <= loaderLine ? 1 : 0.25 }}
                  className={`flex items-center justify-center gap-2 text-xs font-semibold ${
                    i <= loaderLine ? 'text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  {i < loaderLine ? <Check size={13} strokeWidth={3} /> : <span className="tnum">{i + 1}.</span>}
                  {l}
                </motion.p>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* results */}
      {done && !analyzing && (
        <>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Your results</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              Your top 3 broker matches
              {country && <span className="text-emerald-700"> for {country.name}</span>}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {profileChips.map(([k, v]) => (
                <span key={k} className="rounded-full bg-ink-950 px-3 py-1.5 text-xs font-semibold text-white">
                  {v}
                </span>
              ))}
              <button
                onClick={restart}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
              >
                <RotateCcw size={12} /> Retake
              </button>
            </div>
            {country && (
              <p className="mt-3 text-xs font-medium text-slate-400">
                Strictly filtered to brokers that can onboard {country.name} residents.
              </p>
            )}
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <BadgeCheck size={12} /> Saved — we'll remind you of {results[0]?.broker.name ?? 'your match'} when you
              return.
            </p>
          </motion.div>

          {results[0] && (
            <section className="mt-8 overflow-hidden rounded-3xl border border-emerald-300 bg-white shadow-soft ring-2 ring-emerald-500/15">
              <div className="bg-ink-950 p-6 text-white sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Your best match</p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Monogram name={results[0].broker.name} logoUrl={results[0].broker.logo_url} color={results[0].broker.brand_color} size={62} className="rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-2xl font-bold sm:text-3xl">{results[0].broker.name}</h2>
                    <p className="mt-1 text-sm text-slate-300">{results[0].broker.tagline}</p>
                  </div>
                  <HealthRing score={results[0].pct} size={78} stroke={6} label="match" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {Object.entries(pipRankBreakdown(results[0].broker)).slice(0,3).map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                      <p className="tnum mt-0.5 text-lg font-bold text-emerald-300">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Why this is your match</p>
                    <h3 className="mt-1 font-display text-xl font-bold text-ink-900">Built around your answers</h3>
                  </div>
                  <p className="tnum font-display text-2xl font-bold text-emerald-700">{pipRankScore(results[0].broker)}/100 <span className="text-xs font-semibold text-slate-400">PipRank Score</span></p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {results[0].reasons.slice(0,4).map((r) => (
                    <div key={r} className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-slate-700 ring-1 ring-emerald-100"><Check size={13} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3}/>{r}</div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <VisitButton broker={results[0].broker} context="quiz_results" />
                  <Link to={`/brokers/${results[0].broker.slug}`} className="text-sm font-bold text-slate-500 hover:text-emerald-700">Read full review →</Link>
                </div>
              </div>
            </section>
          )}

          {results.length > 1 && (
            <section className="mt-8">
              <div className="flex items-end justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Other strong matches</p><h2 className="mt-1 font-display text-xl font-bold text-ink-900">Alternatives worth considering</h2></div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {results.slice(1).map(({ broker, pct, reasons }) => (
                  <div key={broker.slug} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
                    <div className="flex items-center gap-3"><Monogram name={broker.name} logoUrl={broker.logo_url} color={broker.brand_color} size={48} className="rounded-xl"/><div className="min-w-0 flex-1"><h3 className="font-display text-lg font-bold text-ink-900">{broker.name}</h3><p className="text-xs text-slate-500">{Math.round(pct)}% match</p></div></div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">{reasons.slice(0,2).join(' · ')}</p>
                    <div className="mt-4 flex items-center gap-3"><VisitButton broker={broker} compact /><Link to={`/brokers/${broker.slug}`} className="text-xs font-bold text-slate-500 hover:text-emerald-700">Read review →</Link></div>
                  </div>
                ))}
              </div>
            </section>
          )}

            {results.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">
                No brokers available for that country yet.
              </p>
            )}
        </>
      )}
    </div>
  );
}
