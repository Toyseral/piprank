import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import type { Broker } from '../lib/types';

const MAX_MANUAL_BROKERS = 9;

type Props = {
  brokers: Broker[];
  value: string[];
  onChange: (value: string[]) => void;
};

/**
 * Explicit broker ordering for canonical Best-For pages.
 * The value is a broker-slug list; availability is constrained to the supplied broker pool.
 */
export default function ManualBrokerOrder({ brokers, value, onChange }: Props) {
  const bySlug = useMemo(() => new Map(brokers.map(b => [b.slug, b])), [brokers]);
  const ordered = value.filter((slug, index, list) => bySlug.has(slug) && list.indexOf(slug) === index).slice(0, MAX_MANUAL_BROKERS);
  const available = brokers.filter(b => !ordered.includes(b.slug));
  const atCapacity = ordered.length >= MAX_MANUAL_BROKERS;

  const move = (index: number, direction: -1 | 1) => {
    const next = [...ordered];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = (slug: string) => {
    if (!slug || ordered.includes(slug) || atCapacity) return;
    onChange([...ordered, slug].slice(0, MAX_MANUAL_BROKERS));
  };

  const remove = (slug: string) => onChange(ordered.filter(s => s !== slug));

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-5 text-slate-500">
          Select up to nine eligible brokers and arrange them in the exact public order. #1 becomes the page's Top Match.
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${atCapacity ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
          {ordered.length}/{MAX_MANUAL_BROKERS}
        </span>
      </div>

      <div className="space-y-1.5">
        {ordered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-paper px-3 py-4 text-center text-[11px] text-slate-400">
            No brokers selected yet.
          </div>
        ) : ordered.map((slug, index) => {
          const broker = bySlug.get(slug);
          if (!broker) return null;
          return (
            <div key={slug} className="flex items-center gap-2 rounded-xl border border-line bg-paper px-2.5 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-950 text-[10px] font-black text-white">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink-900">{broker.name}</span>
              <button type="button" aria-label={`Move ${broker.name} up`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-ink-950 disabled:opacity-30"><ArrowUp size={13}/></button>
              <button type="button" aria-label={`Move ${broker.name} down`} disabled={index === ordered.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-ink-950 disabled:opacity-30"><ArrowDown size={13}/></button>
              <button type="button" aria-label={`Remove ${broker.name}`} onClick={() => remove(slug)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={13}/></button>
            </div>
          );
        })}
      </div>

      {!atCapacity && available.length > 0 && (
        <select defaultValue="" onChange={e => { add(e.target.value); e.currentTarget.value = ''; }} className="h-10 w-full rounded-xl border border-line bg-white px-3 text-xs font-semibold outline-none focus:border-emerald-500">
          <option value="">+ Add broker</option>
          {available.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
        </select>
      )}
      {atCapacity && <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><Plus size={11}/> Nine brokers selected. Remove one to choose a different broker.</p>}
      {!atCapacity && available.length === 0 && brokers.length > 0 && <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><Plus size={11}/> All eligible brokers are selected.</p>}
    </div>
  );
}
