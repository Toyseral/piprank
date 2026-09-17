import { CircleCheck } from 'lucide-react';
import type { Broker } from '../lib/types';
import type { ComparisonField } from './PageBuilder';
import { fmtMoney } from '../lib/format';
import { pipRankScore } from '../lib/score';
import VisitButton from './VisitButton';

type Props = {
  brokers: Broker[];
  fields?: ComparisonField[];
  title?: string;
  showCta?: boolean;
};

const label: Record<ComparisonField, string> = {
  rating: 'Rating', trust_score: 'Trust score', min_deposit: 'Minimum deposit', spread_eurusd: 'EUR/USD spread',
  commission: 'Commission', max_leverage: 'Max leverage', platforms: 'Platforms', payments: 'Payment methods', regulations: 'Regulation',
};

const allowedMetricFields: ComparisonField[] = [
  'min_deposit',
  'spread_eurusd',
  'commission',
  'max_leverage',
  'platforms',
  'payments',
  'regulations',
];

function value(b: Broker, field: ComparisonField) {
  switch (field) {
    case 'rating': return `${Number(b.rating ?? 0).toFixed(1)} / 5`;
    case 'trust_score': return `${b.trust_score}/100`;
    case 'min_deposit': return fmtMoney(b.min_deposit);
    case 'spread_eurusd': return `${b.spread_eurusd}p`;
    case 'commission': return b.commission || '—';
    case 'max_leverage': return b.max_leverage;
    case 'platforms': return b.platforms.join(', ') || '—';
    case 'payments': return b.payments.join(', ') || '—';
    case 'regulations': return b.regulations.map((r) => r.body).filter(Boolean).join(', ') || '—';
  }
}

function winner(field: ComparisonField, brokers: Broker[]) {
  if (brokers.length < 2 || !['min_deposit', 'spread_eurusd'].includes(field)) return null;
  const nums = brokers.map((b) => field === 'min_deposit' ? Number(b.min_deposit) : Number(b.spread_eurusd));
  const best = Math.min(...nums);
  return nums.map((n, i) => n === best ? i : -1).filter((i) => i >= 0);
}

export default function PipRankComparisonTable({ brokers, fields, title = 'Broker comparison', showCta = false }: Props) {
  const requested: ComparisonField[] = fields?.length ? fields : ['min_deposit', 'spread_eurusd', 'commission', 'max_leverage'];
  const rows = requested.filter((field) => allowedMetricFields.includes(field));
  if (brokers.length < 2) return null;

  return (
    <section className="mt-7 w-full overflow-hidden rounded-none border-y border-line bg-white shadow-soft sm:rounded-[24px] sm:border" aria-label={title}>
      <div className="border-b border-line bg-ink-950 px-4 py-4 sm:px-5">
        <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="min-w-[760px] sm:min-w-[1120px]">
          <div className="grid border-b border-line bg-paper px-2 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:px-5 sm:text-[10px] sm:tracking-[0.16em]" style={{ gridTemplateColumns: `minmax(150px, 1fr) repeat(${rows.length}, minmax(125px, 1fr))` }}>
            <span className="sticky left-0 z-10 bg-paper pr-2 sm:pr-4">Broker</span>
            {rows.map((field) => <span key={field} className="px-1 text-center">{label[field]}</span>)}
          </div>

          {brokers.map((broker, index) => {
            const winners = rows.map((field) => winner(field, brokers));
            return (
              <div
                key={broker.id}
                className="grid items-stretch border-b border-line last:border-b-0"
                style={{ gridTemplateColumns: `minmax(150px, 1fr) repeat(${rows.length}, minmax(125px, 1fr))` }}
              >
                <div className={`sticky left-0 z-10 flex min-w-0 items-center gap-2 border-r border-line px-2.5 py-3 sm:gap-3 sm:px-5 sm:py-4 ${index % 2 === 0 ? 'bg-white' : 'bg-paper'}`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-950 font-display text-[10px] font-bold text-white sm:h-8 sm:w-8 sm:text-xs">{index + 1}</span>
                  <div className="min-w-0">
                    <a href={`#bestfor-${broker.slug}`} className="block whitespace-normal break-words font-display text-[11px] font-bold leading-tight text-ink-950 hover:text-emerald-700 sm:text-base">{broker.name}</a>
                    <span className="tnum text-[9px] font-semibold text-emerald-700 sm:text-[11px]">{pipRankScore(broker)}/100 PipRank</span>
                  </div>
                </div>
                {rows.map((field, fieldIndex) => {
                  const isWinner = winners[fieldIndex]?.includes(index);
                  return (
                    <div key={field} className={`flex min-w-0 items-center justify-center px-2 py-3 text-center sm:px-3 sm:py-4 ${isWinner ? 'bg-emerald-50/70' : ''}`}>
                      <span className={`tnum text-[11px] font-semibold leading-tight sm:text-sm ${isWinner ? 'text-emerald-700' : 'text-slate-600'}`}>{value(broker, field)}</span>
                      {isWinner && <CircleCheck size={13} className="ml-1 shrink-0 text-emerald-600 sm:ml-1.5 sm:h-3.5 sm:w-3.5" />}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {showCta && (
            <div className="border-t border-line bg-paper p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {brokers.map((broker) => <VisitButton key={broker.id} broker={broker} ctaVariant="comparison" compact className="w-full justify-center" />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
