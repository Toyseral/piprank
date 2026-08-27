import type { Broker } from './types';

/** Broker Health Score — weighted composite of six measured factors. */
export function healthScore(b: Broker): number {
  const h = b.health;
  return Math.round(
    h.regulation * 0.3 +
    h.withdrawals * 0.2 +
    h.execution * 0.15 +
    h.longevity * 0.15 +
    h.support * 0.1 +
    h.sentiment * 0.1
  );
}

/** Best (lowest) regulatory tier a broker holds, 1 = strongest. */
export function tierBest(b: Broker): number {
  return Math.min(...b.regulations.map((r) => r.tier));
}

export function tierLabel(t: number): string {
  return t === 1 ? 'Tier-1' : t === 2 ? 'Tier-2' : 'Tier-3';
}

/** All-in EURUSD cost per lot in pips: spread + commission converted to pips ($10/pip per lot). */
export function allInCost(b: Broker): number {
  return Math.round((b.spread_eurusd + b.commission_value / 10) * 100) / 100;
}

/** Cross-broker winner score used by the comparison engine and pair pages. */
export function composite(b: Broker): number {
  return (
    b.rating * 12 +
    b.trust_score * 0.6 +
    healthScore(b) * 0.6 -
    allInCost(b) * 5 -
    Math.min(b.min_deposit / 100, 3) +
    (tierBest(b) === 1 ? 6 : 0)
  );
}

export function totalAssets(b: Broker): number {
  const a = b.assets;
  return a.forex + a.indices + a.commodities + a.crypto + a.stocks;
}

export interface ScoreTone {
  text: string;
  bg: string;
  border: string;
  hex: string;
}

/** PipRank Score — the visible decision score used on broker recommendations.
 * This is deliberately separate from Health Score: it weights the broker's
 * overall user-facing fit, trust, cost and platform/accessibility signals.
 */
export function pipRankScore(b: Broker): number {
  const cost = Math.max(0, 100 - allInCost(b) * 12);
  const deposit = Math.max(0, 100 - Math.min(b.min_deposit, 500) / 5);
  const trust = b.trust_score;
  const health = healthScore(b);
  const rating = Math.min(100, b.rating * 20);
  return Math.max(1, Math.min(99, Math.round(trust * 0.28 + health * 0.28 + cost * 0.18 + deposit * 0.08 + rating * 0.18)));
}

export function pipRankBreakdown(b: Broker) {
  return {
    Trust: b.trust_score,
    Health: healthScore(b),
    Costs: Math.max(0, Math.min(100, Math.round(100 - allInCost(b) * 12))),
    Accessibility: Math.max(0, Math.min(100, Math.round(100 - Math.min(b.min_deposit, 500) / 5))),
    Reputation: Math.min(100, Math.round(b.rating * 20)),
  };
}

export function scoreColors(score: number): ScoreTone {
  if (score >= 90)
    return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', hex: '#2bd695' };
  if (score >= 78)
    return { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', hex: '#38bdf8' };
  if (score >= 65)
    return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', hex: '#f5b53f' };
  return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', hex: '#fb7185' };
}

export const INTENT_LABELS: Record<string, string> = {
  beginners: 'Beginners',
  'low-spread': 'Low spreads',
  mt5: 'MT5',
  ecn: 'ECN',
  'copy-trading': 'Copy trading',
  scalping: 'Scalping',
  'swing-trading': 'Swing trading',
  'high-leverage': 'High leverage',
};
