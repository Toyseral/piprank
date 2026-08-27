import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import type { Broker } from '../lib/types';
import Monogram from './Monogram';
import Stars from './Stars';
import VisitButton from './VisitButton';
import { fmtMoney } from '../lib/format';
import { track } from '../lib/track';
import { INTENT_LABELS, pipRankScore, scoreColors } from '../lib/score';

interface Props {
  broker: Broker;
  rank?: number;
  note?: string;
  /** Explicit decision context. Falls back to the current URL when omitted. */
  intent?: string;
  /** Country context, e.g. "malaysia". */
  countrySlug?: string;
}

function shortList(values: string[], max = 3) {
  if (!values?.length) return '—';
  const shown = values.slice(0, max);
  return values.length > max ? `${shown.join(' · ')} +${values.length - max}` : shown.join(' · ');
}

function regulationLabel(broker: Broker) {
  if (!broker.regulations?.length) return 'Not listed';
  return shortList(broker.regulations.map((r) => r.body).filter(Boolean));
}

function commissionLabel(broker: Broker) {
  if (!broker.commission) return '—';
  return broker.commission.length > 28 ? `${broker.commission.slice(0, 25)}…` : broker.commission;
}

function resolveIntent(explicit?: string) {
  if (explicit) return explicit;
  const path = window.location.pathname;
  const match = path.match(/\/best\/([^/]+)/);
  return match?.[1] ?? undefined;
}

export default function BrokerCard({ broker, rank, note, intent: explicitIntent, countrySlug }: Props) {
  const tone = scoreColors(broker.trust_score);
  const valueCls = 'tnum mt-0.5 truncate font-bold leading-tight text-ink-900 text-[12px] sm:text-sm';
  const isTop = rank === 1;
  const decisionScore = pipRankScore(broker);
  const intent = resolveIntent(explicitIntent);
  const isCountryContext = Boolean(countrySlug) || window.location.pathname.startsWith('/countries/');

  useEffect(() => {
    track('broker_card_view', { broker: broker.slug, page: window.location.pathname, rank: rank ?? null, intent: intent ?? null, country: countrySlug ?? null });
  }, [broker.slug, rank, intent, countrySlug]);

  const metrics = (() => {
    const base = [
      { label: 'Min deposit', value: fmtMoney(broker.min_deposit) },
      { label: 'EUR/USD spread', value: `${broker.spread_eurusd} pips` },
      { label: 'Max leverage', value: broker.max_leverage },
    ];

    // The fourth metric is deliberately intent-aware: it answers the question
    // behind the page instead of exposing a technical metric (execution ms)
    // that is difficult for most users to interpret consistently.
    let contextual = { label: 'Platforms', value: shortList(broker.platforms) };

    if (isCountryContext) {
      contextual = { label: 'Payment methods', value: shortList(broker.payments) };
    } else if (intent === 'beginners') {
      contextual = { label: 'Demo account', value: broker.demo_account ? 'Yes' : 'No' };
    } else if (intent === 'low-spread') {
      contextual = { label: 'Commission', value: commissionLabel(broker) };
    } else if (intent === 'mt5') {
      contextual = {
        label: 'MT5',
        value: broker.platforms.some((p) => p.toLowerCase() === 'mt5') ? 'Available' : 'Not available',
      };
    } else if (intent === 'ecn') {
      contextual = { label: 'Commission', value: commissionLabel(broker) };
    } else if (intent === 'copy-trading') {
      contextual = { label: 'Copy trading', value: broker.copy_trading ? 'Available' : 'Not available' };
    } else if (intent === 'scalping') {
      contextual = { label: 'Commission', value: commissionLabel(broker) };
    } else if (intent === 'high-leverage') {
      contextual = { label: 'Platforms', value: shortList(broker.platforms) };
    } else if (intent === 'swing-trading') {
      contextual = { label: 'Regulation', value: regulationLabel(broker) };
    } else if (intent === 'gold') {
      contextual = { label: 'Platforms', value: shortList(broker.platforms) };
    } else {
      contextual = { label: 'Regulation', value: regulationLabel(broker) };
    }

    return [...base.slice(0, 2), contextual, base[2]];
  })();

  return (
    <div
      className={`group relative flex h-full flex-col rounded-2xl border bg-white p-4 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-soft-lg sm:p-5 ${
        isTop
          ? 'border-emerald-300 ring-2 ring-emerald-500/25 hover:border-emerald-400'
          : 'border-line hover:border-emerald-300'
      }`}
    >
      {rank !== undefined && (
        <div className="absolute -left-2.5 -top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 font-display text-sm font-bold text-white shadow-md">
          {rank}
        </div>
      )}
      {broker.bonus && (
        <div className="absolute right-4 top-4 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
          Bonus
        </div>
      )}
      <div className={`flex items-start gap-3 ${broker.bonus ? 'pr-14' : ''}`}>
        <Monogram name={broker.name} color={broker.brand_color} size={46} logoUrl={broker.logo_url} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold text-ink-900">{broker.name}</h3>
          <p className="truncate text-xs text-slate-500">{broker.tagline}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Stars value={broker.rating} size={13} />
            <span className="tnum text-xs font-bold text-ink-900">{broker.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {note && (
        <div className="mt-2.5 space-y-1.5">
          {note.toLowerCase().includes('verified') && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">
              <BadgeCheck size={12} /> Country availability verified
            </span>
          )}
          <p className="line-clamp-2 rounded-lg bg-emerald-50/70 px-2.5 py-1.5 text-xs font-semibold leading-snug text-emerald-700 ring-1 ring-emerald-200/60">{note}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">PipRank Score</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Overall decision fit</p>
        </div>
        <p className="tnum font-display text-xl font-bold text-emerald-700">{decisionScore}<span className="text-xs font-semibold text-slate-400">/100</span></p>
      </div>

      {isTop && note && (
        <div className="mt-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Why PipRank recommends it</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{note}</p>
        </div>
      )}

      <div className="mt-4 grid gap-2 min-[380px]:grid-cols-2">
        {metrics.map((s) => (
          <div key={s.label} className="min-w-0 rounded-xl bg-paper px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className={valueCls}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone.bg} ${tone.border} ${tone.text}`}
        >
          <BadgeCheck size={12} />
          Trust {broker.trust_score}
        </span>
        {broker.best_for.slice(0, 2).map((slug) => (
          <span
            key={slug}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
          >
            {INTENT_LABELS[slug] ?? slug}
          </span>
        ))}
      </div>

      {/* One commercial CTA. Review is intentionally secondary; comparison is removed from cards. */}
      <div className="mt-auto pt-4">
        <VisitButton broker={broker} compact={false} className="w-full" />
        <Link
          to={`/brokers/${broker.slug}`}
          className="mt-3 inline-flex w-full items-center justify-center gap-1 text-xs font-bold text-slate-500 transition hover:text-emerald-700"
          onClick={() => track('broker_click', { broker: broker.slug, source: 'card_review', page: window.location.pathname })}
        >
          Read full review
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
