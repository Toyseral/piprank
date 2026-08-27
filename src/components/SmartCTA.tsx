import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, RotateCcw, Sparkles, X } from 'lucide-react';
import type { Broker } from '../lib/types';
import { track } from '../lib/track';
import { ButtonLink } from './Button';
import Monogram from './Monogram';
import VisitButton from './VisitButton';

interface Match {
  slug: string;
  pct: number;
  at: number;
}

/**
 * Lifecycle-aware floating prompt.
 *  1. Quiz completed but match never clicked  → "You were matched with…" + Visit + review link
 *  2. Match already followed up                → gentler "welcome back" variant
 *  3. No match at all                          → generic quiz pull
 * Triggers once per session: 45% scroll depth, or mouse exit intent (desktop).
 * Dismissed per session, but returns on the NEXT visit — the continuity objective.
 */
export default function SmartCTA() {
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [clicked, setClicked] = useState(false);
  const [broker, setBroker] = useState<Broker | null>(null);

  const suppressed = pathname.startsWith('/quiz') || pathname.startsWith('/archypage');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('piprank_match');
      setMatch(raw ? JSON.parse(raw) : null);
      setClicked(localStorage.getItem('piprank_match_clicked') === '1');
    } catch {
      setMatch(null);
      setClicked(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!match?.slug) {
      setBroker(null);
      return;
    }
    fetch(`/api/brokers?slug=${encodeURIComponent(match.slug)}`)
      .then((x) => (x.ok ? x.json() : null))
      .then((b) => b && !b.error && setBroker(b))
      .catch(() => setBroker(null));
  }, [match]);

  useEffect(() => {
    if (suppressed) {
      setShow(false);
      return;
    }
    let sessionDismissed = false;
    try {
      sessionDismissed = sessionStorage.getItem('piprank_smartcta_closed') === '1';
    } catch {
      /* private mode */
    }
    if (sessionDismissed) return;

    let shown = false;
    const showOnce = (source: 'scroll' | 'exit') => {
      if (shown) return;
      shown = true;
      setShow(true);
      track('cta_click', { context: 'smart_cta_view', source, has_match: !!match, page: window.location.pathname });
    };

    const onScroll = () => {
      const doc = document.documentElement;
      const pct = (window.scrollY + window.innerHeight) / doc.scrollHeight;
      if (pct >= 0.45) showOnce('scroll');
    };
    const onExit = (e: MouseEvent) => {
      if (e.clientY <= 8) showOnce('exit');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseout', onExit);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onExit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, suppressed]);

  const close = () => {
    setShow(false);
    try {
      sessionStorage.setItem('piprank_smartcta_closed', '1');
    } catch {
      /* private mode */
    }
  };

  const markMatchClicked = (context: string) => {
    localStorage.setItem('piprank_match_clicked', '1');
    track('cta_click', { context, broker: broker?.slug, page: window.location.pathname });
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="fixed bottom-4 right-4 z-[65] w-[calc(100%-2rem)] max-w-sm sm:bottom-6 sm:right-6"
          role="dialog"
          aria-label="Saved broker match"
        >
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft-lg">
            <div className="flex items-start gap-3 p-4">
              {broker && match ? (
                <Monogram name={broker.name} color={broker.brand_color} size={38} className="rounded-xl" logoUrl={broker.logo_url} />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-950 text-emerald-400">
                  <Sparkles size={17} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {broker && match ? (
                  <>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <BadgeCheck size={13} />
                      {clicked ? 'Welcome back' : 'Continue where you left off'}
                    </p>
                    <p className="mt-1 font-display text-sm font-bold text-ink-900">
                      You were matched with {broker.name} —{' '}
                      <span className="tnum text-emerald-600">{match.pct}%</span>
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">We saved your result.</p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-sm font-bold text-ink-900">Still deciding?</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">
                      The 60-second matcher names your top 3 brokers — free, no signup.
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={close}
                aria-label="Dismiss"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-paper hover:text-ink-900"
              >
                <X size={15} />
              </button>
            </div>

            <div className="border-t border-line bg-paper/60 px-4 py-3">
              {broker && match ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1" onClick={() => markMatchClicked('match_nudge_visit')}>
                    <VisitButton broker={broker} compact className="w-full" />
                  </div>
                  <Link
                    to={`/brokers/${broker.slug}`}
                    onClick={() => markMatchClicked('match_nudge_review')}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-ink-900"
                  >
                    <RotateCcw size={12} /> Review my match
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ButtonLink variant="primary" size="sm" to="/quiz" className="flex-1" icon={Sparkles}>
                    Find my 3 matches
                  </ButtonLink>
                  <button
                    onClick={close}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                  >
                    Later
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
