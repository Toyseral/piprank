import { CircleCheck, X } from 'lucide-react';
import type { Broker } from '../lib/types';
import type { ComparisonField } from './PageBuilder';
import { fmtMoney } from '../lib/format';

type Props = {
  brokers: Broker[];
  fields?: ComparisonField[];
  title?: string;
  ctaLabel?: string;
  ctaHref?: string;
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

function winnerIndex(field: ComparisonField, brokers: Broker[]) {
  if (brokers.length < 2 || !['rating', 'trust_score', 'min_deposit', 'spread_eurusd'].includes(field)) return null;
  const nums = brokers.map((b) => field === 'rating' ? Number(b.rating) : field === 'trust_score' ? Number(b.trust_score) : field === 'min_deposit' ? Number(b.min_deposit) : Number(b.spread_eurusd));
  const best = field === 'min_deposit' || field === 'spread_eurusd' ? Math.min(...nums) : Math.max(...nums);
  return nums.findIndex((n) => n === best);
}

export default function PipRankComparisonTable({ brokers, fields, title = 'Broker comparison', ctaLabel, ctaHref = '/compare' }: Props) {
  const rows: ComparisonField[] = fields?.length
  ? fields
  : ['rating', 'trust_score', 'min_deposit', 'spread_eurusd'];
  if (brokers.length < 2) return null;

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-line bg-white shadow-soft" aria-label={title}>
      <div className="border-b border-line bg-ink-950 px-4 py-4 sm:px-5">
        <h2 className="font-display text-xl font-bold text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid border-b border-line bg-ink-950 px-4 py-3 text-[10px] font-bold uppercase tracking-widest sm:px-5" style={{ gridTemplateColumns: `1.2fr repeat(${brokers.length}, minmax(150px, 1fr))` }}>
            <span className="text-slate-400">Metric</span>
            {brokers.map((b) => <span key={b.id} className="text-center text-emerald-300">{b.name}</span>)}
          </div>
          {rows.map((field, i) => {
            const win = winnerIndex(field, brokers);
            return <div key={field} className={`grid items-center gap-2 px-4 py-3.5 sm:px-5 ${i % 2 === 0 ? 'bg-paper/60' : 'bg-white'}`} style={{ gridTemplateColumns: `1.2fr repeat(${brokers.length}, minmax(150px, 1fr))` }}>
              <span className="text-xs font-bold text-slate-500">{label[field]}</span>
              {brokers.map((b, index) => <span key={b.id} className={`tnum flex items-center justify-center gap-1.5 text-center text-sm font-semibold ${win === index ? 'text-emerald-700' : 'text-slate-600'}`}>{value(b, field)}{win === index && <CircleCheck size={13} className="text-emerald-600"/>}{win !== null && win !== index && <X size={13} className="text-slate-300"/>}</span>)}
            </div>;
          })}
        </div>
      </div>
      {ctaLabel && <div className="flex flex-wrap items-center gap-3 border-t border-line p-5"><a href={ctaHref} className="inline-flex items-center justify-center rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-bold text-white">{ctaLabel}</a></div>}
    </section>
  );
}
