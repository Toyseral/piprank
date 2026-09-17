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
  rating: 'PipRank rating', trust_score: 'Trust score', min_deposit: 'Minimum deposit', spread_eurusd: 'EUR/USD spread',
  commission: 'Commission', max_leverage: 'Max leverage', platforms: 'Platforms', payments: 'Payment methods', regulations: 'Regulation',
};

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
  if (brokers.length < 2 || !['rating', 'trust_score', 'min_deposit', 'spread_eurusd'].includes(field)) return null;
  const nums = brokers.map((b) => field === 'rating' ? Number(b.rating) : field === 'trust_score' ? Number(b.trust_score) : field === 'min_deposit' ? Number(b.min_deposit) : Number(b.spread_eurusd));
  const best = field === 'min_deposit' || field === 'spread_eurusd' ? Math.min(...nums) : Math.max(...nums);
  return nums.map((n, i) => n === best ? i : -1).filter((i) => i >= 0);
}

export default function PipRankComparisonTable({ brokers, fields, title = 'Broker comparison', showCta = false }: Props) {
  const rows: ComparisonField[] = fields?.length ? fields : ['rating', 'trust_score', 'min_deposit', 'spread_eurusd'];
  if (brokers.length < 2) return null;

  return (
    <section className="mt-7 overflow-hidden rounded-[24px] border border-line bg-white shadow-soft" aria-label={title}>
      <div className="border-b border-line bg-ink-950 px-4 py-4 sm:px-5">
        <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid border-b border-line bg-paper px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:px-5" style={{ gridTemplateColumns: `minmax(190px, 240px) repeat(${rows.length}, minmax(150px, 1fr))` }}>
            <span className="sticky left-0 z-10 bg-paper pr-4">Broker</span>
            {rows.map((field) => <span key={field} className="text-center">{label[field]}</span>)}
          </div>

          {brokers.map((broker, index) => {
            const winners = rows.map((field) => winner(field, brokers));
            return (
              <div
                key={broker.id}
                className={`${index >= 5 ? 'hidden sm:grid' : 'grid'} items-stretch border-b border-line last:border-b-0 ${index % 2 === 0 ? 'bg-white' : 'bg-paper/50'}`}
                style={{ gridTemplateColumns: `minmax(190px, 240px) repeat(${rows.length}, minmax(150px, 1fr))` }}
              >
                <div className={`sticky left-0 z-10 flex min-w-0 items-center gap-3 border-r border-line px-4 py-4 sm:px-5 ${index % 2 === 0 ? 'bg-white' : 'bg-paper'}`}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 font-display text-xs font-bold text-white">{index + 1}</span>
                  <div className="min-w-0">
                    <a href={`#bestfor-${broker.slug}`} className="block truncate font-display text-sm font-bold text-ink-950 hover:text-emerald-700 sm:text-base">{broker.name}</a>
                    <span className="tnum text-[11px] font-semibold text-emerald-700">{pipRankScore(broker)}/100</span>
                  </div>
                </div>
                {rows.map((field, fieldIndex) => {
                  const isWinner = winners[fieldIndex]?.includes(index);
                  return (
                    <div key={field} className={`flex min-w-0 items-center justify-center px-3 py-4 text-center ${isWinner ? 'bg-emerald-50/70' : ''}`}>
                      <span className={`tnum text-sm font-semibold ${isWinner ? 'text-emerald-700' : 'text-slate-600'}`}>{value(broker, field)}</span>
                      {isWinner && <CircleCheck size={14} className="ml-1.5 shrink-0 text-emerald-600" />}
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
